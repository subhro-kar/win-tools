"""
WinSuite - All-in-One Windows Management Suite
A one-click desktop application for managing, tweaking, and hardening your Windows system.
Similar to Chris Titus WinUtil - runs as a native window on your desktop.
"""

import ctypes
import json
import subprocess
import threading
import time
from pathlib import Path

import webview
from flask import Flask, render_template, jsonify, request

from software_catalog import SOFTWARE_CATALOG, CATEGORY_ORDER, CATEGORY_COLORS
from tweaks import TWEAK_CATEGORIES, get_tweak_by_id
from winoptions import WINOPTION_CATEGORIES, get_winoption_by_id
from privacy import PRIVACY_CATEGORIES, get_privacy_by_id
from quicksetup import QUICKSETUP_CATEGORIES, get_quicksetup_by_id
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
SCAN_WINOPTIONS_SCRIPT = BASE_DIR / "scan-winoptions.ps1"
SCAN_PRIVACY_SCRIPT = BASE_DIR / "scan-privacy.ps1"
SCAN_PRIVACY_APPS_SCRIPT = BASE_DIR / "scan-privacy-apps.ps1"
SCAN_QUICKSETUP_SCRIPT = BASE_DIR / "scan-quicksetup.ps1"
SCAN_ENVVARS_SCRIPT = BASE_DIR / "scan-envvars.ps1"
APPS_JSON = DATA_DIR / "installed-apps.json"
ALLOWLISTS_JSON = DATA_DIR / "allowlists.json"

# Cached tweak states (refreshed on scan)
_tweak_states_cache = {}
_tweak_states_time = 0

# Cached winoption states (refreshed on scan)
_winoption_states_cache = {}
_winoption_states_time = 0

# Cached privacy states (refreshed on scan)
_privacy_states_cache = {}
_privacy_states_time = 0

# Cached quick setup states (refreshed on scan)
_quicksetup_states_cache = {}
_quicksetup_states_time = 0

# Cached env vars states (refreshed on scan)
_envvars_cache = {}
_envvars_cache_time = 0

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


# ── Windows Options State Scanning ──────────────────────────────────────

def scan_winoption_states():
    """Run scan-winoptions.ps1 and return current states of Windows options."""
    global _winoption_states_cache, _winoption_states_time
    # Cache for 30 seconds
    if _winoption_states_cache and (time.time() - _winoption_states_time) < 30:
        return _winoption_states_cache

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(SCAN_WINOPTIONS_SCRIPT)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode == 0 and result.stdout.strip():
            states = json.loads(result.stdout.strip())
            # Convert string "True"/"False" to bool
            for key, val in states.items():
                if isinstance(val.get("is_on"), str):
                    val["is_on"] = val["is_on"].lower() == "true"
            _winoption_states_cache = states
            _winoption_states_time = time.time()
            return states
    except Exception as e:
        print(f"[ERROR] scan-winoption-states: {e}")

    return {}


def apply_winoptions(option_ids, action="apply"):
    """Apply (enable) or revert (disable) selected Windows options."""
    results = {}
    commands = []

    for oid in option_ids:
        opt = get_winoption_by_id(oid)
        if not opt:
            results[oid] = {"success": False, "error": "Unknown option"}
            continue

        # Action-type items only have "run" commands
        if opt.get("type") == "action":
            run_cmds = opt.get("commands", {}).get("run", [])
            if run_cmds:
                combined = "; ".join(run_cmds)
                commands.append((oid, combined, 300))  # longer timeout for actions
            else:
                results[oid] = {"success": False, "error": "No commands defined"}
            continue

        # Toggle-type items use "on" or "off" commands
        tweak_commands = []

        # Build registry commands
        for reg in opt.get("registry", []):
            path = reg["path"]
            name = reg["name"]
            value = reg["value_on"] if action == "apply" else reg["value_off"]
            reg_type = reg.get("type", "REG_DWORD")
            if reg_type == "REG_SZ":
                tweak_commands.append(f'reg add "{path}" /v "{name}" /t {reg_type} /d "{value}" /f')
            else:
                tweak_commands.append(f'reg add "{path}" /v "{name}" /t {reg_type} /d {value} /f')

        # Build service commands
        svc_key = "on" if action == "apply" else "off"
        for svc in opt.get("services", {}).get(svc_key, []):
            svc_name = svc["name"]
            svc_type = svc["startup_type"]
            tweak_commands.append(f"Set-Service -Name '{svc_name}' -StartupType {svc_type}")
            if action == "apply" and svc_type in ("Disabled", "Manual"):
                tweak_commands.append(f"Stop-Service -Name '{svc_name}' -Force -ErrorAction SilentlyContinue")
            elif action == "revert" and svc_type in ("Automatic", "Manual"):
                tweak_commands.append(f"Start-Service -Name '{svc_name}' -ErrorAction SilentlyContinue")

        # Explicit commands
        cmd_key = "on" if action == "apply" else "off"
        for cmd in opt.get("commands", {}).get(cmd_key, []):
            tweak_commands.append(cmd)

        if tweak_commands:
            combined = "; ".join(tweak_commands)
            commands.append((oid, combined, 60))
        else:
            results[oid] = {"success": True, "message": "No commands needed"}

    # Run all commands
    for oid, cmd, timeout in commands:
        try:
            r = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
                capture_output=True, text=True, timeout=timeout,
            )
            if r.returncode == 0:
                opt = get_winoption_by_id(oid)
                msg = "Applied" if action == "apply" else "Reverted"
                if opt and opt.get("reboot_required") and action == "apply":
                    msg += " (reboot required)"
                results[oid] = {"success": True, "message": msg, "output": r.stdout[-500:] if r.stdout else ""}
            else:
                error_msg = r.stderr.strip()[:300] if r.stderr else f"Exit code {r.returncode}"
                results[oid] = {"success": False, "error": error_msg, "output": r.stdout[-500:] if r.stdout else ""}
        except subprocess.TimeoutExpired:
            results[oid] = {"success": False, "error": "Command timed out"}
        except Exception as e:
            results[oid] = {"success": False, "error": str(e)[:200]}

    # Invalidate cache
    global _winoption_states_cache, _winoption_states_time
    _winoption_states_cache = {}
    _winoption_states_time = 0

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

