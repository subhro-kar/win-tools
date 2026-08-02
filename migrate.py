"""
WinTools - Migration module for encrypted backup & restore via Cloudflare R2.
Handles: SSH keys, GPG keys, Git config, env vars, PowerShell profile.
Uses Fernet symmetric encryption and boto3 S3 for R2 uploads.
"""

import io
import json
import os
import subprocess
import tempfile
import zipfile
from pathlib import Path

from cryptography.fernet import Fernet

# ── Paths ──────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
SECRETS_SCAN = DATA_DIR / "secrets-scan.json"
SCAN_SECRETS_SCRIPT = BASE_DIR / "scan-secrets.ps1"

# ── Encryption ─────────────────────────────────────────────────────


def generate_key() -> bytes:
    """Generate a new Fernet symmetric encryption key."""
    return Fernet.generate_key()


def encrypt_data(data: bytes, key: bytes) -> bytes:
    """Encrypt data using Fernet symmetric key."""
    f = Fernet(key)
    return f.encrypt(data)


def decrypt_data(encrypted: bytes, key: bytes) -> bytes:
    """Decrypt Fernet-encrypted data."""
    f = Fernet(key)
    return f.decrypt(encrypted)


# ── Scanning ──────────────────────────────────────────────────────


def run_secrets_scan() -> dict:
    """Run the PowerShell secrets scanner and return the parsed JSON."""
    result = subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
         "-File", str(SCAN_SECRETS_SCRIPT)],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Secrets scan failed: {result.stderr}")

    if SECRETS_SCAN.exists() and SECRETS_SCAN.stat().st_size > 0:
        try:
            with open(SECRETS_SCAN, encoding="utf-8-sig") as f:
                return json.load(f)
        except json.JSONDecodeError:
            pass
    raise RuntimeError("Secrets scan produced no output (empty or invalid JSON)")


def get_secrets_summary() -> dict:
    """Get a summary of what's available for migration (without reading file contents)."""
    scan = None
    if SECRETS_SCAN.exists() and SECRETS_SCAN.stat().st_size > 0:
        try:
            with open(SECRETS_SCAN, encoding="utf-8-sig") as f:
                scan = json.load(f)
        except (json.JSONDecodeError, Exception):
            scan = None
    if scan is None:
        scan = run_secrets_scan()

    summary = {"scanDate": scan.get("ScanDate", ""), "computerName": scan.get("ComputerName", "")}

    # SSH
    ssh = scan.get("SSH", {})
    summary["ssh"] = {
        "found": ssh.get("Found", False),
        "dir": ssh.get("Dir", ""),
        "keyCount": ssh.get("KeyCount", 0),
        "keys": ssh.get("Keys", []),
        "files": ssh.get("Files", []),
    }

    # Git config
    gitconfig = Path.home() / ".gitconfig"
    summary["git"] = {"found": gitconfig.exists(), "path": str(gitconfig)}

    # Environment variables (user-level)
    summary["envVars"] = _scan_env_vars()

    # PowerShell profile
    profile_path = _get_ps_profile_path()
    summary["psProfile"] = {"found": profile_path.exists(), "path": str(profile_path)}

    # GPG keys
    summary["gpg"] = _check_gpg()

    # Windows Terminal settings
    wt_path = _get_terminal_settings_path()
    summary["windowsTerminal"] = {"found": wt_path.exists() if wt_path else False, "path": str(wt_path) if wt_path else ""}

    return summary


