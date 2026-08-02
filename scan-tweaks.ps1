# WinTools - Scan current Windows tweak states
# Reads registry values and service states, outputs JSON to stdout
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scan-tweaks.ps1

$ErrorActionPreference = "SilentlyContinue"
$output = @{}

# ── Personalization ──────────────────────────────────────────────────

# Dark Mode
$themePath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Themes\Personalize"
$appsTheme = (Get-ItemProperty -Path $themePath -Name "AppsUseLightTheme" -ErrorAction SilentlyContinue).AppsUseLightTheme
$sysTheme = (Get-ItemProperty -Path $themePath -Name "SystemUsesLightTheme" -ErrorAction SilentlyContinue).SystemUsesLightTheme
# dark_mode is "on" if both are 0 (dark)
if ($null -ne $appsTheme -and $null -ne $sysTheme) {
    $output["dark_mode"] = @{ is_on = ($appsTheme -eq 0 -and $sysTheme -eq 0); current_value = $appsTheme }
} else {
    $output["dark_mode"] = @{ is_on = $null; current_value = $null }
}

# Show File Extensions
$advPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced"
$hideFileExt = (Get-ItemProperty -Path $advPath -Name "HideFileExt" -ErrorAction SilentlyContinue).HideFileExt
if ($null -ne $hideFileExt) {
    $output["show_file_extensions"] = @{ is_on = ($hideFileExt -eq 0); current_value = $hideFileExt }
} else {
    $output["show_file_extensions"] = @{ is_on = $null; current_value = $null }
}

# Show Hidden Files
$hiddenFiles = (Get-ItemProperty -Path $advPath -Name "Hidden" -ErrorAction SilentlyContinue).Hidden
if ($null -ne $hiddenFiles) {
    $output["show_hidden_files"] = @{ is_on = ($hiddenFiles -eq 1); current_value = $hiddenFiles }
} else {
    $output["show_hidden_files"] = @{ is_on = $null; current_value = $null }
}

# Taskbar Centered
$taskbarAl = (Get-ItemProperty -Path $advPath -Name "TaskbarAl" -ErrorAction SilentlyContinue).TaskbarAl
if ($null -ne $taskbarAl) {
    $output["taskbar_centered"] = @{ is_on = ($taskbarAl -eq 1); current_value = $taskbarAl }
} else {
    $output["taskbar_centered"] = @{ is_on = $null; current_value = $null }
}

# Taskbar Search Icon
$searchPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search"
$searchMode = (Get-ItemProperty -Path $searchPath -Name "SearchboxTaskbarMode" -ErrorAction SilentlyContinue).SearchboxTaskbarMode
if ($null -ne $searchMode) {
    # value_on=1 (icon), value_off=2 (search box). "on" means icon mode (1 or 0)
    $output["taskbar_search_icon"] = @{ is_on = ($searchMode -le 1); current_value = $searchMode }
} else {
    $output["taskbar_search_icon"] = @{ is_on = $null; current_value = $null }
}

# Taskbar Task View
$taskView = (Get-ItemProperty -Path $advPath -Name "ShowTaskViewButton" -ErrorAction SilentlyContinue).ShowTaskViewButton
if ($null -ne $taskView) {
    # value_on=0 (hide), so "on" means it IS hidden
    $output["taskbar_taskview"] = @{ is_on = ($taskView -eq 0); current_value = $taskView }
} else {
    $output["taskbar_taskview"] = @{ is_on = $null; current_value = $null }
}

# Taskbar Widgets
$taskbarDa = (Get-ItemProperty -Path $advPath -Name "TaskbarDa" -ErrorAction SilentlyContinue).TaskbarDa
if ($null -ne $taskbarDa) {
    $output["taskbar_widgets"] = @{ is_on = ($taskbarDa -eq 0); current_value = $taskbarDa }
} else {
    $output["taskbar_widgets"] = @{ is_on = $null; current_value = $null }
}

# Taskbar Chat
$taskbarMn = (Get-ItemProperty -Path $advPath -Name "TaskbarMn" -ErrorAction SilentlyContinue).TaskbarMn
if ($null -ne $taskbarMn) {
    $output["taskbar_chat"] = @{ is_on = ($taskbarMn -eq 0); current_value = $taskbarMn }
} else {
    $output["taskbar_chat"] = @{ is_on = $null; current_value = $null }
}

# Lock Screen
$lockPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization"
$noLock = (Get-ItemProperty -Path $lockPath -Name "NoLockScreen" -ErrorAction SilentlyContinue).NoLockScreen
if ($null -ne $noLock) {
    $output["lock_screen_disable"] = @{ is_on = ($noLock -eq 1); current_value = $noLock }
} else {
    $output["lock_screen_disable"] = @{ is_on = $null; current_value = $null }
}

# Start Menu Recommendations
$startIris = (Get-ItemProperty -Path $advPath -Name "Start_IrisRecommendations" -ErrorAction SilentlyContinue).Start_IrisRecommendations
if ($null -ne $startIris) {
    $output["start_menu_recommendations"] = @{ is_on = ($startIris -eq 0); current_value = $startIris }
} else {
    $output["start_menu_recommendations"] = @{ is_on = $null; current_value = $null }
}

# Bing Search in Start
$bingPath = "HKCU:\SOFTWARE\Policies\Microsoft\Windows\Explorer"
$bingEnabled = (Get-ItemProperty -Path $bingPath -Name "BingSearchEnabled" -ErrorAction SilentlyContinue).BingSearchEnabled
if ($null -ne $bingEnabled) {
    $output["bing_search_start"] = @{ is_on = ($bingEnabled -eq 0); current_value = $bingEnabled }
} else {
    $output["bing_search_start"] = @{ is_on = $null; current_value = $null }
}