def _get_winget_installed_ids():
    """Run `winget list` and return a set of installed winget package IDs (lowercased).

    Uses the same approach as Chris Titus WinUtil: parse the winget list output
    and match package IDs (like "7zip.7zip", "Microsoft.Edge") by looking for
    entries that contain a dot and are surrounded by whitespace columns.
    """
    try:
        result = subprocess.run(
            ["winget", "list", "--accept-source-agreements", "--disable-interactivity"],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode != 0:
            return set()
        ids = set()
        for line in result.stdout.splitlines():
            # Skip header line and separator lines
            stripped = line.strip()
            if not stripped or stripped.startswith("Name") or stripped.startswith("-"):
                continue
            # winget list output has columns separated by multi-space gaps.
            # The ID column is the second major column and contains dots (e.g., "7zip.7zip").
            # Strategy: find all tokens that look like winget IDs (contain at least one dot
            # and aren't just version numbers like "7.22.5282.0").
            # A winget ID always starts with a letter and contains at least one dot followed
            # by another letter/word (e.g., "Git.Git", "Microsoft.Edge", "CPUID.CPU-Z").
            import re
            for match in re.finditer(r'\b([A-Za-z][\w]*\.[\w.-]+)\b', line):
                candidate = match.group(1)
                # Must contain at least one dot and the part after the first dot must start
                # with a letter (not a digit), to exclude version numbers like "7.22.5282.0"
                parts = candidate.split('.')
                if len(parts) >= 2 and parts[1][0:1].isalpha():
                    ids.add(candidate.lower())
        return ids
    except Exception:
        return set()


# Cache winget IDs so we don't re-run winget list on every catalog request
_winget_installed_cache = None
_winget_installed_cache_time = 0


def get_winget_installed():
    """Return cached set of installed winget package IDs (refreshed every 60 seconds)."""
    global _winget_installed_cache, _winget_installed_cache_time
    if _winget_installed_cache is not None and (time.time() - _winget_installed_cache_time) < 60:
        return _winget_installed_cache
    _winget_installed_cache = _get_winget_installed_ids()
    _winget_installed_cache_time = time.time()
    return _winget_installed_cache


def is_app_installed(catalog_item, installed_names, winget_installed=None):
    """Check if a catalog item is installed.

    Matching strategy (in order of priority):
    1. Winget ID match: if the catalog item has a winget ID and it appears in
       `winget list` output, it's installed. This is the most reliable method.
    2. Exact name match: catalog name exactly equals an installed app name.
    3. Explicit match patterns with word-boundary awareness from the catalog's
       "match" list.
    """
    import re

    # 1. Winget ID match (most reliable)
    if winget_installed is not None and catalog_item.get("id"):
        pkg_id = catalog_item["id"].lower().strip()
        if pkg_id and pkg_id in winget_installed:
            return True

    item_name_lower = catalog_item["name"].lower()

    # 2. Direct exact match (case-insensitive)
    if item_name_lower in installed_names:
        return True

    # 3. Use explicit match patterns with word-boundary awareness
    for pattern in catalog_item.get("match", []):
        pattern_lower = pattern.lower()
        for installed_name in installed_names:
            # Pattern as exact match
            if pattern_lower == installed_name:
                return True
            # Pattern as word-boundary substring
            escaped = re.escape(pattern_lower)
            if re.search(r'(?:^|[^a-z0-9])' + escaped + r'(?:$|[^a-z0-9])', installed_name):
                return True

    return False


@app.route("/api/catalog")
def api_catalog():
    data = load_apps()
    installed_names = set()
    if data:
        for a in data.get("Applications", []):
            installed_names.add(a.get("Name", "").lower())

    # Get winget installed IDs for more reliable detection
    winget_installed = get_winget_installed()

    catalog = []
    for item in SOFTWARE_CATALOG:
        entry = dict(item)
        entry["installed"] = is_app_installed(item, installed_names, winget_installed)
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


@app.route("/api/migrate/r2-download", methods=["POST"])
def api_migrate_r2_download():
    """Download an encrypted bundle from R2 and save it locally for import."""
    credentials = request.json or {}
    object_key = credentials.get("object_key", "")
    if not object_key:
        return jsonify({"success": False, "error": "No object key specified"})

    try:
        result = download_from_r2(credentials, object_key)
        if not result.get("success"):
            return jsonify(result)

        # Save downloaded data to migration-upload.encrypted so the import endpoint can find it
        bundle_path = DATA_DIR / "migration-upload.encrypted"
        bundle_path.write_bytes(result["data"])

        return jsonify({
            "success": True,
            "size": len(result["data"]),
            "object_key": object_key,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})



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
                "risk": tweak.get("risk", "safe"),
                "warning": tweak.get("warning", ""),
                "current_state": state.get("is_on"),
                "current_value": state.get("current_value"),
            }
            result[cat_name]["tweaks"].append(entry)

    # Check if running as admin
    try:
        import ctypes
        is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        is_admin = False

    result["_meta"] = {"is_admin": is_admin}
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


