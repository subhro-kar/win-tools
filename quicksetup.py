"""
WinSuite - Quick Setup Definitions
One-click settings for fresh Windows 11 installs.
Settings that users commonly want to change right after a fresh install.

Each setting defines:
  - id: unique identifier
  - name: display name
  - description: what it does
  - category: which group it belongs to
  - registry: list of {path, name, type, value_on, value_off} entries
  - commands: optional {on: [...], off: [...]} PowerShell commands
  - recommended: "on" | "off" — suggested state for a clean setup
  - requires_admin: bool — whether admin privileges are needed
  - reboot_required: bool — whether a reboot is needed after enabling
  - risk: "safe" | "moderate" | "risky"
  - warning: optional string — cautionary text
"""

QUICKSETUP_CATEGORIES = {
    "Snipping & Screenshots": {
        "icon": "📸",
        "description": "Fix Snipping Tool and screenshot settings",
        "settings": [
            {
                "id": "qs_snip_autosave",
                "name": "Disable Snipping Tool Auto-Save",
                "description": "Stop Snipping Tool from auto-saving screenshots so you can choose where to save and it remembers your last folder",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\ScreenSketch",
                        "name": "IsAutoSaveToClipboardEnabled",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
                "reboot_required": False,
                "risk": "safe",
                "warning": "Auto-saved screenshots go to a default folder. Disabling lets you choose the save location each time.",
            },
            {
                "id": "qs_snip_edited_save",
                "name": "Ask to Save Edited Screenshots",
                "description": "Prompt before saving edited screenshots instead of auto-saving",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\ScreenSketch",
                        "name": "IsAskToSaveOnCloseEnabled",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
                "reboot_required": False,
                "risk": "safe",
            },
            {
                "id": "qs_print_screen_snipping",
                "name": "Use Print Screen for Snipping Tool",
                "description": "Override Print Screen key to open Snipping Tool instead of capturing the full screen",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "SnippingToolWithPrintScreen",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
                "reboot_required": False,
                "risk": "safe",
            },
        ],
    },
    "File Explorer": {
        "icon": "📁",
        "description": "Fix File Explorer defaults",
        "settings": [
            {
                "id": "qs_open_to_this_pc",
                "name": "Open Explorer to This PC",
                "description": "Default Explorer to This PC instead of Quick Access / Home",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "LaunchTo",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
                "reboot_required": False,
                "risk": "safe",
            },
            {
                "id": "qs_classic_context_menu",
                "name": "Enable Classic Context Menu",
                "description": "Restore the full right-click menu in Windows 11 (skip 'Show more options')",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32",
                        "name": "(Default)",
                        "type": "REG_SZ",
                        "value_on": "",
                        "value_off": "",
                    },
                ],
                "commands": {
                    "on": [r"New-Item -Path 'HKCU:\SOFTWARE\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\SOFTWARE\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32' -Name '(Default)' -Value '' -Force"],
                    "off": [r"Remove-Item -Path 'HKCU:\SOFTWARE\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}' -Recurse -Force -ErrorAction SilentlyContinue"],
                },
                "recommended": "on",
                "requires_admin": False,
                "reboot_required": True,
                "risk": "safe",
                "warning": "Requires restarting Explorer or logging out to take effect.",
            },
        ],
    },
    "Taskbar & Start": {
        "icon": "🖥️",
        "description": "Clean up the taskbar and Start menu",
        "settings": [
            {
                "id": "qs_hide_copilot",
                "name": "Hide Copilot from Taskbar",
                "description": "Remove the Copilot button from the Windows taskbar",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "ShowCopilotButton",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
                "reboot_required": False,
                "risk": "safe",
            },
        ],
    },
    "Power & Startup": {
        "icon": "🔋",
        "description": "Power and startup settings",
        "settings": [
            {
                "id": "qs_disable_fast_startup",
                "name": "Disable Fast Startup",
                "description": "Fast Startup causes dual-boot issues, hibernation file bloat, and update problems",
                "registry": [
                    {
                        "path": r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power",
                        "name": "HiberbootEnabled",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": True,
                "reboot_required": True,
                "risk": "moderate",
                "warning": "Disabling Fast Startup means cold boots take slightly longer, but it fixes dual-boot issues and Windows Update problems.",
            },
            {
                "id": "qs_high_performance",
                "name": "Set High Performance Power Plan",
                "description": "Switch from Balanced to High Performance power plan for maximum performance",
                "commands": {
                    "on": ["powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c735c"],
                    "off": ["powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e"],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "moderate",
                "warning": "Increases power consumption. Not recommended for laptops on battery.",
            },
        ],
    },
}


def get_all_quicksetup():
    """Return a flat list of all Quick Setup settings with their category."""
    result = []
    for cat_name, cat_data in QUICKSETUP_CATEGORIES.items():
        for setting in cat_data["settings"]:
            result.append({**setting, "category": cat_name, "category_icon": cat_data["icon"]})
    return result


def get_quicksetup_by_id(setting_id):
    """Find a Quick Setup setting by its ID."""
    for cat_name, cat_data in QUICKSETUP_CATEGORIES.items():
        for setting in cat_data["settings"]:
            if setting["id"] == setting_id:
                return {**setting, "category": cat_name}
    return None