def _scan_env_vars() -> dict:
    """Scan user-level environment variables."""
    result = subprocess.run(
        ["powershell", "-NoProfile", "-Command",
         "[Environment]::GetEnvironmentVariables('User') | ConvertTo-Json -Depth 3"],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode == 0 and result.stdout.strip():
        try:
            env = json.loads(result.stdout)
            # Filter to interesting vars (skip system defaults)
            skip_prefixes = ("PATH", "TEMP", "TMP", "USERNAME", "USERPROFILE",
                              "USERDOMAIN", "HOMEDRIVE", "HOMEPATH", "COMPUTERNAME",
                              "OS", "PROCESSOR_", "NUMBER_OF_PROCESSORS", "PSMODULEPATH")
            interesting = {}
            for k, v in env.items():
                if k.upper() not in skip_prefixes and not k.upper().startswith("="):
                    interesting[k] = v
            return {"found": True, "count": len(interesting), "vars": interesting}
        except json.JSONDecodeError:
            pass
    return {"found": False, "count": 0, "vars": {}}


def _get_ps_profile_path() -> Path:
    """Get PowerShell profile path."""
    result = subprocess.run(
        ["powershell", "-NoProfile", "-Command", "$PROFILE"],
        capture_output=True, text=True, timeout=10,
    )
    if result.returncode == 0 and result.stdout.strip():
        return Path(result.stdout.strip())
    return Path.home() / "Documents" / "PowerShell" / "Microsoft.PowerShell_profile.ps1"


def _check_gpg() -> dict:
    """Check if GPG is available and has secret keys."""
    result = subprocess.run(
        ["gpg", "--list-secret-keys", "--keyid-format", "short"],
        capture_output=True, text=True, timeout=10,
    )
    if result.returncode != 0:
        return {"found": False, "available": False, "keyCount": 0}

    # Count secret key lines
    key_lines = [l for l in result.stdout.splitlines() if l.startswith("sec ") or l.startswith("rsa ") or l.startswith("ed25519 ")]
    return {"found": len(key_lines) > 0, "available": True, "keyCount": len(key_lines), "output": result.stdout}


def _get_terminal_settings_path() -> Path:
    """Get Windows Terminal settings.json path."""
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    if local_app_data:
        # Windows Terminal (Store version)
        wt_path = Path(local_app_data) / "Packages" / "Microsoft.WindowsTerminal_8wekyb3d8bbwe" / "LocalState" / "settings.json"
        if wt_path.exists():
            return wt_path
        # Windows Terminal Preview
        wt_path = Path(local_app_data) / "Packages" / "Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe" / "LocalState" / "settings.json"
        if wt_path.exists():
            return wt_path
    return None


# ── Bundling ──────────────────────────────────────────────────────


def create_bundle(selected_items: dict, key: bytes) -> tuple:
    """Create an encrypted bundle of the selected migration items.

    Args:
        selected_items: dict with keys like 'ssh', 'git', 'envVars', etc. and boolean values
        key: Fernet encryption key

    Returns:
        (encrypted_data, manifest) tuple
    """
    manifest = {"version": "1.0", "items": {}, "files": {}}
    bundle_files = {}

    # ── SSH Keys ──
    if selected_items.get("ssh"):
        ssh_dir = Path.home() / ".ssh"
        if ssh_dir.exists():
            ssh_files = {}
            for f in ssh_dir.iterdir():
                if f.is_file() and not f.name.endswith(".old"):
                    try:
                        content = f.read_bytes()
                        rel_path = str(f.relative_to(Path.home()))
                        bundle_files[rel_path] = content
                        ssh_files[f.name] = {"size": len(content), "relative": rel_path}
                    except (PermissionError, OSError):
                        pass
            manifest["items"]["ssh"] = {"dir": str(ssh_dir), "fileCount": len(ssh_files), "files": ssh_files}

    # ── Git Config ──
    if selected_items.get("git"):
        gitconfig = Path.home() / ".gitconfig"
        if gitconfig.exists():
            content = gitconfig.read_bytes()
            bundle_files[".gitconfig"] = content
            manifest["items"]["git"] = {"path": str(gitconfig), "size": len(content)}

    # ── Environment Variables ──
    if selected_items.get("envVars"):
        env_summary = _scan_env_vars()
        if env_summary.get("found"):
            env_data = json.dumps(env_summary["vars"], indent=2).encode("utf-8")
            bundle_files["env-vars.json"] = env_data
            manifest["items"]["envVars"] = {"count": env_summary["count"]}

    # ── PowerShell Profile ──
    if selected_items.get("psProfile"):
        profile_path = _get_ps_profile_path()
        if profile_path and profile_path.exists():
            content = profile_path.read_bytes()
            bundle_files["Microsoft.PowerShell_profile.ps1"] = content
            manifest["items"]["psProfile"] = {"path": str(profile_path), "size": len(content)}

    # ── GPG Keys ──
    if selected_items.get("gpg"):
        gpg_info = _check_gpg()
        if gpg_info.get("found"):
            result = subprocess.run(
                ["gpg", "--armor", "--export-secret-keys"],
                capture_output=True, timeout=30,
            )
            if result.returncode == 0 and result.stdout:
                gpg_data = result.stdout.encode("utf-8") if isinstance(result.stdout, str) else result.stdout
                bundle_files["gpg-secret-keys.asc"] = gpg_data
                manifest["items"]["gpg"] = {"keyCount": gpg_info["keyCount"], "size": len(gpg_data)}

    # ── Windows Terminal Settings ──
    if selected_items.get("windowsTerminal"):
        wt_path = _get_terminal_settings_path()
        if wt_path and wt_path.exists():
            content = wt_path.read_bytes()
            bundle_files["terminal-settings.json"] = content
            manifest["items"]["windowsTerminal"] = {"path": str(wt_path), "size": len(content)}

    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("manifest.json", json.dumps(manifest, indent=2))
        for name, data in bundle_files.items():
            zf.writestr(name, data)

    zip_data = zip_buffer.getvalue()
    encrypted = encrypt_data(zip_data, key)
    return encrypted, manifest


def extract_bundle(encrypted_data: bytes, key: bytes) -> dict:
    """Decrypt and extract a migration bundle.

    Returns:
        dict with 'manifest' and 'files' (name -> bytes)
    """
    zip_data = decrypt_data(encrypted_data, key)

    files = {}
    manifest = {}

    with zipfile.ZipFile(io.BytesIO(zip_data), "r") as zf:
        for name in zf.namelist():
            data = zf.read(name)
            if name == "manifest.json":
                manifest = json.loads(data.decode("utf-8"))
            else:
                files[name] = data

    return {"manifest": manifest, "files": files}


# ── R2 Upload/Download ────────────────────────────────────────────


def get_r2_client(credentials: dict):
    """Create a boto3 S3 client configured for Cloudflare R2."""
    try:
        import boto3
    except ImportError:
        raise RuntimeError("boto3 is not installed. Run: pip install boto3")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{credentials['account_id']}.r2.cloudflarestorage.com",
        aws_access_key_id=credentials["access_key_id"],
        aws_secret_access_key=credentials["secret_access_key"],
        region_name="auto",
    )


