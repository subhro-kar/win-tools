"""
WinTools - Windows System Management Dashboard
A one-click desktop application for managing your Windows system.
Similar to Chris Titus WinUtil - runs as a native window on your desktop.
"""

import json
import subprocess
import threading
import time
from pathlib import Path

import webview
from flask import Flask, render_template, jsonify, request

from software_catalog import SOFTWARE_CATALOG, CATEGORY_ORDER, CATEGORY_COLORS
from tweaks import TWEAK_CATEGORIES, get_tweak_by_id
from migrate import (
    generate_key, encrypt_data, decrypt_data, create_bundle, extract_bundle,
    get_secrets_summary, test_r2_connection, upload_to_r2, download_from_r2,
    list_r2_backups, apply_restore, cloudflare_auto_setup,
)

# ── Paths ──────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
SCAN_SCRIPT = BASE_DIR / "scan-apps.ps1"
SCAN_TWEAKS_SCRIPT = BASE_DIR / "scan-tweaks.ps1"
APPS_JSON = DATA_DIR / "installed-apps.json"

# Cached tweak states (refreshed on scan)
_tweak_states_cache = {}
_tweak_states_time = 0

app = Flask(
    __name__,
    static_folder=str(BASE_DIR / "static"),
    template_folder=str(BASE_DIR / "templates"),
)

# Disable caching for pywebview — ensures fresh JS/CSS on every load
@app.after_request
def no_cache(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Track install progress
install_queue = {}


# ── Data Loading ────────────────────────────────────────────────────────

def load_apps():
    if not APPS_JSON.exists():
        return None
    with open(APPS_JSON, encoding="utf-8-sig") as f:
        return json.load(f)


def run_scan():
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(SCAN_SCRIPT)],
            capture_output=True, text=True, timeout=180,
        )
        return load_apps()
    except Exception as e:
        return {"error": str(e)}


def run_winget_install(winget_id):
    install_queue[winget_id] = {"status": "installing", "output": "", "percent": 0}
    try:
        process = subprocess.Popen(
            ["winget", "install", "--id", winget_id,
             "--accept-package-agreements", "--accept-source-agreements", "--silent"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
        )
        output_lines = []
        for line in process.stdout:
            output_lines.append(line.strip())
            pct = min(len(output_lines) * 10, 90)
            install_queue[winget_id]["percent"] = pct
            install_queue[winget_id]["output"] = "\n".join(output_lines[-20:])
        process.wait()
        if process.returncode == 0:
            install_queue[winget_id] = {"status": "installed", "output": "\n".join(output_lines[-30:]), "percent": 100}
        else:
            install_queue[winget_id] = {"status": "failed", "output": "\n".join(output_lines[-30:]), "percent": 100, "error": f"Exit code {process.returncode}"}
    except Exception as e:
        install_queue[winget_id] = {"status": "failed", "output": str(e), "percent": 100, "error": str(e)}


# ── Tweak State Scanning ────────────────────────────────────────────────

def scan_tweak_states():
    """Run scan-tweaks.ps1 and return current Windows settings states."""
    global _tweak_states_cache, _tweak_states_time
    # Cache for 30 seconds
    if _tweak_states_cache and (time.time() - _tweak_states_time) < 30:
        return _tweak_states_cache

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(SCAN_TWEAKS_SCRIPT)],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode == 0 and result.stdout.strip():
            states = json.loads(result.stdout.strip())
            # Convert string "True"/"False" to bool
            for key, val in states.items():
                if isinstance(val.get("is_on"), str):
                    val["is_on"] = val["is_on"].lower() == "true"
            _tweak_states_cache = states
            _tweak_states_time = time.time()
            return states
    except Exception as e:
        print(f"[ERROR] scan-tweak-states: {e}")

    return {}