# ── Windows Options Routes ──────────────────────────────────────────────

@app.route("/api/winoptions")
def api_winoptions():
    """Return all Windows option definitions with current states."""
    states = scan_winoption_states()
    result = {}
    for cat_name, cat_data in WINOPTION_CATEGORIES.items():
        result[cat_name] = {
            "icon": cat_data["icon"],
            "description": cat_data["description"],
            "options": [],
        }
        for option in cat_data["options"]:
            state = states.get(option["id"], {"is_on": None, "current_value": None})
            entry = {
                "id": option["id"],
                "name": option["name"],
                "description": option["description"],
                "type": option.get("type", "toggle"),
                "recommended": option.get("recommended", "off"),
                "requires_admin": option.get("requires_admin", False),
                "reboot_required": option.get("reboot_required", False),
                "risk": option.get("risk", "safe"),
                "warning": option.get("warning", ""),
                "current_state": state.get("is_on"),
                "current_value": state.get("current_value"),
            }
            result[cat_name]["options"].append(entry)

    # Check if running as admin
    try:
        import ctypes
        is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        is_admin = False

    result["_meta"] = {"is_admin": is_admin}
    return jsonify(result)


@app.route("/api/winoptions/apply", methods=["POST"])
def api_winoptions_apply():
    """Apply, revert, or run Windows options.
    Body: {"options": ["rdp_toggle", ...], "action": "apply"|"revert"}
    """
    data = request.json or {}
    option_ids = data.get("options", [])
    action = data.get("action", "apply")

    if not option_ids:
        return jsonify({"success": False, "error": "No options selected"})

    results = apply_winoptions(option_ids, action)

    success_count = sum(1 for v in results.values() if v.get("success"))
    fail_count = len(results) - success_count

    # Check if any successful option requires reboot
    reboot_required = False
    for oid in option_ids:
        opt = get_winoption_by_id(oid)
        if opt and opt.get("reboot_required") and results.get(oid, {}).get("success"):
            reboot_required = True

    return jsonify({
        "success": True,
        "results": results,
        "applied": success_count,
        "failed": fail_count,
        "action": action,
        "reboot_required": reboot_required,
    })


# ── Privacy & Security State Scanning ────────────────────────────────────

def scan_privacy_states():
    """Run scan-privacy.ps1 and return current states of privacy settings."""
    global _privacy_states_cache, _privacy_states_time
    # Cache for 30 seconds
    if _privacy_states_cache and (time.time() - _privacy_states_time) < 30:
        return _privacy_states_cache

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(SCAN_PRIVACY_SCRIPT)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode == 0 and result.stdout.strip():
            states = json.loads(result.stdout.strip())
            # Convert string "True"/"False" to bool
            for key, val in states.items():
                if isinstance(val, dict) and "is_on" in val:
                    if isinstance(val["is_on"], str):
                        val["is_on"] = val["is_on"].lower() == "true"
            _privacy_states_cache = states
            _privacy_states_time = time.time()
            return states
    except Exception as e:
        print(f"[ERROR] scan-privacy-states: {e}")

    return {}


def scan_quicksetup_states():
    """Run scan-quicksetup.ps1 and return current states of Quick Setup settings."""
    global _quicksetup_states_cache, _quicksetup_states_time
    # Cache for 30 seconds
    if _quicksetup_states_cache and (time.time() - _quicksetup_states_time) < 30:
        return _quicksetup_states_cache

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(SCAN_QUICKSETUP_SCRIPT)],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode == 0 and result.stdout.strip():
            states = json.loads(result.stdout.strip())
            # Convert string "True"/"False" to bool
            for key, val in states.items():
                if isinstance(val, dict) and "is_on" in val:
                    if isinstance(val["is_on"], str):
                        val["is_on"] = val["is_on"].lower() == "true"
            _quicksetup_states_cache = states
            _quicksetup_states_time = time.time()
            return states
    except Exception as e:
        print(f"[ERROR] scan-quicksetup-states: {e}")

    return {}