def test_r2_connection(credentials: dict) -> dict:
    """Test R2 credentials by listing the bucket."""
    try:
        client = get_r2_client(credentials)
        client.head_bucket(Bucket=credentials["bucket_name"])
        return {"success": True, "message": "R2 connection successful"}
    except Exception as e:
        return {"success": False, "message": str(e)}


def upload_to_r2(encrypted_data: bytes, credentials: dict, object_key: str = None) -> dict:
    """Upload encrypted bundle to Cloudflare R2."""
    if object_key is None:
        import datetime
        object_key = f"wintools-migrate/{credentials.get('computer_name', 'unknown')}/{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}.encrypted"

    try:
        client = get_r2_client(credentials)
        client.put_object(
            Bucket=credentials["bucket_name"],
            Key=object_key,
            Body=encrypted_data,
            ContentType="application/octet-stream",
        )
        return {"success": True, "object_key": object_key, "size": len(encrypted_data)}
    except Exception as e:
        return {"success": False, "message": str(e)}


def download_from_r2(credentials: dict, object_key: str) -> dict:
    """Download encrypted bundle from Cloudflare R2."""
    try:
        client = get_r2_client(credentials)
        response = client.get_object(
            Bucket=credentials["bucket_name"],
            Key=object_key,
        )
        data = response["Body"].read()
        return {"success": True, "data": data}
    except Exception as e:
        return {"success": False, "message": str(e)}


