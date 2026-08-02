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