def apply_tweaks(tweak_ids):
    """Apply selected tweaks by running registry commands and service changes."""
    results = {}
    commands = []

    for tid in tweak_ids:
        tweak = get_tweak_by_id(tid)
        if not tweak:
            results[tid] = {"success": False, "error": "Unknown tweak"}
            continue

        tweak_commands = []

        # Build registry commands
        for reg in tweak.get("registry", []):
            path = reg["path"]
            name = reg["name"]
            value = reg["value_on"]
            reg_type = reg.get("type", "REG_DWORD")
            # reg.exe uses HKCU\ or HKLM\ format, PowerShell uses HKCU:\ or HKLM:\
            # For reg.exe, keep backslash format
            if reg_type == "REG_SZ":
                tweak_commands.append(f'reg add "{path}" /v "{name}" /t {reg_type} /d "{value}" /f')
            else:
                tweak_commands.append(f'reg add "{path}" /v "{name}" /t {reg_type} /d {value} /f')

        # Build service commands
        for svc in tweak.get("services", {}).get("on", []):
            svc_name = svc["name"]
            svc_type = svc["startup_type"]
            tweak_commands.append(f"Set-Service -Name '{svc_name}' -StartupType {svc_type}")
            # Also stop the service if disabling
            if svc_type in ("Disabled", "Manual"):
                tweak_commands.append(f"Stop-Service -Name '{svc_name}' -Force -ErrorAction SilentlyContinue")

        # Add explicit commands
        for cmd in tweak.get("commands", {}).get("on", []):
            tweak_commands.append(cmd)

        if tweak_commands:
            combined = "; ".join(tweak_commands)
            commands.append((tid, combined))
        else:
            results[tid] = {"success": True, "message": "No commands needed"}

    # Run all commands via PowerShell
    for tid, cmd in commands:
        try:
            r = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
                capture_output=True, text=True, timeout=30,
            )
            if r.returncode == 0:
                results[tid] = {"success": True, "message": "Applied"}
            else:
                results[tid] = {"success": False, "error": r.stderr.strip()[:200]}
        except Exception as e:
            results[tid] = {"success": False, "error": str(e)[:200]}

    # Invalidate cache so next scan reads fresh values
    _tweak_states_cache = {}
    _tweak_states_time = 0

    return results


def revert_tweaks(tweak_ids):
    """Revert selected tweaks back to their original state."""
    results = {}
    commands = []

    for tid in tweak_ids:
        tweak = get_tweak_by_id(tid)
        if not tweak:
            results[tid] = {"success": False, "error": "Unknown tweak"}
            continue

        tweak_commands = []

        # Build registry commands with value_off
        for reg in tweak.get("registry", []):
            path = reg["path"]
            name = reg["name"]
            value = reg["value_off"]
            reg_type = reg.get("type", "REG_DWORD")
            if reg_type == "REG_SZ":
                tweak_commands.append(f'reg add "{path}" /v "{name}" /t {reg_type} /d "{value}" /f')
            else:
                tweak_commands.append(f'reg add "{path}" /v "{name}" /t {reg_type} /d {value} /f')

        # Build service commands with off values
        for svc in tweak.get("services", {}).get("off", []):
            svc_name = svc["name"]
            svc_type = svc["startup_type"]
            tweak_commands.append(f"Set-Service -Name '{svc_name}' -StartupType {svc_type}")
            if svc_type in ("Automatic", "Manual"):
                tweak_commands.append(f"Start-Service -Name '{svc_name}' -ErrorAction SilentlyContinue")

        # Add off commands
        for cmd in tweak.get("commands", {}).get("off", []):
            tweak_commands.append(cmd)

        if tweak_commands:
            combined = "; ".join(tweak_commands)
            commands.append((tid, combined))
        else:
            results[tid] = {"success": True, "message": "No commands needed"}

    for tid, cmd in commands:
        try:
            r = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
                capture_output=True, text=True, timeout=30,
            )
            if r.returncode == 0:
                results[tid] = {"success": True, "message": "Reverted"}
            else:
                results[tid] = {"success": False, "error": r.stderr.strip()[:200]}
        except Exception as e:
            results[tid] = {"success": False, "error": str(e)[:200]}

    _tweak_states_cache = {}
    _tweak_states_time = 0

    return results


