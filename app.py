"""
WinTools - Windows System Management Dashboard
A one-click desktop application for managing your Windows system.
"""

import json
import os
import subprocess
import sys
import threading
import webview
from pathlib import Path

from flask import Flask, render_template, jsonify, request

from software_catalog import SOFTWARE_CATALOG, CATEGORY_ORDER

# ── Paths ──────────────────────────────────────────────────────────────

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
SCAN_SCRIPT = BASE_DIR / "install-log.txt"
APPS_JSON = DATA_DIR / "installed-apps.json"

app = Flask(
    __name__,
    static_folder=str(BASE_DIR / "static"),
    template_folder=str(BASE_DIR / "templates"),
)

# Track install progress
install_queue = {}  # id -> {status, output, percent}


# ── Data Loading ────────────────────────────────────────────────────────

def load_apps():
    if not APPS_JSON.exists():
        return None
    with open(APPS_JSON, encoding="utf-8-sig") as f:
        return json.load(f)


def save_apps(data):
    DATA_DIR.mkdir(exist_ok=True)
    with open(APPS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def run_scan():
    try:
        script = BASE_DIR / "scan-apps.ps1"
        result = subprocess.run(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script)],
            capture_output=True, text=True, timeout=180,
        )
        return load_apps()
    except Exception as e:
        return {"error": str(e)}


def run_winget_install(winget_id):
    """Install a package using winget and track progress."""
    install_queue[winget_id] = {"status": "installing", "output": "", "percent": 0}

    try:
        process = subprocess.Popen(
            [
                "winget", "install",
                "--id", winget_id,
                "--accept-package-agreements",
                "--accept-source-agreements",
                "--silent",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        output_lines = []
        for line in process.stdout:
            output_lines.append(line.strip())
            # Update progress heuristically
            pct = min(len(output_lines) * 10, 90)
            install_queue[winget_id]["percent"] = pct
            install_queue[winget_id]["output"] = "\n".join(output_lines[-20:])

        process.wait()

        if process.returncode == 0:
            install_queue[winget_id] = {
                "status": "installed",
                "output": "\n".join(output_lines[-30:]),
                "percent": 100,
            }
        else:
            install_queue[winget_id] = {
                "status": "failed",
                "output": "\n".join(output_lines[-30:]),
                "percent": 100,
                "error": f"Exit code {process.returncode}",
            }
    except Exception as e:
        install_queue[winget_id] = {
            "status": "failed",
            "output": str(e),
            "percent": 100,
            "error": str(e),
        }


def run_winget_uninstall(winget_id):
    """Uninstall a package using winget."""
    install_queue[f"uninstall_{winget_id}"] = {"status": "uninstalling", "output": "", "percent": 0}

    try:
        process = subprocess.run(
            [
                "winget", "uninstall",
                "--id", winget_id,
                "--accept-source-agreements",
            ],
            capture_output=True, text=True, timeout=120,
        )

        install_queue[f"uninstall_{winget_id}"] = {
            "status": "uninstalled" if process.returncode == 0 else "failed",
            "output": (process.stdout + process.stderr)[-500:],
            "percent": 100,
        }
        return process.returncode == 0
    except Exception as e:
        install_queue[f"uninstall_{winget_id}"] = {
            "status": "failed",
            "output": str(e),
            "percent": 100,
            "error": str(e),
        }
        return False


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
    return jsonify({
        "categories": data.get("Categories", []),
        "total_apps": data.get("TotalApps", 0),
        "total_size_mb": data.get("TotalSizeMB", 0),
    })


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

@app.route("/api/catalog")
def api_catalog():
    """Return the software catalog organized by category."""
    # Check which are already installed
    data = load_apps()
    installed_names = set()
    if data:
        for a in data.get("Applications", []):
            installed_names.add(a.get("Name", "").lower())

    catalog = []
    for item in SOFTWARE_CATALOG:
        entry = dict(item)
        entry["installed"] = item["name"].lower() in installed_names
        catalog.append(entry)

    # Group by category in order
    grouped = {}
    for cat in CATEGORY_ORDER:
        items = [e for e in catalog if e["category"] == cat]
        if items:
            grouped[cat] = items
    # Add any uncategorized
    for e in catalog:
        if e["category"] not in CATEGORY_ORDER:
            grouped.setdefault(e["category"], []).append(e)

    return jsonify({"categories": grouped, "total": len(catalog)})


@app.route("/api/install/<winget_id>", methods=["POST"])
def api_install(winget_id):
    """Install a package by winget ID (runs in background)."""
    if not winget_id:
        return jsonify({"success": False, "error": "No winget ID provided"}), 400

    # Check if already installing
    current = install_queue.get(winget_id, {})
    if current.get("status") == "installing":
        return jsonify({"success": False, "error": "Already installing"}), 409

    # Start install in background thread
    thread = threading.Thread(target=run_winget_install, args=(winget_id,), daemon=True)
    thread.start()

    return jsonify({"success": True, "message": f"Installing {winget_id}...", "id": winget_id})


@app.route("/api/install-status/<winget_id>")
def api_install_status(winget_id):
    """Check install progress."""
    status = install_queue.get(winget_id, {"status": "unknown", "output": "", "percent": 0})
    return jsonify(status)


@app.route("/api/uninstall/<winget_id>", methods=["POST"])
def api_uninstall(winget_id):
    """Uninstall a package by winget ID."""
    key = f"uninstall_{winget_id}"
    thread = threading.Thread(target=run_winget_uninstall, args=(winget_id,), daemon=True)
    thread.start()
    return jsonify({"success": True, "message": f"Uninstalling {winget_id}...", "key": key})


@app.route("/api/winget-search")
def api_winget_search():
    """Search for packages in winget."""
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


# ── Flask Server Thread ──────────────────────────────────────────────────

def start_flask():
    app.run(host="127.0.0.1", port=18080, debug=False, use_reloader=False)


# ── Main ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    DATA_DIR.mkdir(exist_ok=True)

    if not APPS_JSON.exists():
        print("No existing data found. Running initial scan...")
        run_scan()

    flask_thread = threading.Thread(target=start_flask, daemon=True)
    flask_thread.start()

    import time
    time.sleep(1.5)

    print("\n" + "=" * 50)
    print("  WinTools Dashboard")
    print("  Opening in native window...")
    print("=" * 50 + "\n")

    window = webview.create_window(
        "WinTools Dashboard",
        "http://127.0.0.1:18080",
        width=1400,
        height=900,
        min_size=(900, 600),
        resizable=True,
    )
    webview.start()

    print("WinTools closed.")