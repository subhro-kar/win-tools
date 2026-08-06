# WinTools - Scan current Windows option states
# Reads firewall rules, Windows features, service states, and outputs JSON to stdout
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scan-winoptions.ps1

$ErrorActionPreference = "SilentlyContinue"
$output = @{}

# ── Helper: Check if a firewall rule group is enabled ───────────────────
function Test-FirewallGroupEnabled {
    param([string]$DisplayGroup)
    $rules = Get-NetFirewallRule -DisplayGroup $DisplayGroup -ErrorAction SilentlyContinue
    if ($null -eq $rules -or $rules.Count -eq 0) {
        return @{ is_on = $null; current_value = "no_rules_found" }
    }
    # A group is "on" if at least one rule in it is enabled
    $enabledCount = ($rules | Where-Object { $_.Enabled -eq $true -or $_.Enabled -eq 'True' }).Count
    $totalCount = $rules.Count
    if ($enabledCount -gt 0) {
        return @{ is_on = $true; current_value = "$enabledCount/$totalCount rules enabled" }
    } else {
        return @{ is_on = $false; current_value = "0/$totalCount rules enabled" }
    }
}

# ── Helper: Check if a specific firewall rule is enabled ─────────────────
function Test-FirewallRuleEnabled {
    param([string]$Name)
    $rule = Get-NetFirewallRule -Name $Name -ErrorAction SilentlyContinue
    if ($null -ne $rule) {
        $enabled = $rule.Enabled -eq $true -or $rule.Enabled -eq 'True'
        return @{ is_on = $enabled; current_value = "$($rule.Enabled)" }
    }
    return @{ is_on = $null; current_value = $null }
}

# ── Helper: Check if a Windows optional feature is enabled ──────────────
function Test-WindowsFeature {
    param([string]$FeatureName)
    try {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName $FeatureName -ErrorAction SilentlyContinue
        if ($null -ne $feature) {
            $isEnabled = $feature.State -eq "Enabled"
            return @{ is_on = $isEnabled; current_value = "$($feature.State)" }
        }
    } catch {
        # Requires admin
    }
    return @{ is_on = $null; current_value = "need_admin" }
}

# ═══════════════════════════════════════════════════════════════════════
# ── Network & Sharing ──────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

# RDP Toggle
$rdpDeny = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -ErrorAction SilentlyContinue).fDenyTSConnections
if ($null -ne $rdpDeny) {
    # Also check firewall
    $rdpFw = Test-FirewallGroupEnabled "Remote Desktop"
    $output["rdp_toggle"] = @{
        is_on = ($rdpDeny -eq 0 -and $rdpFw.is_on -eq $true)
        current_value = "RDP: $(if ($rdpDeny -eq 0) {'Enabled'} else {'Disabled'}), Firewall: $($rdpFw.current_value)"
    }
} else {
    $output["rdp_toggle"] = @{ is_on = $null; current_value = $null }
}

# File & Printer Sharing
$output["file_sharing"] = Test-FirewallGroupEnabled "File and Printer Sharing"

# Network Discovery
$output["network_discovery"] = Test-FirewallGroupEnabled "Network Discovery"

# SMB Sharing (LanmanServer service)
$smbSvc = (Get-Service -Name "LanmanServer" -ErrorAction SilentlyContinue)
if ($null -ne $smbSvc) {
    $smbRunning = $smbSvc.Status -eq "Running" -and $smbSvc.StartType -ne "Disabled"
    $output["smb_sharing"] = @{
        is_on = $smbRunning
        current_value = "Status: $($smbSvc.Status), StartType: $($smbSvc.StartType)"
    }
} else {
    $output["smb_sharing"] = @{ is_on = $null; current_value = $null }
}

# PowerShell Remoting (WinRM service)
$winrmSvc = (Get-Service -Name "WinRM" -ErrorAction SilentlyContinue)
if ($null -ne $winrmSvc) {
    $winrmRunning = $winrmSvc.Status -eq "Running" -and $winrmSvc.StartType -ne "Disabled"
    $output["ps_remoting"] = @{
        is_on = $winrmRunning
        current_value = "Status: $($winrmSvc.Status), StartType: $($winrmSvc.StartType)"
    }
} else {
    $output["ps_remoting"] = @{ is_on = $null; current_value = $null }
}