def apply_quicksetup_settings(setting_ids, action="apply"):
    """Apply or revert Quick Setup settings."""
    results = {}
    commands = []

    for sid in setting_ids:
        setting = get_quicksetup_by_id(sid)
        if not setting:
            results[sid] = {"success": False, "error": "Unknown setting"}
            continue

        tweak_commands = []

        # Build registry commands
        for reg in setting.get("registry", []):
            path = reg["path"]
            name = reg["name"]
            value = reg["value_on"] if action == "apply" else reg["value_off"]
            reg_type = reg.get("type", "REG_DWORD")

            # Classic context menu uses special handling (key creation/deletion)
            if sid == "qs_classic_context_menu":
                if action == "apply":
                    # Create the key with empty default value
                    tweak_commands.append(f'New-Item -Path "{path}" -Force | Out-Null; Set-ItemProperty -Path "{path}" -Name "(Default)" -Value "" -Force')
                else:
                    # Delete the key
                    tweak_commands.append(f'Remove-Item -Path "HKCU:\\SOFTWARE\\Classes\\CLSID\\{{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}}" -Recurse -Force -ErrorAction SilentlyContinue')
                continue

            if reg_type == "REG_SZ":
                tweak_commands.append(f'reg add "{path}" /v "{name}" /t {reg_type} /d "{value}" /f')
            else:
                tweak_commands.append(f'reg add "{path}" /v "{name}" /t {reg_type} /d {value} /f')

        # Add explicit commands
        cmd_key = "on" if action == "apply" else "off"
        for cmd in setting.get("commands", {}).get(cmd_key, []):
            tweak_commands.append(cmd)

        if tweak_commands:
            combined = "; ".join(tweak_commands)
            commands.append((sid, combined, 30))
        else:
            results[sid] = {"success": True, "message": "No commands needed"}

    # Run all commands
    for sid, cmd, timeout in commands:
        try:
            r = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
                capture_output=True, text=True, timeout=timeout,
            )
            if r.returncode == 0:
                results[sid] = {"success": True, "message": "Applied" if action == "apply" else "Reverted"}
            else:
                results[sid] = {"success": False, "error": r.stderr.strip()[:200]}
        except Exception as e:
            results[sid] = {"success": False, "error": str(e)[:200]}

    # Invalidate cache so next scan reads fresh values
    global _quicksetup_states_cache, _quicksetup_states_time
    _quicksetup_states_cache = {}
    _quicksetup_states_time = 0

    return results


def apply_privacy_settings(setting_ids, action="apply"):
    """Apply or revert selected privacy settings."""
    results = {}
    commands = []

    for sid in setting_ids:
        setting = get_privacy_by_id(sid)
        if not setting:
            results[sid] = {"success": False, "error": "Unknown setting"}
            continue

        if setting.get("type") == "action":
            run_cmds = setting.get("commands", {}).get("run", [])
            if run_cmds:
                combined = "; ".join(run_cmds)
                commands.append((sid, combined, 300))
            else:
                results[sid] = {"success": False, "error": "No commands defined"}
            continue

        tweak_commands = []
        # Build registry commands
        for reg in setting.get("registry", []):
            path = reg["path"]
            name = reg["name"]
            value = reg["value_on"] if action == "apply" else reg["value_off"]
            reg_type = reg.get("type", "REG_DWORD")
            if reg_type == "REG_SZ":
                tweak_commands.append(f'reg add "{path}" /v "{name}" /t {reg_type} /d "{value}" /f')
            else:
                tweak_commands.append(f'reg add "{path}" /v "{name}" /t {reg_type} /d {value} /f')

        # Build service commands
        svc_key = "on" if action == "apply" else "off"
        for svc in setting.get("services", {}).get(svc_key, []):
            svc_name = svc["name"]
            svc_type = svc["startup_type"]
            tweak_commands.append(f"Set-Service -Name '{svc_name}' -StartupType {svc_type} -ErrorAction SilentlyContinue")
            if action == "apply" and svc_type in ("Disabled", "Manual"):
                tweak_commands.append(f"Stop-Service -Name '{svc_name}' -Force -ErrorAction SilentlyContinue")
            elif action == "revert" and svc_type in ("Automatic", "Manual"):
                tweak_commands.append(f"Start-Service -Name '{svc_name}' -ErrorAction SilentlyContinue")

        # Explicit commands
        cmd_key = "on" if action == "apply" else "off"
        for cmd in setting.get("commands", {}).get(cmd_key, []):
            tweak_commands.append(cmd)

        if tweak_commands:
            combined = "; ".join(tweak_commands)
            commands.append((sid, combined, 60))
        else:
            results[sid] = {"success": True, "message": "No commands needed"}

    # Run all commands
    for sid, cmd, timeout in commands:
        try:
            r = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", cmd],
                capture_output=True, text=True, timeout=timeout,
            )
            if r.returncode == 0:
                setting = get_privacy_by_id(sid)
                msg = "Applied" if action == "apply" else "Reverted"
                if setting and setting.get("reboot_required") and action == "apply":
                    msg += " (reboot required)"
                results[sid] = {"success": True, "message": msg, "output": r.stdout[-500:] if r.stdout else ""}
            else:
                error_msg = r.stderr.strip()[:300] if r.stderr else f"Exit code {r.returncode}"
                results[sid] = {"success": False, "error": error_msg, "output": r.stdout[-500:] if r.stdout else ""}
        except subprocess.TimeoutExpired:
            results[sid] = {"success": False, "error": "Command timed out"}
        except Exception as e:
            results[sid] = {"success": False, "error": str(e)[:200]}

    # Invalidate cache
    global _privacy_states_cache, _privacy_states_time
    _privacy_states_cache = {}
    _privacy_states_time = 0

    return results


