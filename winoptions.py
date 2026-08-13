"""
WinTools - Windows Options & Tools Definitions
Toggle-able Windows features, firewall rules, and one-shot system tools.

Each option defines:
  - type: "toggle" (enable/disable) or "action" (one-shot run)
  - id: unique identifier
  - name: display name
  - description: what it does
  - category: Network & Sharing | Windows Features | Firewall Rules | System Tools
  - commands: {on: [...], off: [...]} for toggles, {run: [...]} for actions
  - recommended: "on" | "off" — suggested state for toggles
  - requires_admin: bool — whether admin privileges are needed
  - reboot_required: bool — whether a reboot is needed after enabling
  - risk: "safe" | "moderate" | "risky"
  - warning: optional string — cautionary text
"""

WINOPTION_CATEGORIES = {
    "Network & Sharing": {
        "icon": "🔀",
        "description": "Enable or disable network services and sharing features",
        "options": [
            {
                "type": "toggle",
                "id": "rdp_toggle",
                "name": "Remote Desktop (RDP)",
                "description": "Enable Remote Desktop Protocol and its firewall rules for remote access",
                "commands": {
                    "on": [
                        "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server' -Name 'fDenyTSConnections' -Value 0 -Type DWord",
                        "Enable-NetFirewallRule -DisplayGroup 'Remote Desktop'",
                    ],
                    "off": [
                        "Set-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Terminal Server' -Name 'fDenyTSConnections' -Value 1 -Type DWord",
                        "Disable-NetFirewallRule -DisplayGroup 'Remote Desktop'",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "moderate",
                "warning": "Opens port 3389 for remote connections. Only enable if needed and behind a firewall.",
            },
            {
                "type": "toggle",
                "id": "file_sharing",
                "name": "File & Printer Sharing",
                "description": "Allow file and printer sharing over the network via SMB/CIFS",
                "commands": {
                    "on": [
                        "Enable-NetFirewallRule -DisplayGroup 'File and Printer Sharing'",
                        "Set-SmbServerConfiguration -EnableSMB2Protocol $true -Force -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-NetFirewallRule -DisplayGroup 'File and Printer Sharing'",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "moderate",
                "warning": "Enables SMB file sharing. Disable on public networks.",
            },
            {
                "type": "toggle",
                "id": "network_discovery",
                "name": "Network Discovery",
                "description": "Allow this PC to be found on the network and discover other devices",
                "commands": {
                    "on": [
                        "Enable-NetFirewallRule -DisplayGroup 'Network Discovery'",
                    ],
                    "off": [
                        "Disable-NetFirewallRule -DisplayGroup 'Network Discovery'",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "safe",
            },
            {
                "type": "toggle",
                "id": "smb_sharing",
                "name": "SMB File Sharing Server",
                "description": "Enable the SMB server service for sharing folders on the network",
                "commands": {
                    "on": [
                        "Set-SmbServerConfiguration -EnableSMB2Protocol $true -Force -ErrorAction SilentlyContinue",
                        "Set-Service -Name 'LanmanServer' -StartupType Automatic -ErrorAction SilentlyContinue",
                        "Start-Service -Name 'LanmanServer' -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Stop-Service -Name 'LanmanServer' -Force -ErrorAction SilentlyContinue",
                        "Set-Service -Name 'LanmanServer' -StartupType Disabled -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "moderate",
                "warning": "Stops file sharing. Shared folders will become inaccessible.",
            },
            {
                "type": "toggle",
                "id": "ps_remoting",
                "name": "PowerShell Remoting",
                "description": "Enable WinRM service and PS remoting for remote PowerShell access",
                "commands": {
                    "on": [
                        "Enable-PSRemoting -Force -ErrorAction SilentlyContinue",
                        "Enable-NetFirewallRule -Name 'WINRM-HTTP-In-TCP' -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-PSRemoting -Force -ErrorAction SilentlyContinue",
                        "Stop-Service -Name 'WinRM' -Force -ErrorAction SilentlyContinue",
                        "Set-Service -Name 'WinRM' -StartupType Disabled -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "risky",
                "warning": "Opens WinRM port 5985 for remote management. Only enable on trusted networks.",
            },
            {
                "type": "toggle",
                "id": "icmp_ping",
                "name": "ICMP Echo (Ping)",
                "description": "Allow incoming ping requests (ICMP Echo Request)",
                "commands": {
                    "on": [
                        "Enable-NetFirewallRule -Name 'VMICMP-No-Limit' -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-NetFirewallRule -Name 'VMICMP-No-Limit' -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "safe",
            },
        ],
    },
    "Windows Features": {
        "icon": "📦",
        "description": "Enable or disable optional Windows features (may require reboot)",
        "options": [
            {
                "type": "toggle",
                "id": "wsl",
                "name": "Windows Subsystem for Linux",
                "description": "Install WSL to run Linux distributions natively on Windows",
                "commands": {
                    "on": [
                        "Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart -ErrorAction SilentlyContinue",
                        "dism /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /NoRestart /Quiet 2>$null",
                    ],
                    "off": [
                        "Disable-WindowsOptionalFeature -Online -FeatureName Microsoft-Windows-Subsystem-Linux -NoRestart -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": True,
                "risk": "safe",
                "warning": "Requires a reboot to complete installation.",
            },
            {
                "type": "toggle",
                "id": "hyperv",
                "name": "Hyper-V",
                "description": "Enable Hyper-V virtualization platform for running virtual machines",
                "commands": {
                    "on": [
                        "Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -All -NoRestart -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V -NoRestart -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": True,
                "risk": "moderate",
                "warning": "Requires a reboot. Conflicts with other hypervisors (VirtualBox older versions).",
            },
            {
                "type": "toggle",
                "id": "virtual_machine_platform",
                "name": "Virtual Machine Platform",
                "description": "Enable Virtual Machine Platform (required for WSL2 and Hyper-V)",
                "commands": {
                    "on": [
                        "Enable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform -NoRestart -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": True,
                "risk": "safe",
                "warning": "Requires a reboot to complete.",
            },
            {
                "type": "toggle",
                "id": "sandbox",
                "name": "Windows Sandbox",
                "description": "Enable Windows Sandbox for running isolated applications safely",
                "commands": {
                    "on": [
                        "Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -NoRestart -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -NoRestart -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": True,
                "risk": "safe",
                "warning": "Requires a reboot. Only available on Windows Pro/Enterprise.",
            },
            {
                "type": "toggle",
                "id": "dotnet35",
                "name": ".NET Framework 3.5",
                "description": "Install .NET Framework 3.5 (required by many legacy applications)",
                "commands": {
                    "on": [
                        "Enable-WindowsOptionalFeature -Online -FeatureName NetFx3 -NoRestart -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-WindowsOptionalFeature -Online -FeatureName NetFx3 -NoRestart -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "on",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "safe",
            },
            {
                "type": "toggle",
                "id": "telnet_client",
                "name": "Telnet Client",
                "description": "Install the Telnet client for testing network connectivity",
                "commands": {
                    "on": [
                        "Enable-WindowsOptionalFeature -Online -FeatureName TelnetClient -NoRestart -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-WindowsOptionalFeature -Online -FeatureName TelnetClient -NoRestart -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "safe",
            },
            {
                "type": "toggle",
                "id": "iis",
                "name": "Internet Information Services (IIS)",
                "description": "Install IIS web server for hosting websites and web apps locally",
                "commands": {
                    "on": [
                        "Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer -NoRestart -ErrorAction SilentlyContinue",
                        "Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerManagementTools -NoRestart -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-WindowsOptionalFeature -Online -FeatureName IIS-WebServer -NoRestart -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "moderate",
                "warning": "Installs a web server. Only enable if you develop or host websites locally.",
            },
            {
                "type": "toggle",
                "id": "windows_defender_application_guard",
                "name": "Microsoft Defender Application Guard",
                "description": "Run untrusted websites in an isolated Hyper-V container for Edge",
                "commands": {
                    "on": [
                        "Enable-WindowsOptionalFeature -Online -FeatureName Windows-Defender-ApplicationGuard -NoRestart -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-WindowsOptionalFeature -Online -FeatureName Windows-Defender-ApplicationGuard -NoRestart -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": True,
                "risk": "moderate",
                "warning": "Requires Hyper-V. Reboot needed after install.",
            },
        ],
    },
    "Firewall Rules": {
        "icon": "🔥",
        "description": "Manage Windows Firewall rules for inbound and outbound traffic",
        "options": [
            {
                "type": "toggle",
                "id": "fw_rdp_inbound",
                "name": "RDP Inbound (Port 3389)",
                "description": "Allow inbound Remote Desktop connections through the firewall",
                "commands": {
                    "on": [
                        "Enable-NetFirewallRule -DisplayGroup 'Remote Desktop' -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-NetFirewallRule -DisplayGroup 'Remote Desktop' -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "moderate",
                "warning": "Opens port 3389. Ensure strong passwords if enabled.",
            },
            {
                "type": "toggle",
                "id": "fw_ssh_inbound",
                "name": "SSH Inbound (Port 22)",
                "description": "Allow inbound SSH connections through the firewall (OpenSSH server)",
                "commands": {
                    "on": [
                        "Enable-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue",
                        "if (-not (Get-NetFirewallRule -DisplayName 'OpenSSH Server (sshd)' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -LocalPort 22 -ErrorAction SilentlyContinue }",
                    ],
                    "off": [
                        "Disable-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -ErrorAction SilentlyContinue",
                        "Remove-NetFirewallRule -DisplayName 'OpenSSH Server (sshd)' -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "moderate",
                "warning": "Opens port 22 for SSH access.",
            },
            {
                "type": "toggle",
                "id": "fw_ftp_inbound",
                "name": "FTP Inbound (Port 21)",
                "description": "Allow inbound FTP connections through the firewall",
                "commands": {
                    "on": [
                        "Enable-NetFirewallRule -DisplayGroup 'FTP Server' -ErrorAction SilentlyContinue",
                        "if (-not (Get-NetFirewallRule -DisplayName 'FTP Inbound' -ErrorAction SilentlyContinue)) { New-NetFirewallRule -DisplayName 'FTP Inbound' -Enabled True -Direction Inbound -Protocol TCP -LocalPort 21 -ErrorAction SilentlyContinue }",
                    ],
                    "off": [
                        "Disable-NetFirewallRule -DisplayGroup 'FTP Server' -ErrorAction SilentlyContinue",
                        "Remove-NetFirewallRule -DisplayName 'FTP Inbound' -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "risky",
                "warning": "FTP transmits data in cleartext. Consider SFTP/SCP instead.",
            },
            {
                "type": "toggle",
                "id": "fw_ping_inbound",
                "name": "ICMP Echo Request (Ping)",
                "description": "Allow inbound ping (ICMP Echo Request) through the firewall",
                "commands": {
                    "on": [
                        "Enable-NetFirewallRule -Name 'VMICMP-No-Limit' -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-NetFirewallRule -Name 'VMICMP-No-Limit' -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "safe",
            },
            {
                "type": "toggle",
                "id": "fw_network_discovery",
                "name": "Network Discovery Rules",
                "description": "Allow this device to be discovered and discover other devices on the network",
                "commands": {
                    "on": [
                        "Enable-NetFirewallRule -DisplayGroup 'Network Discovery' -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-NetFirewallRule -DisplayGroup 'Network Discovery' -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "safe",
            },
            {
                "type": "toggle",
                "id": "fw_file_printer_sharing",
                "name": "File & Printer Sharing Rules",
                "description": "Allow file and printer sharing through the firewall (SMB ports 139, 445)",
                "commands": {
                    "on": [
                        "Enable-NetFirewallRule -DisplayGroup 'File and Printer Sharing' -ErrorAction SilentlyContinue",
                    ],
                    "off": [
                        "Disable-NetFirewallRule -DisplayGroup 'File and Printer Sharing' -ErrorAction SilentlyContinue",
                    ],
                },
                "recommended": "off",
                "requires_admin": True,
                "reboot_required": False,
                "risk": "moderate",
                "warning": "Opens SMB ports 139 and 445. Disable on public networks.",
            },
        ],
    },
    "System Tools": {
        "icon": "🔧",
        "description": "One-click system maintenance and repair tools",
        "options": [
            {
                "type": "action",
                "id": "create_restore_point",
                "name": "Create Restore Point",
                "description": "Create a system restore point before making changes",
                "commands": {
                    "run": [
                        "Checkpoint-Computer -Description 'WinTools Restore Point' -RestorePointType MODIFY_SETTINGS",
                    ],
                },
                "requires_admin": True,
                "risk": "safe",
            },
            {
                "type": "action",
                "id": "sfc_scan",
                "name": "System File Checker (SFC)",
                "description": "Scan and repair corrupted Windows system files",
                "commands": {
                    "run": [
                        "sfc /scannow",
                    ],
                },
                "requires_admin": True,
                "risk": "safe",
            },
            {
                "type": "action",
                "id": "dism_repair",
                "name": "DISM Online Repair",
                "description": "Repair Windows component store using DISM (may take several minutes)",
                "commands": {
                    "run": [
                        "DISM /Online /Cleanup-Image /RestoreHealth",
                    ],
                },
                "requires_admin": True,
                "risk": "safe",
                "warning": "This can take 10-20 minutes and requires internet access to download replacement files.",
            },
            {
                "type": "action",
                "id": "disk_cleanup",
                "name": "Disk Cleanup",
                "description": "Run Windows Disk Cleanup to free up disk space",
                "commands": {
                    "run": [
                        "cleanmgr /sagerun:1",
                    ],
                },
                "requires_admin": False,
                "risk": "safe",
            },
            {
                "type": "action",
                "id": "disk_defrag",
                "name": "Optimize Drives (Defrag)",
                "description": "Optimize and defragment all drives",
                "commands": {
                    "run": [
                        "Optimize-Volume -DriveLetter C -Defrag -Verbose -ErrorAction SilentlyContinue",
                    ],
                },
                "requires_admin": True,
                "risk": "safe",
                "warning": "Do not run on SSDs frequently — TRIM is automatic. Best for HDDs.",
            },
            {
                "type": "action",
                "id": "check_disk",
                "name": "Check Disk (CHKDSK)",
                "description": "Check the C: drive for file system errors and bad sectors",
                "commands": {
                    "run": [
                        "chkdsk C: /scan",
                    ],
                },
                "requires_admin": True,
                "risk": "safe",
            },
            {
                "type": "action",
                "id": "clear_temp",
                "name": "Clear Temp Files",
                "description": "Delete files in Windows Temp and user Temp folders",
                "commands": {
                    "run": [
                        "Remove-Item -Path \"$env:TEMP\\*\" -Recurse -Force -ErrorAction SilentlyContinue",
                        "Remove-Item -Path 'C:\\Windows\\Temp\\*' -Recurse -Force -ErrorAction SilentlyContinue",
                    ],
                },
                "requires_admin": True,
                "risk": "safe",
                "warning": "Closes any programs using temp files. Some files may be locked and skipped.",
            },
            {
                "type": "action",
                "id": "flush_dns",
                "name": "Flush DNS Cache",
                "description": "Clear the DNS resolver cache to fix connectivity issues",
                "commands": {
                    "run": [
                        "ipconfig /flushdns",
                    ],
                },
                "requires_admin": True,
                "risk": "safe",
            },
            {
                "type": "action",
                "id": "reset_network",
                "name": "Reset Network Adapters",
                "description": "Reset all network adapters to fix connectivity issues (may disconnect Wi-Fi)",
                "commands": {
                    "run": [
                        "netsh winsock reset",
                        "netsh int ip reset",
                        "ipconfig /release",
                        "ipconfig /renew",
                        "ipconfig /flushdns",
                    ],
                },
                "requires_admin": True,
                "risk": "moderate",
                "warning": "Will temporarily disconnect all network connections. Reconnect to Wi-Fi after.",
            },
        ],
    },
}


def get_all_winoptions():
    """Return a flat list of all winoptions with their category."""
    result = []
    for cat_name, cat_data in WINOPTION_CATEGORIES.items():
        for opt in cat_data["options"]:
            result.append({**opt, "category": cat_name, "category_icon": cat_data["icon"]})
    return result


def get_winoption_by_id(opt_id):
    """Find a winoption by its ID."""
    for cat_name, cat_data in WINOPTION_CATEGORIES.items():
        for opt in cat_data["options"]:
            if opt["id"] == opt_id:
                return {**opt, "category": cat_name}
    return None