def list_r2_backups(credentials: dict) -> dict:
    """List available migration backups in R2."""
    try:
        client = get_r2_client(credentials)
        response = client.list_objects_v2(
            Bucket=credentials["bucket_name"],
            Prefix="wintools-migrate/",
        )
        backups = []
        for obj in response.get("Contents", []):
            backups.append({
                "key": obj["Key"],
                "size": obj["Size"],
                "lastModified": obj["LastModified"].isoformat() if hasattr(obj["LastModified"], "isoformat") else str(obj["LastModified"]),
            })
        return {"success": True, "backups": backups}
    except Exception as e:
        return {"success": False, "message": str(e)}


# ── Restore ────────────────────────────────────────────────────────


def apply_restore(bundle: dict, selected: dict) -> dict:
    """Apply selected items from an extracted bundle to the current system.

    Args:
        bundle: result from extract_bundle()
        selected: dict of item names to apply (ssh, git, envVars, etc.)

    Returns:
        dict with results per item
    """
    results = {}
    manifest = bundle["manifest"]
    files = bundle["files"]
    home = Path.home()

    # ── SSH Keys ──
    if selected.get("ssh") and "ssh" in manifest.get("items", {}):
        ssh_dir = home / ".ssh"
        ssh_dir.mkdir(exist_ok=True)
        applied = 0
        for name, data in files.items():
            if name.startswith(".ssh/") or (not name.startswith("env-vars") and not name.startswith("gpg")
                                            and not name.startswith("manifest") and not name.startswith("Microsoft")
                                            and not name.startswith("terminal") and not name.startswith(".gitconfig")):
                target = ssh_dir / Path(name).name
                try:
                    target.write_bytes(data)
                    applied += 1
                except Exception as e:
                    pass
        results["ssh"] = {"applied": applied, "dir": str(ssh_dir)}

    # ── Git Config ──
    if selected.get("git") and ".gitconfig" in files:
        target = home / ".gitconfig"
        try:
            target.write_bytes(files[".gitconfig"])
            results["git"] = {"applied": True, "path": str(target)}
        except Exception as e:
            results["git"] = {"applied": False, "error": str(e)}

    # ── Environment Variables ──
    if selected.get("envVars") and "env-vars.json" in files:
        try:
            env_vars = json.loads(files["env-vars.json"].decode("utf-8"))
            applied = 0
            for k, v in env_vars.items():
                try:
                    subprocess.run(
                        ["powershell", "-NoProfile", "-Command",
                         f"[Environment]::SetEnvironmentVariable('{k}', '{v}', 'User')"],
                        capture_output=True, timeout=10,
                    )
                    applied += 1
                except Exception:
                    pass
            results["envVars"] = {"applied": applied, "total": len(env_vars)}
        except Exception as e:
            results["envVars"] = {"applied": False, "error": str(e)}

    # ── PowerShell Profile ──
    if selected.get("psProfile") and "Microsoft.PowerShell_profile.ps1" in files:
        profile_path = _get_ps_profile_path()
        try:
            profile_path.parent.mkdir(parents=True, exist_ok=True)
            profile_path.write_bytes(files["Microsoft.PowerShell_profile.ps1"])
            results["psProfile"] = {"applied": True, "path": str(profile_path)}
        except Exception as e:
            results["psProfile"] = {"applied": False, "error": str(e)}

    # ── GPG Keys ──
    if selected.get("gpg") and "gpg-secret-keys.asc" in files:
        try:
            with tempfile.NamedTemporaryFile(suffix=".asc", delete=False, mode="wb") as tmp:
                tmp.write(files["gpg-secret-keys.asc"])
                tmp_path = tmp.name
            result = subprocess.run(
                ["gpg", "--import", tmp_path],
                capture_output=True, text=True, timeout=60,
            )
            os.unlink(tmp_path)
            imported = result.stdout.count("secret key imported") + result.stderr.count("secret key imported")
            results["gpg"] = {"applied": True, "imported": imported}
        except Exception as e:
            results["gpg"] = {"applied": False, "error": str(e)}

    # ── Windows Terminal Settings ──
    if selected.get("windowsTerminal") and "terminal-settings.json" in files:
        wt_path = _get_terminal_settings_path()
        if wt_path:
            try:
                wt_path.parent.mkdir(parents=True, exist_ok=True)
                wt_path.write_bytes(files["terminal-settings.json"])
                results["windowsTerminal"] = {"applied": True, "path": str(wt_path)}
            except Exception as e:
                results["windowsTerminal"] = {"applied": False, "error": str(e)}

    return results