# ── Flask Routes ────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/apps")
def api_apps():
    data = load_apps()
    if not data:
        return jsonify({"error": "No data found. Run a scan first."}), 404
    apps = data.get("Applications", [])
    category = request.args.get("category")
    if category:
        apps = [a for a in apps if a.get("Category") == category]
    arch = request.args.get("arch")
    if arch:
        apps = [a for a in apps if a.get("Architecture") == arch]
    search = request.args.get("search", "").lower()
    if search:
        apps = [a for a in apps if search in a.get("Name", "").lower() or search in a.get("Publisher", "").lower()]
    sort_by = request.args.get("sort", "Name")
    reverse = request.args.get("order", "asc") == "desc"
    if sort_by in ("Name", "Publisher", "Version", "Category", "Architecture", "InstallDate"):
        apps.sort(key=lambda a: a.get(sort_by, "") or "", reverse=reverse)
    elif sort_by == "SizeBytes":
        apps.sort(key=lambda a: a.get("SizeBytes", 0) or 0, reverse=reverse)
    return jsonify({"total": len(apps), "applications": apps})


@app.route("/api/categories")
def api_categories():
    data = load_apps()
    if not data:
        return jsonify({"error": "No data found."}), 404
    return jsonify({"categories": data.get("Categories", []), "total_apps": data.get("TotalApps", 0), "total_size_mb": data.get("TotalSizeMB", 0)})


@app.route("/api/system")
def api_system():
    data = load_apps()
    if not data:
        return jsonify({"error": "No data found."}), 404
    return jsonify(data.get("SystemInfo", {}))


@app.route("/api/scan", methods=["POST"])
def api_scan():
    result = run_scan()
    if result and "error" not in result:
        return jsonify({"success": True, "data": result})
    return jsonify({"success": False, "error": result.get("error", "Unknown error")}), 500


@app.route("/api/export")
def api_export():
    data = load_apps()
    if not data:
        return jsonify({"error": "No data found."}), 404
    apps = data.get("Applications", [])
    selected = request.args.getlist("name")
    if selected:
        apps = [a for a in apps if a.get("Name") in selected]
    grouped = {}
    for a in apps:
        cat = a.get("Category", "Other")
        grouped.setdefault(cat, []).append(a)
    return jsonify({"total": len(apps), "grouped": grouped, "apps": apps})


# ── Install/Uninstall Routes ────────────────────────────────────────────

def is_app_installed(catalog_item, installed_names):
    """Check if a catalog item matches any installed app using fuzzy substring matching."""
    item_name_lower = catalog_item["name"].lower()
    # Direct exact match first
    if item_name_lower in installed_names:
        return True
    # Use explicit match patterns from catalog
    for pattern in catalog_item.get("match", []):
        pattern_lower = pattern.lower()
        for installed_name in installed_names:
            if pattern_lower in installed_name:
                return True
    # Fallback: check if catalog name is a substring of any installed app
    for installed_name in installed_names:
        if item_name_lower in installed_name:
            return True
    return False


@app.route("/api/catalog")
def api_catalog():
    data = load_apps()
    installed_names = set()
    if data:
        for a in data.get("Applications", []):
            installed_names.add(a.get("Name", "").lower())
    catalog = []
    for item in SOFTWARE_CATALOG:
        entry = dict(item)
        entry["installed"] = is_app_installed(item, installed_names)
        catalog.append(entry)
    grouped = {}
    for cat in CATEGORY_ORDER:
        items = [e for e in catalog if e["category"] == cat]
        if items:
            grouped[cat] = items
    for e in catalog:
        if e["category"] not in CATEGORY_ORDER:
            grouped.setdefault(e["category"], []).append(e)
    return jsonify({"categories": grouped, "total": len(catalog), "colors": CATEGORY_COLORS})


@app.route("/api/install/<winget_id>", methods=["POST"])
def api_install(winget_id):
    if not winget_id:
        return jsonify({"success": False, "error": "No winget ID provided"}), 400
    current = install_queue.get(winget_id, {})
    if current.get("status") == "installing":
        return jsonify({"success": False, "error": "Already installing"}), 409
    thread = threading.Thread(target=run_winget_install, args=(winget_id,), daemon=True)
    thread.start()
    return jsonify({"success": True, "message": f"Installing {winget_id}...", "id": winget_id})