# Verbose Logon
$sysPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
$verboseStatus = (Get-ItemProperty -Path $sysPath -Name "VerboseStatus" -ErrorAction SilentlyContinue).VerboseStatus
if ($null -ne $verboseStatus) {
    $output["verbose_logon"] = @{ is_on = ($verboseStatus -eq 1); current_value = $verboseStatus }
} else {
    $output["verbose_logon"] = @{ is_on = $null; current_value = $null }
}

# NumLock on Startup
$kbPath = "HKCU:\Control Panel\Keyboard"
$numLock = (Get-ItemProperty -Path $kbPath -Name "InitialKeyboardIndicators" -ErrorAction SilentlyContinue).InitialKeyboardIndicators
if ($null -ne $numLock) {
    $output["numlock_startup"] = @{ is_on = ($numLock -eq "2"); current_value = $numLock }
} else {
    $output["numlock_startup"] = @{ is_on = $null; current_value = $null }
}

# ── Privacy & Telemetry ──────────────────────────────────────────────

# Advertising ID
$adPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo"
$adEnabled = (Get-ItemProperty -Path $adPath -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
if ($null -ne $adEnabled) {
    $output["disable_ad_id"] = @{ is_on = ($adEnabled -eq 0); current_value = $adEnabled }
} else {
    $output["disable_ad_id"] = @{ is_on = $null; current_value = $null }
}

# Telemetry
$telemetryPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection"
$allowTelemetry = (Get-ItemProperty -Path $telemetryPath -Name "AllowTelemetry" -ErrorAction SilentlyContinue).AllowTelemetry
$diagTrackSvc = (Get-Service -Name "DiagTrack" -ErrorAction SilentlyContinue).StartType
if ($null -ne $allowTelemetry -and $null -ne $diagTrackSvc) {
    $output["disable_telemetry"] = @{ is_on = ($allowTelemetry -eq 0 -or $diagTrackSvc -eq "Disabled"); current_value = "$allowTelemetry / $diagTrackSvc" }
} elseif ($null -ne $diagTrackSvc) {
    $output["disable_telemetry"] = @{ is_on = ($diagTrackSvc -eq "Disabled"); current_value = "$diagTrackSvc" }
} else {
    $output["disable_telemetry"] = @{ is_on = $null; current_value = $null }
}

# Location
$locPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\location"
$locValue = (Get-ItemProperty -Path $locPath -Name "Value" -ErrorAction SilentlyContinue).Value
if ($null -ne $locValue) {
    $output["disable_location"] = @{ is_on = ($locValue -eq "Deny"); current_value = $locValue }
} else {
    $output["disable_location"] = @{ is_on = $null; current_value = $null }
}

# Activity History
$actPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System"
$actFeed = (Get-ItemProperty -Path $actPath -Name "EnableActivityFeed" -ErrorAction SilentlyContinue).EnableActivityFeed
if ($null -ne $actFeed) {
    $output["disable_activity_history"] = @{ is_on = ($actFeed -eq 0); current_value = $actFeed }
} else {
    $output["disable_activity_history"] = @{ is_on = $null; current_value = $null }
}

# Diagnostic Data
$diagPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Privacy"
$tailored = (Get-ItemProperty -Path $diagPath -Name "TailoredExperiencesWithDiagnosticDataEnabled" -ErrorAction SilentlyContinue).TailoredExperiencesWithDiagnosticDataEnabled
if ($null -ne $tailored) {
    $output["disable_diagnostic_data"] = @{ is_on = ($tailored -eq 0); current_value = $tailored }
} else {
    $output["disable_diagnostic_data"] = @{ is_on = $null; current_value = $null }
}

# Clipboard History
$clipPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System"
$clipHist = (Get-ItemProperty -Path $clipPath -Name "AllowClipboardHistory" -ErrorAction SilentlyContinue).AllowClipboardHistory
if ($null -ne $clipHist) {
    $output["disable_clipboard_history"] = @{ is_on = ($clipHist -eq 0); current_value = $clipHist }
} else {
    $output["disable_clipboard_history"] = @{ is_on = $null; current_value = $null }
}

# Online Speech
$speechPath = "HKCU:\SOFTWARE\Microsoft\Speech_OneCore\Settings\OnlineSpeechPrivacy"
$hasAccepted = (Get-ItemProperty -Path $speechPath -Name "HasAccepted" -ErrorAction SilentlyContinue).HasAccepted
if ($null -ne $hasAccepted) {
    $output["disable_online_speech"] = @{ is_on = ($hasAccepted -eq 0); current_value = $hasAccepted }
} else {
    $output["disable_online_speech"] = @{ is_on = $null; current_value = $null }
}

# Input Personalization
$tipcPath = "HKCU:\SOFTWARE\Microsoft\Input\TIPC"
$tipcEnabled = (Get-ItemProperty -Path $tipcPath -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
if ($null -ne $tipcEnabled) {
    $output["disable_input_personalization"] = @{ is_on = ($tipcEnabled -eq 0); current_value = $tipcEnabled }
} else {
    $output["disable_input_personalization"] = @{ is_on = $null; current_value = $null }
}

# Defender Samples
$defPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender\Spynet"
$submitConsent = (Get-ItemProperty -Path $defPath -Name "SubmitSamplesConsent" -ErrorAction SilentlyContinue).SubmitSamplesConsent
if ($null -ne $submitConsent) {
    $output["disable_defender_samples"] = @{ is_on = ($submitConsent -eq 2); current_value = $submitConsent }
} else {
    $output["disable_defender_samples"] = @{ is_on = $null; current_value = $null }
}

# Consumer Features
$cloudPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
$consumerFeatures = (Get-ItemProperty -Path $cloudPath -Name "DisableWindowsConsumerFeatures" -ErrorAction SilentlyContinue).DisableWindowsConsumerFeatures
if ($null -ne $consumerFeatures) {
    $output["disable_consumer_features"] = @{ is_on = ($consumerFeatures -eq 1); current_value = $consumerFeatures }
} else {
    $output["disable_consumer_features"] = @{ is_on = $null; current_value = $null }
}

# WPBT
$wpbtPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager"
$disableWpbt = (Get-ItemProperty -Path $wpbtPath -Name "DisableWpbtExecution" -ErrorAction SilentlyContinue).DisableWpbtExecution
if ($null -ne $disableWpbt) {
    $output["disable_wpbt"] = @{ is_on = ($disableWpbt -eq 1); current_value = $disableWpbt }
} else {
    $output["disable_wpbt"] = @{ is_on = $null; current_value = $null }
}

# Delivery Optimization
$doPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization"
$doMode = (Get-ItemProperty -Path $doPath -Name "DODownloadMode" -ErrorAction SilentlyContinue).DODownloadMode
if ($null -ne $doMode) {
    $output["disable_delivery_optimization"] = @{ is_on = ($doMode -eq 0); current_value = $doMode }
} else {
    $output["disable_delivery_optimization"] = @{ is_on = $null; current_value = $null }
}

# ── Performance & Power ───────────────────────────────────────────────

# Hibernation
$hibPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Power"
$hibEnabled = (Get-ItemProperty -Path $hibPath -Name "HibernateEnabled" -ErrorAction SilentlyContinue).HibernateEnabled
if ($null -ne $hibEnabled) {
    $output["disable_hibernation"] = @{ is_on = ($hibEnabled -eq 0); current_value = $hibEnabled }
} else {
    $output["disable_hibernation"] = @{ is_on = $null; current_value = $null }
}

# Animations
$taskbarAnim = (Get-ItemProperty -Path $advPath -Name "TaskbarAnimations" -ErrorAction SilentlyContinue).TaskbarAnimations
$menuDelay = (Get-ItemProperty -Path "HKCU:\Control Panel\Desktop" -Name "MenuShowDelay" -ErrorAction SilentlyContinue).MenuShowDelay
if ($null -ne $taskbarAnim) {
    $output["disable_animations"] = @{ is_on = ($taskbarAnim -eq 0); current_value = $taskbarAnim }
} else {
    $output["disable_animations"] = @{ is_on = $null; current_value = $null }
}

# Aero Peek
$aeroPeek = (Get-ItemProperty -Path $advPath -Name "DisablePreviewDesktop" -ErrorAction SilentlyContinue).DisablePreviewDesktop
if ($null -ne $aeroPeek) {
    $output["disable_aero_peek"] = @{ is_on = ($aeroPeek -eq 1); current_value = $aeroPeek }
} else {
    $output["disable_aero_peek"] = @{ is_on = $null; current_value = $null }
}

# Indexing (service state)
$wsearchSvc = (Get-Service -Name "WSearch" -ErrorAction SilentlyContinue).StartType
if ($null -ne $wsearchSvc) {
    $output["disable_indexing"] = @{ is_on = ($wsearchSvc -eq "Disabled"); current_value = "$wsearchSvc" }
} else {
    $output["disable_indexing"] = @{ is_on = $null; current_value = $null }
}

# SysMain (service state)
$sysMainSvc = (Get-Service -Name "SysMain" -ErrorAction SilentlyContinue).StartType
if ($null -ne $sysMainSvc) {
    $output["disable_sysmain"] = @{ is_on = ($sysMainSvc -eq "Disabled"); current_value = "$sysMainSvc" }
} else {
    $output["disable_sysmain"] = @{ is_on = $null; current_value = $null }
}

# Storage Sense
$ssPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\StorageSense\Parameters\StoragePolicy"
$ssEnabled = (Get-ItemProperty -Path $ssPath -Name "01" -ErrorAction SilentlyContinue)."01"
if ($null -ne $ssEnabled) {
    $output["disable_storage_sense"] = @{ is_on = ($ssEnabled -eq 0); current_value = $ssEnabled }
} else {
    $output["disable_storage_sense"] = @{ is_on = $null; current_value = $null }
}

# Long Paths
$fsPath = "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem"
$longPaths = (Get-ItemProperty -Path $fsPath -Name "LongPathsEnabled" -ErrorAction SilentlyContinue).LongPathsEnabled
if ($null -ne $longPaths) {
    $output["enable_long_paths"] = @{ is_on = ($longPaths -eq 1); current_value = $longPaths }
} else {
    $output["enable_long_paths"] = @{ is_on = $null; current_value = $null }
}

# Auto Folder Discovery
$disallowShaping = (Get-ItemProperty -Path $advPath -Name "DisallowShaping" -ErrorAction SilentlyContinue).DisallowShaping
if ($null -ne $disallowShaping) {
    $output["disable_auto_folder_discovery"] = @{ is_on = ($disallowShaping -eq 1); current_value = $disallowShaping }
} else {
    $output["disable_auto_folder_discovery"] = @{ is_on = $null; current_value = $null }
}

# Fullscreen Optimizations
$gamePath = "HKCU:\System\GameConfigStore"
$gameDvr = (Get-ItemProperty -Path $gamePath -Name "GameDVR_DXGIHonorFSEWindowsCompatible" -ErrorAction SilentlyContinue).GameDVR_DXGIHonorFSEWindowsCompatible
if ($null -ne $gameDvr) {
    $output["disable_fullscreen_opt"] = @{ is_on = ($gameDvr -eq 1); current_value = $gameDvr }
} else {
    $output["disable_fullscreen_opt"] = @{ is_on = $null; current_value = $null }
}

# ── Security & Updates ───────────────────────────────────────────────

# Copilot / Windows AI
$aiPath = "HKCU:\SOFTWARE\Policies\Microsoft\Windows\WindowsAI"
$disableAi = (Get-ItemProperty -Path $aiPath -Name "DisableAIDataAnalysis" -ErrorAction SilentlyContinue).DisableAIDataAnalysis
if ($null -ne $disableAi) {
    $output["disable_copilot"] = @{ is_on = ($disableAi -eq 1); current_value = $disableAi }
} else {
    $output["disable_copilot"] = @{ is_on = $null; current_value = $null }
}

# SMBv1
$smbPath = "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters"
$smb1 = (Get-ItemProperty -Path $smbPath -Name "SMB1" -ErrorAction SilentlyContinue).SMB1
if ($null -ne $smb1) {
    $output["disable_smb1"] = @{ is_on = ($smb1 -eq 0); current_value = $smb1 }
} else {
    $output["disable_smb1"] = @{ is_on = $null; current_value = $null }
}

# AutoRun
$arPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer"
$noAutoplay = (Get-ItemProperty -Path $arPath -Name "NoAutoplay" -ErrorAction SilentlyContinue).NoAutoplay
if ($null -ne $noAutoplay) {
    $output["disable_autorun"] = @{ is_on = ($noAutoplay -eq 1); current_value = $noAutoplay }
} else {
    $output["disable_autorun"] = @{ is_on = $null; current_value = $null }
}

# Remote Desktop
$rdpPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server"
$denyRdp = (Get-ItemProperty -Path $rdpPath -Name "fDenyTSConnections" -ErrorAction SilentlyContinue).fDenyTSConnections
if ($null -ne $denyRdp) {
    $output["disable_rdp"] = @{ is_on = ($denyRdp -eq 1); current_value = $denyRdp }
} else {
    $output["disable_rdp"] = @{ is_on = $null; current_value = $null }
}

# DNS-over-HTTPS
$dohPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient"
$enableDoh = (Get-ItemProperty -Path $dohPath -Name "EnableAutoDoh" -ErrorAction SilentlyContinue).EnableAutoDoh
if ($null -ne $enableDoh) {
    $output["enable_dns_over_https"] = @{ is_on = ($enableDoh -eq 2); current_value = $enableDoh }
} else {
    $output["enable_dns_over_https"] = @{ is_on = $null; current_value = $null }
}

# RDP Unsigned Warnings
$rdpWarnPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Safer\CodeIdentifiers"
$authEnabled = (Get-ItemProperty -Path $rdpWarnPath -Name "AuthenticodeEnabled" -ErrorAction SilentlyContinue).AuthenticodeEnabled
if ($null -ne $authEnabled) {
    $output["disable_rdp_unsigned_warnings"] = @{ is_on = ($authEnabled -eq 0); current_value = $authEnabled }
} else {
    $output["disable_rdp_unsigned_warnings"] = @{ is_on = $null; current_value = $null }
}

# ── Hardening ───────────────────────────────────────────────────────────

# Disable Background Apps
$bgPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications"
$bgVal = (Get-ItemProperty -Path $bgPath -Name "GlobalUserDisabled" -ErrorAction SilentlyContinue).GlobalUserDisabled
if ($null -ne $bgVal) {
    $output["disable_background_apps"] = @{ is_on = ($bgVal -eq 1); current_value = $bgVal }
} else {
    $output["disable_background_apps"] = @{ is_on = $null; current_value = $null }
}

# Enable SmartScreen
$ssPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System"
$ssVal = (Get-ItemProperty -Path $ssPath -Name "EnableSmartScreen" -ErrorAction SilentlyContinue).EnableSmartScreen
if ($null -ne $ssVal) {
    $output["enable_smart_screen"] = @{ is_on = ($ssVal -eq 1); current_value = $ssVal }
} else {
    $output["enable_smart_screen"] = @{ is_on = $null; current_value = $null }
}

# Disable WPAD
$wpadVal = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Internet Settings\Wpad" -Name "WpadOverride" -ErrorAction SilentlyContinue).WpadOverride
if ($null -ne $wpadVal) {
    $output["disable_wpad"] = @{ is_on = ($wpadVal -eq 1); current_value = $wpadVal }
} else {
    $output["disable_wpad"] = @{ is_on = $null; current_value = $null }
}

# Disable LLMNR (Multicast DNS)
$mcastVal = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Name "EnableMulticast" -ErrorAction SilentlyContinue).EnableMulticast
if ($null -ne $mcastVal) {
    $output["disable_llmnr"] = @{ is_on = ($mcastVal -eq 0); current_value = $mcastVal }
} else {
    $output["disable_llmnr"] = @{ is_on = $null; current_value = $null }
}

# Disable NetBIOS Name Service (NoNameReleaseOnDemand)
$nbtVal = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Netbt\Parameters" -Name "NoNameReleaseOnDemand" -ErrorAction SilentlyContinue).NoNameReleaseOnDemand
if ($null -ne $nbtVal) {
    $output["disable_nbt_ns"] = @{ is_on = ($nbtVal -eq 1); current_value = $nbtVal }
} else {
    $output["disable_nbt_ns"] = @{ is_on = $null; current_value = $null }
}

# Require Encrypted WinRM
$winrmVal = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WinRM\Service" -Name "AllowUnencryptedTraffic" -ErrorAction SilentlyContinue).AllowUnencryptedTraffic
if ($null -ne $winrmVal) {
    $output["disable_winrm_unencrypted"] = @{ is_on = ($winrmVal -eq 0); current_value = $winrmVal }
} else {
    $output["disable_winrm_unencrypted"] = @{ is_on = $null; current_value = $null }
}

# Block Dangerous Extensions (check if .ps1 is associated with txtfile)
$ps1Assoc = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Classes\.ps1" -ErrorAction SilentlyContinue)."(default)"
if ($null -ne $ps1Assoc) {
    $output["block_dangerous_extensions"] = @{ is_on = ($ps1Assoc -eq "txtfile"); current_value = "$ps1Assoc" }
} else {
    $output["block_dangerous_extensions"] = @{ is_on = $null; current_value = $null }
}

# Disable AutoRun (Enhanced)
$noDriveType = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\Explorer" -Name "NoDriveTypeAutoRun" -ErrorAction SilentlyContinue).NoDriveTypeAutoRun
if ($null -ne $noDriveType) {
    $output["disable_auto_run_hardening"] = @{ is_on = ($noDriveType -eq 255); current_value = $noDriveType }
} else {
    $output["disable_auto_run_hardening"] = @{ is_on = $null; current_value = $null }
}

# Keep UAC Enabled
$uacPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
$uacVal = (Get-ItemProperty -Path $uacPath -Name "ConsentPromptBehaviorAdmin" -ErrorAction SilentlyContinue).ConsentPromptBehaviorAdmin
if ($null -ne $uacVal) {
    $output["enable_uac"] = @{ is_on = ($uacVal -eq 2); current_value = $uacVal }
} else {
    $output["enable_uac"] = @{ is_on = $null; current_value = $null }
}

# Restrict Null Sessions
$lsaPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa"
$restrictAnon = (Get-ItemProperty -Path $lsaPath -Name "RestrictAnonymous" -ErrorAction SilentlyContinue).RestrictAnonymous
if ($null -ne $restrictAnon) {
    $output["disable_null_sessions"] = @{ is_on = ($restrictAnon -eq 1); current_value = $restrictAnon }
} else {
    $output["disable_null_sessions"] = @{ is_on = $null; current_value = $null }
}

# Disable WDigest
$wdigestVal = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\WDigest" -Name "UseLogonCredential" -ErrorAction SilentlyContinue).UseLogonCredential
if ($null -ne $wdigestVal) {
    $output["disable_wdigest"] = @{ is_on = ($wdigestVal -eq 0); current_value = $wdigestVal }
} else {
    $output["disable_wdigest"] = @{ is_on = $null; current_value = $null }
}

# Enable Credential Guard
$runAsPPL = (Get-ItemProperty -Path $lsaPath -Name "RunAsPPL" -ErrorAction SilentlyContinue).RunAsPPL
if ($null -ne $runAsPPL) {
    $output["enable_credential_guard"] = @{ is_on = ($runAsPPL -eq 1); current_value = $runAsPPL }
} else {
    $output["enable_credential_guard"] = @{ is_on = $null; current_value = $null }
}

# Disable IP Source Routing
$ipSrcRoute = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "DisableIPSourceRouting" -ErrorAction SilentlyContinue).DisableIPSourceRouting
if ($null -ne $ipSrcRoute) {
    $output["disable_ipv6_source_routing"] = @{ is_on = ($ipSrcRoute -eq 2); current_value = $ipSrcRoute }
} else {
    $output["disable_ipv6_source_routing"] = @{ is_on = $null; current_value = $null }
}