# ICMP Ping
$output["icmp_ping"] = Test-FirewallRuleEnabled "VMICMP-No-Limit"

# ═══════════════════════════════════════════════════════════════════════
# ── Windows Features ────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

$output["wsl"] = Test-WindowsFeature "Microsoft-Windows-Subsystem-Linux"
$output["hyperv"] = Test-WindowsFeature "Microsoft-Hyper-V"
$output["virtual_machine_platform"] = Test-WindowsFeature "VirtualMachinePlatform"
$output["sandbox"] = Test-WindowsFeature "Containers-DisposableClientVM"
$output["dotnet35"] = Test-WindowsFeature "NetFx3"
$output["telnet_client"] = Test-WindowsFeature "TelnetClient"
$output["iis"] = Test-WindowsFeature "IIS-WebServer"
$output["windows_defender_application_guard"] = Test-WindowsFeature "Windows-Defender-ApplicationGuard"

# ═══════════════════════════════════════════════════════════════════════
# ── Firewall Rules ─────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

$output["fw_rdp_inbound"] = Test-FirewallGroupEnabled "Remote Desktop"

# SSH inbound
$sshRule = Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP" -ErrorAction SilentlyContinue
if ($null -ne $sshRule) {
    $sshEnabled = $sshRule.Enabled -eq $true -or $sshRule.Enabled -eq 'True'
    $output["fw_ssh_inbound"] = @{ is_on = $sshEnabled; current_value = "$($sshRule.Enabled)" }
} else {
    # Check if a custom rule was created
    $customSsh = Get-NetFirewallRule -DisplayName "OpenSSH Server (sshd)" -ErrorAction SilentlyContinue
    if ($null -ne $customSsh) {
        $output["fw_ssh_inbound"] = @{ is_on = $true; current_value = "Custom rule active" }
    } else {
        $output["fw_ssh_inbound"] = @{ is_on = $null; current_value = $null }
    }
}

# FTP inbound
$ftpResult = Test-FirewallGroupEnabled "FTP Server"
if ($ftpResult.is_on -eq $null) {
    # Check for custom FTP rule
    $customFtp = Get-NetFirewallRule -DisplayName "FTP Inbound" -ErrorAction SilentlyContinue
    if ($null -ne $customFtp) {
        $output["fw_ftp_inbound"] = @{ is_on = $true; current_value = "Custom rule active" }
    } else {
        $output["fw_ftp_inbound"] = $ftpResult
    }
} else {
    $output["fw_ftp_inbound"] = $ftpResult
}

$output["fw_ping_inbound"] = Test-FirewallRuleEnabled "VMICMP-No-Limit"
$output["fw_network_discovery"] = Test-FirewallGroupEnabled "Network Discovery"
$output["fw_file_printer_sharing"] = Test-FirewallGroupEnabled "File and Printer Sharing"

# ═══════════════════════════════════════════════════════════════════════
# ── System Tools (actions — no persistent state) ────────────────────────
# ═══════════════════════════════════════════════════════════════════════

$output["create_restore_point"] = @{ is_on = $null; current_value = "action" }
$output["sfc_scan"] = @{ is_on = $null; current_value = "action" }
$output["dism_repair"] = @{ is_on = $null; current_value = "action" }
$output["disk_cleanup"] = @{ is_on = $null; current_value = "action" }
$output["disk_defrag"] = @{ is_on = $null; current_value = "action" }
$output["check_disk"] = @{ is_on = $null; current_value = "action" }
$output["clear_temp"] = @{ is_on = $null; current_value = "action" }
$output["flush_dns"] = @{ is_on = $null; current_value = "action" }
$output["reset_network"] = @{ is_on = $null; current_value = "action" }

# ── Output JSON ────────────────────────────────────────────────────────

$jsonOutput = @{}
foreach ($key in $output.Keys) {
    $val = $output[$key]
    $jsonOutput[$key] = @{
        is_on = $val.is_on
        current_value = if ($val.current_value -ne $null) { "$($val.current_value)" } else { $null }
    }
}

$jsonOutput | ConvertTo-Json -Depth 3