@app.route("/api/install-status/<winget_id>")
def api_install_status(winget_id):
    status = install_queue.get(winget_id, {"status": "unknown", "output": "", "percent": 0})
    return jsonify(status)


@app.route("/api/winget-search")
def api_winget_search():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "Provide ?q=search term"}), 400
    try:
        result = subprocess.run(
            ["winget", "search", query, "--accept-source-agreements"],
            capture_output=True, text=True, timeout=30,
        )
        return jsonify({"output": result.stdout, "error": result.stderr, "code": result.returncode})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Migration Routes ────────────────────────────────────────────────────

# Store the current encryption key in memory (never persisted to disk)
_migration_key = None
_migration_manifest = None


@app.route("/api/migrate/scan")
def api_migrate_scan():
    """Scan the current system for migration items."""
    try:
        summary = get_secrets_summary()
        return jsonify(summary)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/migrate/export", methods=["POST"])
def api_migrate_export():
    """Create an encrypted bundle and upload to R2 (or download as file)."""
    global _migration_key, _migration_manifest

    data = request.json or {}
    selected = data.get("items", {})
    destination = data.get("destination", "r2")  # "r2" or "local"
    credentials = data.get("credentials", {})

    try:
        # Reuse existing key if available, otherwise generate new one
        key_path = DATA_DIR / "migration.key"
        if key_path.exists():
            key = key_path.read_bytes()
            _migration_key = key.decode("utf-8")
        else:
            key = generate_key()
            _migration_key = key.decode("utf-8")
            # Save key for future syncs
            key_path.write_bytes(key)

        encrypted, manifest = create_bundle(selected, key)
        _migration_manifest = manifest

        result = {"success": True, "key": _migration_key, "manifest": manifest, "size": len(encrypted)}

        if destination == "r2" and credentials:
            upload_result = upload_to_r2(encrypted, credentials)
            result["upload"] = upload_result

        # Store encrypted bundle temporarily for download
        bundle_path = DATA_DIR / "migration-bundle.encrypted"
        bundle_path.write_bytes(encrypted)
        result["downloadUrl"] = "/api/migrate/download-bundle"

        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/migrate/download-bundle")
def api_migrate_download_bundle():
    """Download the encrypted bundle file."""
    bundle_path = DATA_DIR / "migration-bundle.encrypted"
    if not bundle_path.exists():
        return jsonify({"error": "No bundle available. Run export first."}), 404

    from flask import send_file
    return send_file(bundle_path, as_attachment=True, download_name="wintools-migration.encrypted")


@app.route("/api/migrate/download-key")
def api_migrate_download_key():
    """Download the encryption key file."""
    global _migration_key
    if not _migration_key:
        return jsonify({"error": "No key available. Run export first."}), 404

    from flask import send_file
    import io
    key_bytes = _migration_key.encode("utf-8")
    return send_file(
        io.BytesIO(key_bytes),
        as_attachment=True,
        download_name="wintools-migration.key",
        mimetype="text/plain",
    )


@app.route("/api/migrate/import", methods=["POST"])
def api_migrate_import():
    """Import an encrypted bundle (from R2 or uploaded file)."""
    global _migration_manifest

    data = request.json or {}
    source = data.get("source", "local")  # "r2" or "local"
    credentials = data.get("credentials", {})
    object_key = data.get("objectKey", "")

    try:
        if source == "r2" and credentials:
            dl_result = download_from_r2(credentials, object_key)
            if not dl_result["success"]:
                return jsonify(dl_result), 500
            encrypted_data = dl_result["data"]
        else:
            # Read from uploaded file
            bundle_path = DATA_DIR / "migration-upload.encrypted"
            if not bundle_path.exists():
                return jsonify({"error": "No uploaded bundle found"}), 400
            encrypted_data = bundle_path.read_bytes()

        # Key is provided by the client
        key_str = data.get("key", "")
        if not key_str:
            return jsonify({"error": "Encryption key required"}), 400

        key = key_str.encode("utf-8")
        bundle = extract_bundle(encrypted_data, key)
        _migration_manifest = bundle["manifest"]

        return jsonify({"success": True, "manifest": bundle["manifest"]})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/migrate/upload-bundle", methods=["POST"])