# ── Cloudflare R2 One-Click Setup ──────────────────────────────────────

import hashlib
import json as _json
import urllib.request
import urllib.error


def _cf_request(method: str, path: str, api_token: str, data: dict = None) -> dict:
    """Make a request to the Cloudflare API. Returns parsed JSON or raises."""
    url = f"https://api.cloudflare.com/client/v4{path}"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json",
    }
    body = _json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return _json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        try:
            error_data = _json.loads(error_body)
            msg = _format_cf_errors(error_data) or error_body[:500]
        except _json.JSONDecodeError:
            msg = error_body[:500]
        raise RuntimeError(f"Cloudflare API error {e.code}: {msg}")
    except urllib.error.URLError as e:
        raise RuntimeError(f"Connection error: {e.reason}")
    except Exception as e:
        raise RuntimeError(f"Request failed: {type(e).__name__}: {e}")


def _format_cf_errors(error_data: dict) -> str:
    """Format Cloudflare API error response into a readable string."""
    errors = error_data.get("errors", [])
    if not errors:
        # Sometimes the error is in messages
        messages = error_data.get("messages", [])
        if messages:
            return "; ".join(str(m) if isinstance(m, str) else m.get("message", str(m)) for m in messages)
        return ""
    parts = []
    for err in errors:
        if isinstance(err, str):
            parts.append(err)
        elif isinstance(err, dict):
            parts.append(err.get("message", err.get("code", str(err))))
        else:
            parts.append(str(err))
    return "; ".join(parts)


def cloudflare_verify_token(api_token: str) -> dict:
    """Verify a Cloudflare API token and get account ID + token ID.

    Returns {'success': True, 'account_id': str, 'account_name': str, 'token_id': str} on success.
    The token_id becomes the S3 Access Key ID for R2.
    """
    # Verify the token — also gives us the token ID which becomes the Access Key ID
    result = _cf_request("GET", "/user/tokens/verify", api_token)
    if not result.get("success"):
        msg = _format_cf_errors(result) or "Unknown error"
        raise RuntimeError(f"Token verification failed: {msg}")

    token_result = result.get("result", {})
    if not isinstance(token_result, dict):
        raise RuntimeError(f"Unexpected token verify response: {token_result}")
    token_id = token_result.get("id", "")
    if not token_id:
        raise RuntimeError("Token verification succeeded but no token ID returned")

    # Get account ID
    accounts = _cf_request("GET", "/accounts", api_token)
    if not accounts.get("success"):
        msg = _format_cf_errors(accounts) or "Unknown error"
        raise RuntimeError(f"Failed to list Cloudflare accounts: {msg}")

    acc_list = accounts.get("result", [])
    if not isinstance(acc_list, list):
        raise RuntimeError(f"Unexpected accounts response: {type(acc_list).__name__}")
    if not acc_list:
        raise RuntimeError("No Cloudflare accounts found")

    account_id = acc_list[0].get("id", "")
    if not account_id:
        raise RuntimeError(f"Account has no ID field: {acc_list[0]}")
    account_name = acc_list[0].get("name", "")

    return {
        "success": True,
        "account_id": account_id,
        "account_name": account_name,
        "token_id": token_id,
    }


def cloudflare_list_buckets(api_token: str, account_id: str) -> dict:
    """List R2 buckets in the Cloudflare account."""
    result = _cf_request("GET", f"/accounts/{account_id}/r2/buckets", api_token)
    if not result.get("success"):
        # R2 might not be enabled
        msg = _format_cf_errors(result) or "Unknown error"
        raise RuntimeError(f"Failed to list R2 buckets: {msg}")

    # Cloudflare returns {"result": {"buckets": [...]}} not {"result": [...]}
    result_data = result.get("result", {})
    if isinstance(result_data, dict):
        buckets = result_data.get("buckets", [])
    elif isinstance(result_data, list):
        buckets = result_data
    else:
        buckets = []
    return {
        "success": True,
        "buckets": [b.get("name", "") if isinstance(b, dict) else str(b) for b in buckets if b],
    }