# Disable ICMP Redirects
$icmpRedir = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters" -Name "EnableICMPRedirect" -ErrorAction SilentlyContinue).EnableICMPRedirect
if ($null -ne $icmpRedir) {
    $output["disable_icmp_redirect"] = @{ is_on = ($icmpRedir -eq 0); current_value = $icmpRedir }
} else {
    $output["disable_icmp_redirect"] = @{ is_on = $null; current_value = $null }
}

# Require SMB Signing
$smbSignPath = "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters"
$smbReqSign = (Get-ItemProperty -Path $smbSignPath -Name "RequireSecuritySignature" -ErrorAction SilentlyContinue).RequireSecuritySignature
if ($null -ne $smbReqSign) {
    $output["enable_smb_signing"] = @{ is_on = ($smbReqSign -eq 1); current_value = $smbReqSign }
} else {
    $output["enable_smb_signing"] = @{ is_on = $null; current_value = $null }
}

# Disable SMBv1 (Enhanced)
$smb1Start = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\mrxsmb10" -Name "Start" -ErrorAction SilentlyContinue).Start
if ($null -ne $smb1Start) {
    $output["disable_smb1_hardening"] = @{ is_on = ($smb1Start -eq 4); current_value = $smb1Start }
} else {
    $output["disable_smb1_hardening"] = @{ is_on = $null; current_value = $null }
}