def load_allowlists():
    """Load allowlists from data/allowlists.json."""
    if not ALLOWLISTS_JSON.exists():
        return {}
    try:
        with open(ALLOWLISTS_JSON, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_allowlists(data):
    """Save allowlists to data/allowlists.json."""
    DATA_DIR.mkdir(exist_ok=True)
    with open(ALLOWLISTS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def _sanitize_reg_value(value):
    """Sanitize a value to prevent command injection in registry commands.

    Strips characters that could break out of quoted arguments in reg.exe commands
    (quotes, semicolons, backticks, dollar signs, pipes, ampersands, etc.).
    """
    import re
    # Remove characters that could escape quoting or chain commands in PowerShell/cmd.exe
    return re.sub(r'[;"`|$&<>!()\n\r]', '', str(value))


def apply_allowlist_entries(setting_id, entries, action="add"):
    """Apply or remove per-app allowlist registry entries for a setting."""
    setting = get_privacy_by_id(setting_id)
    if not setting or not setting.get("allowlist_support"):
        return {"success": False, "error": "Setting does not support allowlists"}

    base_path = setting.get("allowlist_registry")
    if not base_path:
        return {"success": False, "error": "No allowlist registry path defined"}

    # Actually use reg.exe format
    reg_base = base_path

    value_allow = setting.get("allowlist_value_allow", "Allow")
    value_deny = setting.get("allowlist_value_deny", "Deny")

    commands = []
    for entry in entries:
        app_id = _sanitize_reg_value(entry.get("id", ""))
        app_type = entry.get("type", "exe_path")
        app_name = entry.get("name", app_id)

        if not app_id:
            continue

        if action == "add":
            if app_type == "package_family":
                # For packaged apps: HKCU\...\ConsentStore\<capability>\<PackageFamilyName>\Value = Allow
                cmd = f'reg add "{reg_base}\\{app_id}" /v Value /t REG_SZ /d "{value_allow}" /f'
            else:
                # For desktop apps: HKCU\...\ConsentStore\<capability>\NonPackaged\<escaped_path>\Value = Allow
                escaped = app_id.replace("\\", "\\\\")
                cmd = f'reg add "{reg_base}\\NonPackaged\\{escaped}" /v Value /t REG_SZ /d "{value_allow}" /f'
            commands.append(cmd)
        elif action == "remove":
            if app_type == "package_family":
                cmd = f'reg delete "{reg_base}\\{app_id}" /f 2>$null'
            else:
                escaped = app_id.replace("\\", "\\\\")
                cmd = f'reg delete "{reg_base}\\NonPackaged\\{escaped}" /f 2>$null'
            commands.append(cmd)

    if commands:
        combined = "; ".join(commands)
        try:
            r = subprocess.run(
                ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", combined],
                capture_output=True, text=True, timeout=30,
            )
            if r.returncode == 0:
                return {"success": True, "message": f"Allowlist {action}d"}
            else:
                return {"success": False, "error": r.stderr.strip()[:300] if r.stderr else "Registry command failed"}
        except Exception as e:
            return {"success": False, "error": str(e)[:200]}

    return {"success": True, "message": "No changes needed"}


# ── Quick Setup Flask Routes ──────────────────────────────────────────────

@app.route("/api/quicksetup")
def api_quicksetup():
    """Return all Quick Setup categories with current states."""
    states = scan_quicksetup_states()
    result = {}
    for cat_name, cat_data in QUICKSETUP_CATEGORIES.items():
        result[cat_name] = {
            "icon": cat_data["icon"],
            "description": cat_data["description"],
            "settings": [],
        }
        for setting in cat_data["settings"]:
            state = states.get(setting["id"], {"is_on": None, "current_value": None})
            entry = {
                "id": setting["id"],
                "name": setting["name"],
                "description": setting["description"],
                "recommended": setting.get("recommended", "off"),
                "requires_admin": setting.get("requires_admin", False),
                "reboot_required": setting.get("reboot_required", False),
                "risk": setting.get("risk", "safe"),
                "warning": setting.get("warning", ""),
                "current_state": state.get("is_on"),
                "current_value": state.get("current_value"),
            }
            result[cat_name]["settings"].append(entry)

    # Check if running as admin
    try:
        import ctypes
        is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
    except Exception:
        is_admin = False

    result["_meta"] = {"is_admin": is_admin}
    return jsonify(result)


@app.route("/api/quicksetup/apply", methods=["POST"])
def api_quicksetup_apply():
    """Apply or revert Quick Setup settings. Body: {"settings": ["qs_snip_autosave", ...], "action": "apply"|"revert"}"""
    data = request.json or {}
    setting_ids = data.get("settings", [])
    action = data.get("action", "apply")

    if not setting_ids:
        return jsonify({"success": False, "error": "No settings selected"})

    results = apply_quicksetup_settings(setting_ids, action)

    success_count = sum(1 for v in results.values() if v.get("success"))
    fail_count = len(results) - success_count

    return jsonify({
        "success": True,
        "results": results,
        "applied": success_count,
        "failed": fail_count,
        "action": action,
    })


# ── Environment Variables & PATH ──────────────────────────────────────────

def scan_envvars():
    """Run scan-envvars.ps1 and return current environment variables and PATH entries."""
    global _envvars_cache, _envvars_cache_time
    if _envvars_cache and (time.time() - _envvars_cache_time) < 10:
        return _envvars_cache

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(SCAN_ENVVARS_SCRIPT)],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout.strip())
            _envvars_cache = data
            _envvars_cache_time = time.time()
            return data
    except Exception as e:
        print(f"[ERROR] scan_envvars: {e}")

    return {}