def api_migrate_upload_bundle():
    """Upload an encrypted bundle file for import."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    bundle_path = DATA_DIR / "migration-upload.encrypted"
    file.save(bundle_path)

    return jsonify({"success": True, "size": bundle_path.stat().st_size})


@app.route("/api/migrate/apply", methods=["POST"])
def api_migrate_apply():
    """Apply selected restore items from an imported bundle."""
    global _migration_manifest

    data = request.json or {}
    selected = data.get("items", {})
    key_str = data.get("key", "")
    source = data.get("source", "local")

    try:
        # Load the encrypted bundle
        if source == "local":
            bundle_path = DATA_DIR / "migration-upload.encrypted"
        else:
            bundle_path = DATA_DIR / "migration-bundle.encrypted"

        if not bundle_path.exists():
            return jsonify({"error": "No bundle found. Import first."}), 400

        encrypted_data = bundle_path.read_bytes()
        key = key_str.encode("utf-8")
        bundle = extract_bundle(encrypted_data, key)

        results = apply_restore(bundle, selected)
        return jsonify({"success": True, "results": results})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/migrate/r2-test", methods=["POST"])
def api_migrate_r2_test():
    """Test R2 connection credentials."""
    credentials = request.json or {}
    result = test_r2_connection(credentials)
    return jsonify(result)


@app.route("/api/migrate/r2-list", methods=["POST"])
def api_migrate_r2_list():
    """List available backups in R2."""
    credentials = request.json or {}
    result = list_r2_backups(credentials)
    return jsonify(result)


@app.route("/api/migrate/r2-auto-setup", methods=["POST"])
def api_migrate_r2_auto_setup():
    """One-click R2 setup: verify token, create bucket + scoped R2 token, return S3 credentials."""
    print("[DEBUG] r2-auto-setup called")
    data = request.json or {}
    api_token = data.get("api_token", "")
    bucket_name = data.get("bucket_name", "wintools-backup")

    print(f"[DEBUG] api_token length: {len(api_token)}, bucket_name: {bucket_name}")

    if not api_token:
        return jsonify({"success": False, "error": "Cloudflare API token is required"})

    try:
        result = cloudflare_auto_setup(api_token, bucket_name)
        print(f"[DEBUG] result success: {result.get('success')}, keys: {list(result.keys())}")
        return jsonify(result)
    except Exception as e:
        import traceback
        print(f"[DEBUG] EXCEPTION: {e}")
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Setup failed: {str(e)}"})


@app.route("/api/migrate/r2-credentials", methods=["GET"])
def api_migrate_r2_credentials_load():
    """Load saved R2 credentials from disk."""
    cred_path = DATA_DIR / "r2-credentials.json"
    if not cred_path.exists():
        return jsonify({"connected": False})
    try:
        with open(cred_path, encoding="utf-8") as f:
            creds = json.load(f)
        return jsonify({"connected": True, **creds})
    except Exception:
        return jsonify({"connected": False})


@app.route("/api/migrate/r2-credentials", methods=["POST"])
def api_migrate_r2_credentials_save():
    """Save R2 credentials to disk so they persist across app restarts."""
    data = request.json or {}
    cred_path = DATA_DIR / "r2-credentials.json"
    try:
        with open(cred_path, "w", encoding="utf-8") as f:
            json.dump(data, f)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/migrate/r2-credentials", methods=["DELETE"])
def api_migrate_r2_credentials_delete():
    """Delete saved R2 credentials (disconnect)."""
    cred_path = DATA_DIR / "r2-credentials.json"
    if cred_path.exists():
        cred_path.unlink()
    return jsonify({"success": True})


# ── Tweaks Routes ────────────────────────────────────────────────────────

@app.route("/api/tweaks")
def api_tweaks():
    """Return all tweak definitions with current Windows states."""
    states = scan_tweak_states()
    result = {}
    for cat_name, cat_data in TWEAK_CATEGORIES.items():
        result[cat_name] = {
            "icon": cat_data["icon"],
            "description": cat_data["description"],
            "tweaks": [],
        }
        for tweak in cat_data["tweaks"]:
            state = states.get(tweak["id"], {"is_on": None, "current_value": None})
            entry = {
                "id": tweak["id"],
                "name": tweak["name"],
                "description": tweak["description"],
                "recommended": tweak.get("recommended", "off"),
                "requires_admin": tweak.get("requires_admin", False),
                "script_only": tweak.get("script_only", False),
                "current_state": state.get("is_on"),
                "current_value": state.get("current_value"),
            }
            result[cat_name]["tweaks"].append(entry)
    return jsonify(result)


@app.route("/api/tweaks/apply", methods=["POST"])
def api_tweaks_apply():
    """Apply selected tweaks. Body: {"tweaks": ["dark_mode", ...], "action": "apply"|"revert"}"""
    data = request.json or {}
    tweak_ids = data.get("tweaks", [])
    action = data.get("action", "apply")

    if not tweak_ids:
        return jsonify({"success": False, "error": "No tweaks selected"})

    if action == "revert":
        results = revert_tweaks(tweak_ids)
    else:
        results = apply_tweaks(tweak_ids)

    success_count = sum(1 for v in results.values() if v.get("success"))
    fail_count = len(results) - success_count

    return jsonify({
        "success": True,
        "results": results,
        "applied": success_count,
        "failed": fail_count,
        "action": action,
    })

class Api:
    """JS-callable API for pywebview's window.pywebview.api bridge."""
    def saveFile(self, b64_data, filename):
        """Save base64-encoded data to a file via native save dialog."""
        import base64
        result = webview.windows[0].create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=filename,
            file_types=("Encrypted Files (*.encrypted)", "All Files (*.*)"),
        )
        if result:
            path = result if isinstance(result, str) else result[0]
            with open(path, "wb") as f:
                f.write(base64.b64decode(b64_data))
            return path
        return None

    def saveTextFile(self, text, filename):
        """Save text to a file via native save dialog."""
        result = webview.windows[0].create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=filename,
            file_types=("Key Files (*.key)", "Text Files (*.txt)", "All Files (*.*)"),
        )
        if result:
            path = result if isinstance(result, str) else result[0]
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
            return path
        return None