# Disable NetBIOS over TCP/IP (check NetBT TcpipNetbiosOptions)
$netbiosOpt = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Netbt\Parameters\Interfaces\tcpip_" -Name "NetbiosOptions" -ErrorAction SilentlyContinue).NetbiosOptions
if ($null -ne $netbiosOpt) {
    $output["disable_netbios_tcp"] = @{ is_on = ($netbiosOpt -eq 2); current_value = $netbiosOpt }
} else {
    $output["disable_netbios_tcp"] = @{ is_on = $null; current_value = $null }
}

# Disable RDP (Enhanced)
$rdpEncrypt = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services" -Name "fEncryptRPCTraffic" -ErrorAction SilentlyContinue).fEncryptRPCTraffic
if ($null -ne $rdpEncrypt) {
    $output["disable_rdp_hardened"] = @{ is_on = ($rdpEncrypt -eq 1); current_value = $rdpEncrypt }
} else {
    $output["disable_rdp_hardened"] = @{ is_on = $null; current_value = $null }
}

# Hardened TLS Cipher Suites (check SSL 2.0 client disabled)
$ssl2Path = "HKLM:\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\SSL 2.0\Client"
$ssl2Enabled = (Get-ItemProperty -Path $ssl2Path -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
if ($null -ne $ssl2Enabled) {
    $output["hardened_tls_cipher_suites"] = @{ is_on = ($ssl2Enabled -eq 0); current_value = $ssl2Enabled }
} else {
    $output["hardened_tls_cipher_suites"] = @{ is_on = $null; current_value = $null }
}

# Force Strong .NET Crypto
$netStrongPath = "HKLM:\SOFTWARE\Microsoft\.NETFramework\v4.0.30319"
$netStrong = (Get-ItemProperty -Path $netStrongPath -Name "SchUseStrongCrypto" -ErrorAction SilentlyContinue).SchUseStrongCrypto
if ($null -ne $netStrong) {
    $output["force_strong_crypto_net"] = @{ is_on = ($netStrong -eq 1); current_value = $netStrong }
} else {
    $output["force_strong_crypto_net"] = @{ is_on = $null; current_value = $null }
}

# Disable Web Search in Search Bar
$bingSearch = (Get-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search" -Name "BingSearchEnabled" -ErrorAction SilentlyContinue).BingSearchEnabled
if ($null -ne $bingSearch) {
    $output["disable_windows_search_web"] = @{ is_on = ($bingSearch -eq 0); current_value = $bingSearch }
} else {
    $output["disable_windows_search_web"] = @{ is_on = $null; current_value = $null }
}

# Disable Wi-Fi Sense
$wifiOem = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\WcmSvc\wifinetworkmanager\config" -Name "AutoConnectAllowedOEM" -ErrorAction SilentlyContinue).AutoConnectAllowedOEM
if ($null -ne $wifiOem) {
    $output["disable_wifi_sense"] = @{ is_on = ($wifiOem -eq 0); current_value = $wifiOem }
} else {
    $output["disable_wifi_sense"] = @{ is_on = $null; current_value = $null }
}

# Disable 8.3 Short Names (fsutil)
# Disable 8.3 Short Names (check via fsutil)
try {
    $fsutil8dot3 = & fsutil behavior query disable8dot3 C: 2>$null
    if ($LASTEXITCODE -eq 0 -and $fsutil8dot3 -match "1") {
        $output["force_fsutil_8dot3"] = @{ is_on = $true; current_value = "Disabled" }
    } elseif ($LASTEXITCODE -eq 0 -and $fsutil8dot3 -match "0") {
        $output["force_fsutil_8dot3"] = @{ is_on = $false; current_value = "Enabled" }
    } else {
        $output["force_fsutil_8dot3"] = @{ is_on = $null; current_value = "need_admin" }
    }
} catch {
    $output["force_fsutil_8dot3"] = @{ is_on = $null; current_value = "need_admin" }
}

# Enable Last Access Timestamps (check via fsutil)
try {
    $fsutilLastAccess = & fsutil behavior query disablelastaccess 2>$null
    if ($LASTEXITCODE -eq 0 -and $fsutilLastAccess -match "0") {
        $output["force_fsutil_lastaccess"] = @{ is_on = $true; current_value = "Enabled (tracking on)" }
    } elseif ($LASTEXITCODE -eq 0) {
        $output["force_fsutil_lastaccess"] = @{ is_on = $false; current_value = "Disabled (tracking off)" }
    } else {
        $output["force_fsutil_lastaccess"] = @{ is_on = $null; current_value = "need_admin" }
    }
} catch {
    $output["force_fsutil_lastaccess"] = @{ is_on = $null; current_value = "need_admin" }
}

# Disable DCOM
$dcomVal = (Get-ItemProperty -Path "HKLM:\Software\Microsoft\OLE" -Name "EnableDCOM" -ErrorAction SilentlyContinue).EnableDCOM
if ($null -ne $dcomVal) {
    $output["disable_com_dcom"] = @{ is_on = ($dcomVal -eq "N"); current_value = "$dcomVal" }
} else {
    $output["disable_com_dcom"] = @{ is_on = $null; current_value = $null }
}

# Disable Windows Script Host
$wshVal = (Get-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows Script Host\Settings" -Name "Enabled" -ErrorAction SilentlyContinue).Enabled
if ($null -ne $wshVal) {
    $output["disable_script_host"] = @{ is_on = ($wshVal -eq 0); current_value = $wshVal }
} else {
    $output["disable_script_host"] = @{ is_on = $null; current_value = $null }
}

# Prevent Printer Driver Installation
$addPrintDrv = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Providers\LanMan Print Services\Servers" -Name "AddPrinterDrivers" -ErrorAction SilentlyContinue).AddPrinterDrivers
if ($null -ne $addPrintDrv) {
    $output["disable_printer_drivers"] = @{ is_on = ($addPrintDrv -eq 1); current_value = $addPrintDrv }
} else {
    $output["disable_printer_drivers"] = @{ is_on = $null; current_value = $null }
}

# Disable AlwaysInstallElevated
$msiElev = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Installer" -Name "AlwaysInstallElevated" -ErrorAction SilentlyContinue).AlwaysInstallElevated
if ($null -ne $msiElev) {
    $output["force_msi_elevated_off"] = @{ is_on = ($msiElev -eq 0); current_value = $msiElev }
} else {
    $output["force_msi_elevated_off"] = @{ is_on = $null; current_value = $null }
}

# Harden Office Macros (check VBAWarnings for Office 16)
$officeVba = (Get-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Office\16.0\Word\Security" -Name "VBAWarnings" -ErrorAction SilentlyContinue).VBAWarnings
if ($null -ne $officeVba) {
    $output["harden_office_macros"] = @{ is_on = ($officeVba -eq 4); current_value = $officeVba }
} else {
    $output["harden_office_macros"] = @{ is_on = $null; current_value = $null }
}

# Edge Hardening (check SmartScreenEnabled)
$edgeSs = (Get-ItemProperty -Path "HKLM:\Software\Policies\Microsoft\Edge" -Name "SmartScreenEnabled" -ErrorAction SilentlyContinue).SmartScreenEnabled
if ($null -ne $edgeSs) {
    $output["edge_hardening"] = @{ is_on = ($edgeSs -eq 1); current_value = $edgeSs }
} else {
    $output["edge_hardening"] = @{ is_on = $null; current_value = $null }
}

# Chrome Hardening (check SitePerProcess)
$chromeSite = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Google\Chrome" -Name "SitePerProcess" -ErrorAction SilentlyContinue).SitePerProcess
if ($null -ne $chromeSite) {
    $output["chrome_hardening"] = @{ is_on = ($chromeSite -eq 1); current_value = $chromeSite }
} else {
    $output["chrome_hardening"] = @{ is_on = $null; current_value = $null }
}

# Disable IPv6
$ipv6Disabled = (Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\services\tcpip6\parameters" -Name "DisabledComponents" -ErrorAction SilentlyContinue).DisabledComponents
if ($null -ne $ipv6Disabled) {
    $output["disable_ipv6_protocol"] = @{ is_on = ($ipv6Disabled -eq 255); current_value = $ipv6Disabled }
} else {
    $output["disable_ipv6_protocol"] = @{ is_on = $null; current_value = $null }
}

# Disable Reserved Storage (script only)
$output["disable_reserved_storage"] = @{ is_on = $null; current_value = "script_only" }

# Block Process Network Connections (check if firewall rule exists)
$fwRule = Get-NetFirewallRule -DisplayName "Block certutil.exe netconns" -ErrorAction SilentlyContinue
if ($null -ne $fwRule) {
    $output["block_process_netconns"] = @{ is_on = $true; current_value = "Firewall rules active" }
} else {
    $output["block_process_netconns"] = @{ is_on = $null; current_value = $null }
}

# PUA Protection
# Script-only check via PowerShell
# PUA Protection (check via Get-MpPreference)
try {
    $mpPref = Get-MpPreference -ErrorAction SilentlyContinue
    if ($null -ne $mpPref) {
        $pua = $mpPref.PUAProtection
        if ($null -ne $pua) {
            $output["force_windows_defender_pua"] = @{ is_on = ($pua -eq 1); current_value = "$pua" }
        } else {
            $output["force_windows_defender_pua"] = @{ is_on = $null; current_value = $null }
        }
    } else {
        $output["force_windows_defender_pua"] = @{ is_on = $null; current_value = $null }
    }
} catch {
    $output["force_windows_defender_pua"] = @{ is_on = $null; current_value = $null }
}

# Adobe Reader Hardening
$adobeFlash = (Get-ItemProperty -Path "HKLM:\Software\Policies\Adobe\Acrobat Reader\DC\FeatureLockDown" -Name "bEnableFlash" -ErrorAction SilentlyContinue).bEnableFlash
if ($null -ne $adobeFlash) {
    $output["adobe_reader_hardening"] = @{ is_on = ($adobeFlash -eq 0); current_value = $adobeFlash }
} else {
    $output["adobe_reader_hardening"] = @{ is_on = $null; current_value = $null }
}

# Remove Bloatware (script only - can't easily detect)
$output["remove_bloatware"] = @{ is_on = $null; current_value = "script_only" }

# Lock Screen Camera
$lockCam = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization" -Name "NoLockScreenCamera" -ErrorAction SilentlyContinue).NoLockScreenCamera
if ($null -ne $lockCam) {
    $output["lock_screen_camera"] = @{ is_on = ($lockCam -eq 1); current_value = $lockCam }
} else {
    $output["lock_screen_camera"] = @{ is_on = $null; current_value = $null }
}

# Disable Voice Activation on Lock Screen
$voiceLock = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy" -Name "LetAppsActivateWithVoiceAboveLock" -ErrorAction SilentlyContinue).LetAppsActivateWithVoiceAboveLock
if ($null -ne $voiceLock) {
    $output["disable_voice_activation_lock"] = @{ is_on = ($voiceLock -eq 2); current_value = $voiceLock }
} else {
    $output["disable_voice_activation_lock"] = @{ is_on = $null; current_value = $null }
}

# Enable Security Auditing
$auditProc = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System\Audit" -Name "ProcessCreationIncludeCmdLine_Enabled" -ErrorAction SilentlyContinue).ProcessCreationIncludeCmdLine_Enabled
if ($null -ne $auditProc) {
    $output["enable_auditing"] = @{ is_on = ($auditProc -eq 1); current_value = $auditProc }
} else {
    $output["enable_auditing"] = @{ is_on = $null; current_value = $null }
}

# Block SmartScreen Override
$ssLevel = (Get-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "ShellSmartScreenLevel" -ErrorAction SilentlyContinue).ShellSmartScreenLevel
if ($null -ne $ssLevel) {
    $output["disable_smartscreen_override"] = @{ is_on = ($ssLevel -eq "Block"); current_value = "$ssLevel" }
} else {
    $output["disable_smartscreen_override"] = @{ is_on = $null; current_value = $null }
}

# PowerShell v2 (check if feature is enabled)
try {
    $psv2 = Get-WindowsOptionalFeature -Online -FeatureName MicrosoftWindowsPowerShellV2 -ErrorAction SilentlyContinue
    if ($null -ne $psv2) {
        $output["disable_powershell_v2"] = @{ is_on = ($psv2.State -ne "Enabled"); current_value = "$($psv2.State)" }
    } else {
        $output["disable_powershell_v2"] = @{ is_on = $null; current_value = "need_admin" }
    }
} catch {
    $output["disable_powershell_v2"] = @{ is_on = $null; current_value = "need_admin" }
}

# ASR Rules (check via Get-MpPreference)
try {
    $mpPref = Get-MpPreference -ErrorAction SilentlyContinue
    if ($null -ne $mpPref -and $null -ne $mpPref.AttackSurfaceReductionRules_Ids) {
        $output["enable_asr_rules"] = @{ is_on = ($mpPref.AttackSurfaceReductionRules_Ids.Count -gt 0); current_value = "$($mpPref.AttackSurfaceReductionRules_Ids.Count) rules active" }
    } else {
        $output["enable_asr_rules"] = @{ is_on = $null; current_value = $null }
    }
} catch {
    $output["enable_asr_rules"] = @{ is_on = $null; current_value = $null }
}

# Controlled Folder Access (check via Get-MpPreference)
try {
    $mpPref = Get-MpPreference -ErrorAction SilentlyContinue
    if ($null -ne $mpPref) {
        $cfa = $mpPref.EnableControlledFolderAccess
        if ($null -ne $cfa) {
            $output["enable_controlled_folder_access"] = @{ is_on = ($cfa -eq 1); current_value = "$cfa" }
        } else {
            $output["enable_controlled_folder_access"] = @{ is_on = $null; current_value = $null }
        }
    } else {
        $output["enable_controlled_folder_access"] = @{ is_on = $null; current_value = $null }
    }
} catch {
    $output["enable_controlled_folder_access"] = @{ is_on = $null; current_value = $null }
}

# Network Protection (check via Get-MpPreference)
try {
    $mpPref = Get-MpPreference -ErrorAction SilentlyContinue
    if ($null -ne $mpPref) {
        $np = $mpPref.EnableNetworkProtection
        if ($null -ne $np) {
            $output["enable_network_protection"] = @{ is_on = ($np -eq 1); current_value = "$np" }
        } else {
            $output["enable_network_protection"] = @{ is_on = $null; current_value = $null }
        }
    } else {
        $output["enable_network_protection"] = @{ is_on = $null; current_value = $null }
    }
} catch {
    $output["enable_network_protection"] = @{ is_on = $null; current_value = $null }
}

# BitLocker (try admin command first, fall back to registry heuristic)
try {
    $bitlockerVol = Get-BitLockerVolume -MountPoint "C:" -ErrorAction SilentlyContinue
    if ($null -ne $bitlockerVol -and $null -ne $bitlockerVol.ProtectionStatus) {
        $output["enable_bitlocker"] = @{ is_on = ($bitlockerVol.ProtectionStatus -eq "On"); current_value = "$($bitlockerVol.ProtectionStatus)" }
    } else {
        # Fallback: check if BitLocker encryption keys exist in registry (indicates encryption active)
        $autoDE = Test-Path "HKLM:\SYSTEM\CurrentControlSet\Control\BitLocker\AutoDE"
        $preventEnc = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\BitLocker" -Name PreventDeviceEncryption -ErrorAction SilentlyContinue).PreventDeviceEncryption
        if ($autoDE -and $preventEnc -ne 1) {
            $output["enable_bitlocker"] = @{ is_on = $true; current_value = "Encrypted (detected via registry)" }
        } else {
            $output["enable_bitlocker"] = @{ is_on = $null; current_value = "need_admin" }
        }
    }
} catch {
    # Fallback: check registry heuristic
    $autoDE = Test-Path "HKLM:\SYSTEM\CurrentControlSet\Control\BitLocker\AutoDE"
    $preventEnc = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\BitLocker" -Name PreventDeviceEncryption -ErrorAction SilentlyContinue).PreventDeviceEncryption
    if ($autoDE -and $preventEnc -ne 1) {
        $output["enable_bitlocker"] = @{ is_on = $true; current_value = "Encrypted (detected via registry)" }
    } else {
        $output["enable_bitlocker"] = @{ is_on = $null; current_value = "need_admin" }
    }
}

# ── Output JSON ───────────────────────────────────────────────────────

# Convert to JSON-friendly format
$jsonOutput = @{}
foreach ($key in $output.Keys) {
    $val = $output[$key]
    $jsonOutput[$key] = @{
        is_on = $val.is_on
        current_value = if ($val.current_value -ne $null) { "$($val.current_value)" } else { $null }
    }
}

$jsonOutput | ConvertTo-Json -Depth 3