def _broadcast_setting_change():
    """Broadcast WM_SETTINGCHANGE so other apps see env var changes."""
    broadcast_cmd = (
        'Add-Type -TypeDefinition "using System;using System.Runtime.InteropServices;'
        "public class Win32Env{"
        "[DllImport('user32.dll',SetLastError=true,CharSet=CharSet.Auto)]"
        "public static extern IntPtr SendMessageTimeout(IntPtr hWnd,uint Msg,UIntPtr wParam,string lParam,uint fuFlags,uint uTimeout,out IntPtr lpdwResult);"
        '}" -PassThru | Out-Null;'
        '$r=[IntPtr]::Zero;'
        '[Win32Env]::SendMessageTimeout([IntPtr]0xffff,0x1a,[UIntPtr]::Zero,"Environment",0x2,5000,[ref]$r)'
    )
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", broadcast_cmd],
            capture_output=True, text=True, timeout=15,
        )
    except Exception:
        pass


# Critical system variables that should not be deleted
_PROTECTED_SYSTEM_VARS = {
    "SYSTEMROOT", "SYSTEMDRIVE", "WINDIR", "COMSPEC", "OS",
    "PROCESSOR_ARCHITECTURE", "PROCESSOR_IDENTIFIER", "PROCESSOR_LEVEL",
    "PROCESSOR_REVISION", "NUMBER_OF_PROCESSORS", "COMPUTERNAME",
    "USERNAME", "USERPROFILE", "HOMEDRIVE", "HOMEPATH",
    "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432",
    "COMMONPROGRAMFILES", "COMMONPROGRAMFILES(X86)", "COMMONPROGRAMW6432",
    "PATH", "PATHEXT", "TEMP", "TMP",
}


@app.route("/api/envvars")
def api_envvars():
    """Return all environment variables and PATH entries."""
    data = scan_envvars()
    if not data:
        return jsonify({"error": "Scan failed"}), 500
    return jsonify(data)


@app.route("/api/envvars/edit", methods=["POST"])
def api_envvars_edit():
    """Set or delete an environment variable. Body: {"name", "value", "scope", "action": "set"|"delete"}"""
    data = request.json or {}
    name = data.get("name", "").strip()
    scope = data.get("scope", "user")
    action = data.get("action", "set")
    value = data.get("value", "")

    if not name:
        return jsonify({"success": False, "error": "Variable name is required"}), 400

    # Validate name — no newlines, null chars, or equals signs
    if any(c in name for c in ["\n", "\r", "\0", "="]):
        return jsonify({"success": False, "error": "Invalid variable name"}), 400

    # Protect critical system variables from deletion
    if action == "delete" and name.upper() in _PROTECTED_SYSTEM_VARS and scope == "system":
        return jsonify({"success": False, "error": f"Cannot delete critical system variable '{name}'"}), 400

    # Check admin for system scope
    if scope == "system":
        try:
            is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
        except Exception:
            is_admin = False
        if not is_admin:
            return jsonify({"success": False, "error": "System variables require administrator privileges"}), 403

    scope_target = "Machine" if scope == "system" else "User"

    # Sanitize name to prevent command injection
    safe_name = _sanitize_reg_value(name)

    # Registry path for the scope
    reg_path = r"HKCU:\Environment" if scope == "user" else r"HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment"

    if action == "delete":
        # For delete, [Environment]::SetEnvironmentVariable is safe (type doesn't matter)
        ps_cmd = f"[Environment]::SetEnvironmentVariable('{safe_name}', $null, '{scope_target}')"
    else:
        # [Environment]::SetEnvironmentVariable() always writes REG_SZ, which
        # destroys %Variable% references (like %SystemRoot% in PATH).
        # Use Set-ItemProperty to preserve REG_EXPAND_SZ type.
        # For long values, use a temp file to avoid command-line length limits.
        safe_value = value.replace("'", "''").replace('"', '`"')

        if len(value) > 3000:
            import tempfile
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
                f.write(value)
                tmp_path = f.name
            ps_cmd = (
                f"$regPath = '{reg_path}';"
                f"$val = Get-Content -Path '{tmp_path}' -Raw;"
                f"$kind = try {{ (Get-Item -LiteralPath $regPath -ErrorAction Stop).GetValueKind('{safe_name}') }} catch {{ 'String' }};"
                f"if ($kind -eq 'ExpandString') {{ Set-ItemProperty -LiteralPath $regPath -Name '{safe_name}' -Value $val -Type ExpandString -Force }}"
                f"else {{ Set-ItemProperty -LiteralPath $regPath -Name '{safe_name}' -Value $val -Type String -Force }};"
                f"Remove-Item '{tmp_path}' -ErrorAction SilentlyContinue"
            )
        else:
            ps_cmd = (
                f"$regPath = '{reg_path}';"
                f"$kind = try {{ (Get-Item -LiteralPath $regPath -ErrorAction Stop).GetValueKind('{safe_name}') }} catch {{ 'String' }};"
                f"if ($kind -eq 'ExpandString') {{ Set-ItemProperty -LiteralPath $regPath -Name '{safe_name}' -Value '{safe_value}' -Type ExpandString -Force }}"
                f"else {{ Set-ItemProperty -LiteralPath $regPath -Name '{safe_name}' -Value '{safe_value}' -Type String -Force }}"
            )

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            _broadcast_setting_change()
            global _envvars_cache, _envvars_cache_time
            _envvars_cache = {}
            _envvars_cache_time = 0
            msg = f"Variable {'deleted' if action == 'delete' else 'set'}: {name}"
            return jsonify({"success": True, "message": msg})
        else:
            error = result.stderr.strip()[:300] if result.stderr else "Unknown error"
            return jsonify({"success": False, "error": error}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)[:200]}), 500


