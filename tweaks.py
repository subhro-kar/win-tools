"""
WinTools - Windows Tweaks Definitions
Registry tweaks and PowerShell commands for customizing Windows settings.
Inspired by Chris Titus WinUtil's tweaks system.

Each tweak defines:
  - id: unique identifier
  - name: display name
  - description: what it does
  - category: Personalization | Privacy & Telemetry | Performance & Power | Security & Updates
  - registry: list of {path, name, type, value_on, value_off} entries
  - commands: optional {on: [...], off: [...]} PowerShell commands (instead of or in addition to registry)
  - services: optional {on: [{name, startup_type}], off: [{name, startup_type}]} service changes
  - recommended: "on" | "off" — suggested state for a clean setup
  - requires_admin: bool — whether HKLM or elevated commands are needed
  - script_only: bool — if true, can only be applied via exported script, not live
"""

TWEAK_CATEGORIES = {
    "Personalization": {
        "icon": "🎨",
        "description": "Customize Windows look & feel",
        "tweaks": [
            {
                "id": "dark_mode",
                "name": "Dark Theme",
                "description": "Switch Windows and apps to dark mode",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                        "name": "AppsUseLightTheme",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize",
                        "name": "SystemUsesLightTheme",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "show_file_extensions",
                "name": "Show File Extensions",
                "description": "Always show file extensions in Explorer",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "HideFileExt",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "show_hidden_files",
                "name": "Show Hidden Files",
                "description": "Show hidden files and folders in Explorer",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "Hidden",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "off",
                "requires_admin": False,
            },
            {
                "id": "taskbar_centered",
                "name": "Centered Taskbar Icons",
                "description": "Align taskbar icons to center (Windows 11 style)",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "TaskbarAl",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "taskbar_search_icon",
                "name": "Taskbar Search Icon",
                "description": "Show search as a small icon instead of search box on taskbar",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Search",
                        "name": "SearchboxTaskbarMode",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 2,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "taskbar_taskview",
                "name": "Hide Task View Button",
                "description": "Remove Task View button from taskbar",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "ShowTaskViewButton",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "taskbar_widgets",
                "name": "Hide Widgets",
                "description": "Remove Widgets button from taskbar",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "TaskbarDa",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "taskbar_chat",
                "name": "Hide Chat Icon",
                "description": "Remove Chat / Microsoft Teams icon from taskbar",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "TaskbarMn",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "lock_screen_disable",
                "name": "Disable Lock Screen",
                "description": "Skip the lock screen on boot, go straight to login",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Policies\Microsoft\Windows\Personalization",
                        "name": "NoLockScreen",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "off",
                "requires_admin": True,
            },
            {
                "id": "start_menu_recommendations",
                "name": "Disable Start Recommendations",
                "description": "Remove recommended/recent files section from Start menu",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "Start_IrisRecommendations",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "bing_search_start",
                "name": "Disable Bing in Start Menu",
                "description": "Remove web search results from Start menu search",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Policies\Microsoft\Windows\Explorer",
                        "name": "BingSearchEnabled",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "verbose_logon",
                "name": "Verbose Logon Messages",
                "description": "Show detailed status messages during startup/shutdown",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System",
                        "name": "VerboseStatus",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "off",
                "requires_admin": True,
            },
            {
                "id": "numlock_startup",
                "name": "NumLock on Startup",
                "description": "Enable NumLock by default on boot",
                "registry": [
                    {
                        "path": r"HKCU\Control Panel\Keyboard",
                        "name": "InitialKeyboardIndicators",
                        "type": "REG_SZ",
                        "value_on": "2",
                        "value_off": "0",
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
        ],
    },
    "Privacy & Telemetry": {
        "icon": "🔒",
        "description": "Reduce data collection and tracking",
        "tweaks": [
            {
                "id": "disable_ad_id",
                "name": "Disable Advertising ID",
                "description": "Prevent Windows from using a unique advertising ID for tracking",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo",
                        "name": "Enabled",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "disable_telemetry",
                "name": "Disable Telemetry",
                "description": "Stop Windows from sending diagnostic data to Microsoft",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Policies\Microsoft\Windows\DataCollection",
                        "name": "AllowTelemetry",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "services": {
                    "on": [
                        {"name": "DiagTrack", "startup_type": "Disabled"},
                        {"name": "wermgr", "startup_type": "Disabled"},
                    ],
                    "off": [
                        {"name": "DiagTrack", "startup_type": "Automatic"},
                        {"name": "wermgr", "startup_type": "Automatic"},
                    ],
                },
                "commands": {
                    "on": ["[Environment]::SetEnvironmentVariable('POWERSHELL_TELEMETRY_OPTOUT', '1', 'Machine')"],
                    "off": ["[Environment]::SetEnvironmentVariable('POWERSHELL_TELEMETRY_OPTOUT', '', 'Machine')"],
                },
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_location",
                "name": "Disable Location Tracking",
                "description": "Prevent apps from accessing your location",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location",
                        "name": "Value",
                        "type": "REG_SZ",
                        "value_on": "Deny",
                        "value_off": "Allow",
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "disable_activity_history",
                "name": "Disable Activity History",
                "description": "Stop Windows from tracking your activity timeline",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Policies\Microsoft\Windows\System",
                        "name": "EnableActivityFeed",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_diagnostic_data",
                "name": "Limit Diagnostic Data",
                "description": "Stop sending tailored experiences diagnostic data to Microsoft",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Privacy",
                        "name": "TailoredExperiencesWithDiagnosticDataEnabled",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "disable_clipboard_history",
                "name": "Disable Clipboard History",
                "description": "Prevent clipboard content from being saved across sessions",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Policies\Microsoft\Windows\System",
                        "name": "AllowClipboardHistory",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "off",
                "requires_admin": True,
            },
            {
                "id": "disable_online_speech",
                "name": "Disable Online Speech Recognition",
                "description": "Prevent sending voice data to Microsoft for online speech recognition",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Speech_OneCore\Settings\OnlineSpeechPrivacy",
                        "name": "HasAccepted",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "disable_input_personalization",
                "name": "Disable Input Personalization",
                "description": "Stop Windows from learning your typing and inking patterns",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Input\TIPC",
                        "name": "Enabled",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\InputPersonalization",
                        "name": "RestrictImplicitInkCollection",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\InputPersonalization",
                        "name": "RestrictImplicitTextCollection",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "disable_defender_samples",
                "name": "Disable Defender Sample Submission",
                "description": "Prevent Windows Defender from sending file samples to Microsoft",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Spynet",
                        "name": "SubmitSamplesConsent",
                        "type": "REG_DWORD",
                        "value_on": 2,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_consumer_features",
                "name": "Disable Consumer Features",
                "description": "Remove Microsoft Store app suggestions and consumer experiences",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Policies\Microsoft\Windows\CloudContent",
                        "name": "DisableWindowsConsumerFeatures",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_wpbt",
                "name": "Disable Windows Platform Binary Table",
                "description": "Prevent OEM boot-time code from executing (security & privacy risk)",
                "registry": [
                    {
                        "path": r"HKLM\SYSTEM\CurrentControlSet\Control\Session Manager",
                        "name": "DisableWpbtExecution",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_delivery_optimization",
                "name": "Disable Delivery Optimization",
                "description": "Stop Windows from using your bandwidth to share updates with other PCs",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization",
                        "name": "DODownloadMode",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 3,
                    },
                ],
                "recommended": "on",
                "requires_admin": True,
            },
        ],
    },
    "Performance & Power": {
        "icon": "⚡",
        "description": "Speed up Windows and reduce resource usage",
        "tweaks": [
            {
                "id": "disable_hibernation",
                "name": "Disable Hibernation",
                "description": "Free up disk space by removing hiberfil.sys (saves several GB on SSD)",
                "registry": [
                    {
                        "path": r"HKLM\SYSTEM\CurrentControlSet\Control\Power",
                        "name": "HibernateEnabled",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "commands": {
                    "on": ["powercfg /hibernate off"],
                    "off": ["powercfg /hibernate on"],
                },
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "services_manual",
                "name": "Set Non-Essential Services to Manual",
                "description": "Change unnecessary services from Auto to Manual start (DiagTrack, MapsBroker, StorSvc, SharedAccess)",
                "services": {
                    "on": [
                        {"name": "DiagTrack", "startup_type": "Manual"},
                        {"name": "MapsBroker", "startup_type": "Manual"},
                        {"name": "StorSvc", "startup_type": "Manual"},
                        {"name": "SharedAccess", "startup_type": "Manual"},
                    ],
                    "off": [
                        {"name": "DiagTrack", "startup_type": "Automatic"},
                        {"name": "MapsBroker", "startup_type": "Automatic"},
                        {"name": "StorSvc", "startup_type": "Automatic"},
                        {"name": "SharedAccess", "startup_type": "Automatic"},
                    ],
                },
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_animations",
                "name": "Disable Animations",
                "description": "Turn off window and taskbar animations for snappier feel",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "TaskbarAnimations",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                    {
                        "path": r"HKCU\Control Panel\Desktop",
                        "name": "MenuShowDelay",
                        "type": "REG_SZ",
                        "value_on": "0",
                        "value_off": "400",
                    },
                    {
                        "path": r"HKCU\Control Panel\Desktop",
                        "name": "WindowArrangementActive",
                        "type": "REG_SZ",
                        "value_on": "0",
                        "value_off": "1",
                    },
                ],
                "recommended": "off",
                "requires_admin": False,
            },
            {
                "id": "disable_aero_peek",
                "name": "Disable Aero Peek",
                "description": "Disable desktop preview on taskbar hover (show desktop shortcut)",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "DisablePreviewDesktop",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": False,
            },
            {
                "id": "disable_indexing",
                "name": "Disable Search Indexing",
                "description": "Stop Windows Search indexing to reduce CPU and disk usage",
                "services": {
                    "on": [
                        {"name": "WSearch", "startup_type": "Disabled"},
                    ],
                    "off": [
                        {"name": "WSearch", "startup_type": "Automatic"},
                    ],
                },
                "commands": {
                    "on": ["Stop-Service -Name WSearch -Force -ErrorAction SilentlyContinue"],
                    "off": ["Start-Service -Name WSearch -ErrorAction SilentlyContinue"],
                },
                "recommended": "off",
                "requires_admin": True,
            },
            {
                "id": "disable_sysmain",
                "name": "Disable SysMain (Superfetch)",
                "description": "Disable SysMain to reduce disk and CPU usage, especially on HDDs",
                "services": {
                    "on": [
                        {"name": "SysMain", "startup_type": "Disabled"},
                    ],
                    "off": [
                        {"name": "SysMain", "startup_type": "Automatic"},
                    ],
                },
                "commands": {
                    "on": ["Stop-Service -Name SysMain -Force -ErrorAction SilentlyContinue"],
                    "off": ["Start-Service -Name SysMain -ErrorAction SilentlyContinue"],
                },
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_storage_sense",
                "name": "Disable Storage Sense",
                "description": "Prevent automatic disk cleanup that may delete files unexpectedly",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy",
                        "name": "01",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "off",
                "requires_admin": False,
            },
            {
                "id": "enable_long_paths",
                "name": "Enable Long Paths",
                "description": "Remove the 260-character path length limit (requires admin)",
                "registry": [
                    {
                        "path": r"HKLM\SYSTEM\CurrentControlSet\Control\FileSystem",
                        "name": "LongPathsEnabled",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_auto_folder_discovery",
                "name": "Disable Explorer Auto Folder Discovery",
                "description": "Stop Explorer from automatically changing folder type templates",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "DisallowShaping",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced",
                        "name": "FolderType",
                        "type": "REG_SZ",
                        "value_on": "NotSpecified",
                        "value_off": "",
                    },
                ],
                "recommended": "off",
                "requires_admin": False,
            },
            {
                "id": "ultimate_performance",
                "name": "Ultimate Performance Power Plan",
                "description": "Enable the hidden Ultimate Performance power plan for max performance",
                "commands": {
                    "on": [
                        "powercfg /duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 2>$null | ForEach-Object { powercfg /setactive $_.ToString().Trim() }",
                    ],
                    "off": [
                        "powercfg /setactive 381b4222-f694-41f0-9685-ff5bb260df2e",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "script_only": True,
            },
            {
                "id": "disk_cleanup",
                "name": "Run Disk Cleanup",
                "description": "Run Windows Disk Cleanup utility to free up disk space",
                "commands": {
                    "on": ["cleanmgr /sagerun:1"],
                    "off": [],
                },
                "recommended": "off",
                "requires_admin": True,
                "script_only": True,
            },
            {
                "id": "disable_fullscreen_opt",
                "name": "Disable Fullscreen Optimizations",
                "description": "Improve game performance by disabling FSO for borderless windowed mode",
                "registry": [
                    {
                        "path": r"HKCU\System\GameConfigStore",
                        "name": "GameDVR_DXGIHonorFSEWindowsCompatible",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "off",
                "requires_admin": False,
            },
        ],
    },
    "Security & Updates": {
        "icon": "🛡️",
        "description": "Strengthen Windows security posture",
        "tweaks": [
            {
                "id": "disable_copilot",
                "name": "Disable Windows AI (Copilot)",
                "description": "Disable Copilot and AI features in Windows",
                "registry": [
                    {
                        "path": r"HKCU\SOFTWARE\Policies\Microsoft\Windows\WindowsAI",
                        "name": "DisableAIDataAnalysis",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "commands": {
                    "on": [
                        "Get-AppxPackage -Name 'Microsoft.Windows.Ai.Copilot.Provider' -ErrorAction SilentlyContinue | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue",
                    ],
                    "off": [],
                },
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_smb1",
                "name": "Disable SMBv1 Protocol",
                "description": "Disable the legacy SMBv1 protocol (security risk, used by WannaCry)",
                "registry": [
                    {
                        "path": r"HKLM\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters",
                        "name": "SMB1",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_autorun",
                "name": "Disable AutoRun",
                "description": "Prevent automatic execution when inserting USB drives or CDs",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer",
                        "name": "NoAutoplay",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                    {
                        "path": r"HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\AutoplayHandlers",
                        "name": "DisableAutoplay",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "disable_rdp",
                "name": "Disable Remote Desktop",
                "description": "Disable Remote Desktop Protocol for improved security",
                "registry": [
                    {
                        "path": r"HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server",
                        "name": "fDenyTSConnections",
                        "type": "REG_DWORD",
                        "value_on": 1,
                        "value_off": 0,
                    },
                ],
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "set_ntp",
                "name": "Set NTP Time Server",
                "description": "Configure Windows to sync time from pool.ntp.org for accurate time",
                "commands": {
                    "on": [
                        "w32tm /config /manualpeerlist:pool.ntp.org /syncfromflags:manual /update",
                        "w32tm /resync",
                    ],
                    "off": [
                        "w32tm /config /syncfromflags:domhier /update",
                        "w32tm /resync",
                    ],
                },
                "recommended": "on",
                "requires_admin": True,
            },
            {
                "id": "enable_dns_over_https",
                "name": "Enable DNS-over-HTTPS",
                "description": "Encrypt DNS queries for privacy (requires supported DNS provider)",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient",
                        "name": "EnableAutoDoh",
                        "type": "REG_DWORD",
                        "value_on": 2,
                        "value_off": 0,
                    },
                ],
                "recommended": "off",
                "requires_admin": True,
            },
            {
                "id": "disable_razer_auto",
                "name": "Block Razer Software Auto-Install",
                "description": "Prevent Razer software from auto-installing when plugging in Razer devices",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Policies\Microsoft\Windows\DeviceInstall\Settings",
                        "name": "AllowDeviceInstallations",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "off",
                "requires_admin": True,
            },
            {
                "id": "enable_bitlocker",
                "name": "Enable BitLocker",
                "description": "Encrypt drives with BitLocker (requires TPM, runs as script only)",
                "commands": {
                    "on": [
                        "Enable-BitLocker -MountPoint 'C:' -EncryptionMethod XtsAes256 -UsedSpaceOnly -SkipHardwareTest",
                    ],
                    "off": [
                        "Disable-BitLocker -MountPoint 'C:'",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "script_only": True,
            },
            {
                "id": "disable_rdp_unsigned_warnings",
                "name": "Disable RDP Unsigned File Warnings",
                "description": "Remove warnings when opening unsigned RDP files",
                "registry": [
                    {
                        "path": r"HKLM\SOFTWARE\Policies\Microsoft\Windows\Safer\CodeIdentifiers",
                        "name": "AuthenticodeEnabled",
                        "type": "REG_DWORD",
                        "value_on": 0,
                        "value_off": 1,
                    },
                ],
                "recommended": "off",
                "requires_admin": True,
            },
            {
                "id": "create_restore_point",
                "name": "Create Restore Point",
                "description": "Create a system restore point before making changes (runs as script only)",
                "commands": {
                    "on": [
                        "Checkpoint-Computer -Description 'WinTools Pre-Tweak Restore Point' -RestorePointType MODIFY_SETTINGS",
                    ],
                    "off": [],
                },
                "recommended": "on",
                "requires_admin": True,
                "script_only": True,
            },
        ],
    },
}


def get_all_tweaks():
    """Return a flat list of all tweaks with their category."""
    result = []
    for cat_name, cat_data in TWEAK_CATEGORIES.items():
        for tweak in cat_data["tweaks"]:
            result.append({**tweak, "category": cat_name, "category_icon": cat_data["icon"]})
    return result


def get_tweak_by_id(tweak_id):
    """Find a tweak by its ID."""
    for cat_name, cat_data in TWEAK_CATEGORIES.items():
        for tweak in cat_data["tweaks"]:
            if tweak["id"] == tweak_id:
                return {**tweak, "category": cat_name}
    return None