def cloudflare_create_bucket(api_token: str, account_id: str, bucket_name: str) -> dict:
    """Create an R2 bucket in the Cloudflare account."""
    result = _cf_request(
        "POST",
        f"/accounts/{account_id}/r2/buckets",
        api_token,
        data={"name": bucket_name},
    )
    if not result.get("success"):
        msg = _format_cf_errors(result) or "Unknown error"
        raise RuntimeError(f"Failed to create R2 bucket: {msg}")

    return {"success": True, "bucket_name": bucket_name}


def cloudflare_auto_setup(api_token: str, bucket_name: str = "wintools-backup") -> dict:
    """One-click R2 setup: verify token, get account, list/create bucket, derive S3 credentials.

    Derives S3-compatible credentials directly from the user's API token:
    - Access Key ID = token ID (from the verify response)
    - Secret Access Key = SHA-256 of the token value (what the user pasted)

    No sub-token creation needed — the user's own token with R2 permissions
    is used directly for S3 access.

    Returns a dict with account_id, access_key_id, secret_access_key, bucket_name
    that can be directly used as R2 credentials for the Sync tab.
    """
    try:
        # Step 1: Verify token and get account ID + token ID
        print("[R2 Setup] Step 1: Verifying token...")
        verify = cloudflare_verify_token(api_token)
        account_id = verify["account_id"]
        account_name = verify.get("account_name", "")
        token_id = verify.get("token_id", "")
        print(f"[R2 Setup] Token verified. Account: {account_name} ({account_id}), Token ID: {token_id[:8]}...")

        # Derive S3 credentials from the user's own token:
        # Access Key ID = token ID (from /user/tokens/verify)
        # Secret Access Key = SHA-256 of the token value (what the user pasted)
        access_key_id = token_id
        secret_access_key = hashlib.sha256(api_token.encode("utf-8")).hexdigest()

        # Step 2: Check if bucket exists
        print(f"[R2 Setup] Step 2: Checking for bucket '{bucket_name}'...")
        try:
            buckets = cloudflare_list_buckets(api_token, account_id)
            existing = buckets.get("buckets", [])
            print(f"[R2 Setup] Found {len(existing)} existing bucket(s): {existing}")
        except RuntimeError as e:
            # R2 might not be enabled yet
            print(f"[R2 Setup] Failed to list buckets: {e}")
            return {
                "success": False,
                "step": "list_buckets",
                "error": "R2 may not be enabled on your Cloudflare account. Enable R2 in the Cloudflare dashboard first.",
                "account_id": account_id,
                "account_name": account_name,
            }

        bucket_exists = bucket_name in existing

        # Step 3: Create bucket if needed
        if not bucket_exists:
            print(f"[R2 Setup] Step 3: Creating bucket '{bucket_name}'...")
            try:
                cloudflare_create_bucket(api_token, account_id, bucket_name)
                print(f"[R2 Setup] Bucket '{bucket_name}' created successfully")
            except RuntimeError as e:
                print(f"[R2 Setup] Failed to create bucket: {e}")
                return {
                    "success": False,
                    "step": "create_bucket",
                    "error": str(e),
                    "account_id": account_id,
                    "account_name": account_name,
                    "existing_buckets": existing,
                }
        else:
            print(f"[R2 Setup] Bucket '{bucket_name}' already exists")

        print(f"[R2 Setup] Setup complete! Account: {account_id}, Access Key: {access_key_id[:8]}...")
        return {
            "success": True,
            "account_id": account_id,
            "account_name": account_name,
            "access_key_id": access_key_id,
            "secret_access_key": secret_access_key,
            "bucket_name": bucket_name,
            "bucket_created": not bucket_exists,
            "existing_buckets": existing,
        }

    except Exception as e:
        print(f"[R2 Setup] Error ({type(e).__name__}): {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": f"{type(e).__name__}: {e}"}