@app.route("/api/envvars/path", methods=["POST"])
def api_envvars_path():
    """Add, remove, or reorder PATH entries. Body: {"action": "add"|"remove"|"reorder", "scope", "path", "paths"}"""
    global _envvars_cache, _envvars_cache_time

    data = request.json or {}
    action = data.get("action", "")
    scope = data.get("scope", "user")
    path_entry = data.get("path", "")
    paths = data.get("paths", [])

    # Check admin for system scope
    if scope == "system":
        try:
            is_admin = ctypes.windll.shell32.IsUserAnAdmin() != 0
        except Exception:
            is_admin = False
        if not is_admin:
            return jsonify({"success": False, "error": "System PATH requires administrator privileges"}), 403

    scope_target = "Machine" if scope == "system" else "User"

    # Read current PATH
    read_cmd = f"[Environment]::GetEnvironmentVariable('PATH', '{scope_target}')"
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", read_cmd],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode != 0:
            return jsonify({"success": False, "error": "Failed to read current PATH"}), 500
        current_path = result.stdout.strip()
    except Exception as e:
        return jsonify({"success": False, "error": str(e)[:200]}), 500

    # Parse current entries
    entries = [e.strip() for e in current_path.split(";") if e.strip()] if current_path else []

    if action == "add":
        # Don't add duplicates (case-insensitive)
        normalized = path_entry.rstrip("\\").lower()
        if any(e.rstrip("\\").lower() == normalized for e in entries):
            return jsonify({"success": False, "error": "Path entry already exists"}), 409
        entries.append(path_entry)

    elif action == "remove":
        normalized = path_entry.rstrip("\\").lower()
        entries = [e for e in entries if e.rstrip("\\").lower() != normalized]

    elif action == "reorder":
        # Validate: supplied paths must be a permutation of current entries
        if paths:
            normalized_current = sorted(e.rstrip("\\").lower() for e in entries)
            normalized_new = sorted(p.strip().rstrip("\\").lower() for p in paths if p.strip())
            if normalized_current != normalized_new:
                return jsonify({"success": False, "error": "PATH has changed since last scan. Please rescan and try again."}), 409
            entries = [p for p in paths if p.strip()]
    else:
        return jsonify({"success": False, "error": f"Unknown action: {action}"}), 400

    # Rebuild PATH string and set it (preserve REG_EXPAND_SZ type)
    new_path = ";".join(entries)

    # Use Set-ItemProperty to preserve REG_EXPAND_SZ (PATH is always REG_EXPAND_SZ)
    reg_path = r"HKCU:\Environment" if scope == "user" else r"HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Environment"

    # Use temp file for PATH values (can be very long)
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
        f.write(new_path)
        tmp_path = f.name

    ps_cmd = (
        f"$val = Get-Content -Path '{tmp_path}' -Raw;"
        f"Set-ItemProperty -LiteralPath '{reg_path}' -Name 'Path' -Value $val -Type ExpandString -Force;"
        f"Remove-Item '{tmp_path}' -ErrorAction SilentlyContinue"
    )

    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps_cmd],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            _broadcast_setting_change()
            _envvars_cache = {}
            _envvars_cache_time = 0
            return jsonify({"success": True, "message": f"PATH {action}d", "entries": len(entries)})
        else:
            error = result.stderr.strip()[:300] if result.stderr else "Unknown error"
            return jsonify({"success": False, "error": error}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)[:200]}), 500


# ── Privacy & Security Flask Routes ──────────────────────────────────────

@app.route("/api/privacy")
def api_privacy():
    """Return all privacy categories with current states."""
    states = scan_privacy_states()
    is_elevated = False
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-Command", "(New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"],
            capture_output=True, text=True, timeout=5,
        )
        if r.returncode == 0 and r.stdout.strip().lower() == "true":
            is_elevated = True
    except Exception:
        pass

    allowlists = load_allowlists()

    result = {}
    for cat_name, cat_data in PRIVACY_CATEGORIES.items():
        result[cat_name] = {
            "icon": cat_data["icon"],
            "description": cat_data["description"],
            "settings": [],
        }
        for setting in cat_data["settings"]:
            entry = dict(setting)
            sid = setting["id"]
            state = states.get(sid, {})
            entry["current_state"] = state.get("is_on")
            entry["current_value"] = state.get("current_value")
            # Add allowlist data if supported
            if setting.get("allowlist_support"):
                entry["allowlist_entries"] = allowlists.get(sid, [])
            result[cat_name]["settings"].append(entry)

    result["_meta"] = {"is_admin": is_elevated}
    return jsonify(result)