def start_flask():
    app.run(host="127.0.0.1", port=18080, debug=False, use_reloader=False)


if __name__ == "__main__":
    DATA_DIR.mkdir(exist_ok=True)

    # Clear all WebView2 cache directories so JS/CSS always loads fresh
    import shutil
    import glob
    for cache_dir in glob.glob(str(Path.home() / "AppData" / "Local" / "*" / "WinTools*" / "EBWebView")):
        try:
            shutil.rmtree(cache_dir, ignore_errors=True)
        except Exception:
            pass
    for cache_dir in glob.glob(str(Path.home() / "AppData" / "Local" / "pywebview" / "**" / "EBWebView")):
        try:
            shutil.rmtree(cache_dir, ignore_errors=True)
        except Exception:
            pass

    if not APPS_JSON.exists():
        print("No existing data found. Running initial scan...")
        run_scan()

    flask_thread = threading.Thread(target=start_flask, daemon=True)
    flask_thread.start()
    time.sleep(1.5)

    print("\n" + "=" * 50)
    print("  WinTools Dashboard")
    print("  Opening in native window...")
    print("=" * 50 + "\n")

    api = Api()
    import uuid
    session_id = uuid.uuid4().hex[:8]
    window = webview.create_window(
        "WinTools Dashboard",
        f"http://127.0.0.1:18080/?_={session_id}",
        width=1400,
        height=900,
        min_size=(900, 600),
        resizable=True,
        js_api=api,
    )
    webview.start()
    print("WinTools closed.")