@app.route("/api/privacy/apply", methods=["POST"])
def api_privacy_apply():
    """Apply or revert selected privacy settings."""
    data = request.get_json()
    setting_ids = data.get("settings", [])
    action = data.get("action", "apply")

    if not setting_ids:
        return jsonify({"success": False, "error": "No settings selected"})

    results = apply_privacy_settings(setting_ids, action)

    success_count = sum(1 for r in results.values() if r.get("success"))
    fail_count = sum(1 for r in results.values() if not r.get("success"))
    reboot_required = any(
        get_privacy_by_id(sid) and get_privacy_by_id(sid).get("reboot_required")
        for sid in setting_ids
    )

    return jsonify({
        "success": True,
        "results": results,
        "applied": success_count,
        "failed": fail_count,
        "action": action,
        "reboot_required": reboot_required,
    })


@app.route("/api/privacy/allowlist/<setting_id>", methods=["GET"])
def api_privacy_allowlist_get(setting_id):
    """Get allowlist entries for a specific setting."""
    setting = get_privacy_by_id(setting_id)
    if not setting:
        return jsonify({"error": "Setting not found"}), 404
    if not setting.get("allowlist_support"):
        return jsonify({"error": "Setting does not support allowlists"}), 400

    allowlists = load_allowlists()
    entries = allowlists.get(setting_id, [])
    return jsonify({"setting_id": setting_id, "entries": entries})


@app.route("/api/privacy/allowlist/<setting_id>", methods=["POST"])
def api_privacy_allowlist_add(setting_id):
    """Add an app to the allowlist for a setting."""
    setting = get_privacy_by_id(setting_id)
    if not setting:
        return jsonify({"error": "Setting not found"}), 404
    if not setting.get("allowlist_support"):
        return jsonify({"error": "Setting does not support allowlists"}), 400

    data = request.get_json()
    app_name = data.get("name", "")
    app_id = data.get("id", "")
    app_type = data.get("type", "exe_path")

    if not app_id:
        return jsonify({"error": "App ID is required"}), 400

    allowlists = load_allowlists()
    if setting_id not in allowlists:
        allowlists[setting_id] = []

    # Check for duplicates
    for entry in allowlists[setting_id]:
        if entry.get("id") == app_id:
            return jsonify({"error": "App already in allowlist"}), 409

    new_entry = {"name": app_name, "id": app_id, "type": app_type}
    allowlists[setting_id].append(new_entry)
    save_allowlists(allowlists)

    # Apply the registry entry
    result = apply_allowlist_entries(setting_id, [new_entry], action="add")

    return jsonify({
        "success": True,
        "entry": new_entry,
        "registry_result": result,
    })


@app.route("/api/privacy/allowlist/<setting_id>/<path:app_id>", methods=["DELETE"])
def api_privacy_allowlist_remove(setting_id, app_id):
    """Remove an app from the allowlist for a setting."""
    setting = get_privacy_by_id(setting_id)
    if not setting:
        return jsonify({"error": "Setting not found"}), 404

    allowlists = load_allowlists()
    if setting_id not in allowlists:
        return jsonify({"error": "No allowlist entries for this setting"}), 404

    # Find and remove the entry
    entry_to_remove = None
    new_entries = []
    for entry in allowlists[setting_id]:
        if entry.get("id") == app_id:
            entry_to_remove = entry
        else:
            new_entries.append(entry)

    if not entry_to_remove:
        return jsonify({"error": "App not found in allowlist"}), 404

    allowlists[setting_id] = new_entries
    save_allowlists(allowlists)

    # Remove the registry entry
    result = apply_allowlist_entries(setting_id, [entry_to_remove], action="remove")

    return jsonify({
        "success": True,
        "removed": entry_to_remove,
        "registry_result": result,
    })


@app.route("/api/privacy/installed-apps")
def api_privacy_installed_apps():
    """List installed apps available for allowlist picker."""
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(SCAN_PRIVACY_APPS_SCRIPT)],
            capture_output=True, text=True, timeout=60,
        )
        if result.returncode == 0 and result.stdout.strip():
            apps = json.loads(result.stdout.strip())
            return jsonify({"apps": apps, "total": len(apps)})
        return jsonify({"apps": [], "total": 0, "error": result.stderr.strip()[:200] if result.stderr else "Scan failed"})
    except Exception as e:
        return jsonify({"apps": [], "total": 0, "error": str(e)[:200]})


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
    print("  WinSuite - All-in-One Windows Suite")
    print("  Opening in native window...")
    print("=" * 50 + "\n")

    api = Api()
    import uuid
    session_id = uuid.uuid4().hex[:8]
    window = webview.create_window(
        "WinSuite - All-in-One Windows Suite",
        f"http://127.0.0.1:18080/?_={session_id}",
        width=1400,
        height=900,
        min_size=(900, 600),
        resizable=True,
        js_api=api,
    )
    webview.start()
    print("WinSuite closed.")