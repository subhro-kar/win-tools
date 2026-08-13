# WinTools - Scan current Windows privacy setting states
# Reads registry values and outputs JSON to stdout
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scan-privacy.ps1

$ErrorActionPreference = "SilentlyContinue"
$output = @{}

# ── Helper Functions ──────────────────────────────────────────────────

function Get-RegState {
    param(
        [string]$Path,
        [string]$Name,
        $ValueOn
    )
    $val = (Get-ItemProperty -Path $Path -Name $Name -ErrorAction SilentlyContinue).$Name
    if ($null -ne $val) {
        return $val
    }
    return $null
}

# For HKCU keys: read normally
function Test-RegOn {
    param(
        [string]$Path,
        [string]$Name,
        $ValueOn
    )
    $val = Get-RegState -Path $Path -Name $Name -ValueOn $ValueOn
    if ($null -eq $val) { return @{ found = $false; is_on = $null; current = $null } }
    # Compare as strings to handle both REG_DWORD and REG_SZ consistently
    $match = ("$val" -eq "$ValueOn")
    return @{ found = $true; is_on = $match; current = $val }
}

# For HKLM keys: read but report need_admin if access denied
function Test-RegOnAdmin {
    param(
        [string]$Path,
        [string]$Name,
        $ValueOn
    )
    try {
        # Use -ErrorAction Stop so UnauthorizedAccessException is catchable
        $val = (Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop).$Name
        if ($null -eq $val) { return @{ found = $false; is_on = $null; current = $null } }
        $match = ("$val" -eq "$ValueOn")
        return @{ found = $true; is_on = $match; current = $val }
    } catch [System.UnauthorizedAccessException] {
        return @{ found = $false; is_on = $null; current = "need_admin" }
    } catch {
        # Other errors (key not found, etc.) — treat as not set
        return @{ found = $false; is_on = $null; current = $null }
    }
}

# For a single HKCU registry entry setting
function Set-SingleHkcu {
    param(
        [string]$Id,
        [string]$Path,
        [string]$Name,
        $ValueOn
    )
    $result = Test-RegOn -Path $Path -Name $Name -ValueOn $ValueOn
    if ($null -eq $result.current) {
        $output[$Id] = @{ is_on = $null; current_value = $null }
    } else {
        $output[$Id] = @{ is_on = $result.is_on; current_value = "$($result.current)" }
    }
}

# For a single HKLM registry entry setting (may need admin)
function Set-SingleHklm {
    param(
        [string]$Id,
        [string]$Path,
        [string]$Name,
        $ValueOn
    )
    $result = Test-RegOnAdmin -Path $Path -Name $Name -ValueOn $ValueOn
    if ($null -eq $result.current) {
        $output[$Id] = @{ is_on = $null; current_value = $null }
    } elseif ("$($result.current)" -eq "need_admin") {
        $output[$Id] = @{ is_on = $null; current_value = "need_admin" }
    } else {
        $output[$Id] = @{ is_on = $result.is_on; current_value = "$($result.current)" }
    }
}

# ── Advertising & Tracking ─────────────────────────────────────────────

# priv_disable_ad_id
Set-SingleHkcu -Id "priv_disable_ad_id" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\AdvertisingInfo" -Name "Enabled" -ValueOn 0

# priv_disable_typing_info (3 entries, all must match "on")
$tipc = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Input\TIPC" -Name "Enabled" -ValueOn 0
$inkRestrict = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\InputPersonalization" -Name "RestrictImplicitInkCollection" -ValueOn 1
$textRestrict = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\InputPersonalization" -Name "RestrictImplicitTextCollection" -ValueOn 1
$typingAllFound = ($tipc.found -and $inkRestrict.found -and $textRestrict.found)
$typingAnyFound = ($tipc.found -or $inkRestrict.found -or $textRestrict.found)
$typingVal = @($tipc, $inkRestrict, $textRestrict) | ForEach-Object { if ($_.found) { "$($_.current)" } else { "N/A" } }
$typingStr = $typingVal -join "/"
if ($typingAllFound) {
    $output["priv_disable_typing_info"] = @{ is_on = ($tipc.is_on -and $inkRestrict.is_on -and $textRestrict.is_on); current_value = $typingStr }
} elseif ($typingAnyFound) {
    $output["priv_disable_typing_info"] = @{ is_on = $false; current_value = $typingStr }
} else {
    $output["priv_disable_typing_info"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_timeline_suggestions
Set-SingleHkcu -Id "priv_disable_timeline_suggestions" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-88000326Enabled" -ValueOn 0

# priv_disable_start_suggestions (2 entries)
$sug1 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SystemPaneSuggestionsEnabled" -ValueOn 0
$sug2 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338388Enabled" -ValueOn 0
$sugVal = @($sug1, $sug2) | ForEach-Object { if ($_.found) { "$($_.current)" } else { "N/A" } }
$sugStr = $sugVal -join "/"
if ($sug1.found -and $sug2.found) {
    $output["priv_disable_start_suggestions"] = @{ is_on = ($sug1.is_on -and $sug2.is_on); current_value = $sugStr }
} elseif ($sug1.found -or $sug2.found) {
    $output["priv_disable_start_suggestions"] = @{ is_on = $false; current_value = $sugStr }
} else {
    $output["priv_disable_start_suggestions"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_tips_tricks (2 entries)
$tt1 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338389Enabled" -ValueOn 0
$tt2 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SoftLandingEnabled" -ValueOn 0
$ttVal = @($tt1, $tt2) | ForEach-Object { if ($_.found) { "$($_.current)" } else { "N/A" } }
$ttStr = $ttVal -join "/"
if ($tt1.found -and $tt2.found) {
    $output["priv_disable_tips_tricks"] = @{ is_on = ($tt1.is_on -and $tt2.is_on); current_value = $ttStr }
} elseif ($tt1.found -or $tt2.found) {
    $output["priv_disable_tips_tricks"] = @{ is_on = $false; current_value = $ttStr }
} else {
    $output["priv_disable_tips_tricks"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_settings_suggestions (3 entries)
$ss1 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-338393Enabled" -ValueOn 0
$ss2 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-353694Enabled" -ValueOn 0
$ss3 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-353696Enabled" -ValueOn 0
$ssVal = @($ss1, $ss2, $ss3) | ForEach-Object { if ($_.found) { "$($_.current)" } else { "N/A" } }
$ssStr = $ssVal -join "/"
if ($ss1.found -and $ss2.found -and $ss3.found) {
    $output["priv_disable_settings_suggestions"] = @{ is_on = ($ss1.is_on -and $ss2.is_on -and $ss3.is_on); current_value = $ssStr }
} elseif ($ss1.found -or $ss2.found -or $ss3.found) {
    $output["priv_disable_settings_suggestions"] = @{ is_on = $false; current_value = $ssStr }
} else {
    $output["priv_disable_settings_suggestions"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_device_setup_suggestions
Set-SingleHkcu -Id "priv_disable_device_setup_suggestions" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\UserProfileEngagement" -Name "ScoobeSystemSettingEnabled" -ValueOn 0

# priv_disable_app_notifications
Set-SingleHkcu -Id "priv_disable_app_notifications" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\PushNotifications" -Name "ToastEnabled" -ValueOn 0

# priv_disable_local_language (REG_SZ value)
Set-SingleHkcu -Id "priv_disable_local_language" -Path "HKCU:\SOFTWARE\Microsoft\Internet Explorer\International" -Name "AcceptLanguage" -ValueOn "en-US,en;q=0.9"

# priv_disable_text_suggestions_keyboard
Set-SingleHkcu -Id "priv_disable_text_suggestions_keyboard" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-88000327Enabled" -ValueOn 0

# priv_disable_url_to_store
Set-SingleHkcu -Id "priv_disable_url_to_store" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-88000328Enabled" -ValueOn 0

# ── Activity History & Clipboard ───────────────────────────────────────

# priv_disable_activity_history (HKLM, 2 entries)
$act1 = Test-RegOnAdmin -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "EnableActivityFeed" -ValueOn 0
$act2 = Test-RegOnAdmin -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "PublishUserActivities" -ValueOn 0
if ("$($act1.current)" -eq "need_admin" -or "$($act2.current)" -eq "need_admin") {
    $output["priv_disable_activity_history"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($act1.found -and $act2.found) {
    $output["priv_disable_activity_history"] = @{ is_on = ($act1.is_on -and $act2.is_on); current_value = "$($act1.current)/$($act2.current)" }
} elseif ($act1.found -or $act2.found) {
    $actVal = @($act1, $act2) | ForEach-Object { if ($_.found) { "$($_.current)" } else { "N/A" } }
    $output["priv_disable_activity_history"] = @{ is_on = $false; current_value = ($actVal -join "/") }
} else {
    $output["priv_disable_activity_history"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_clipboard_history (HKLM)
Set-SingleHklm -Id "priv_disable_clipboard_history" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "AllowClipboardHistory" -ValueOn 0

# priv_disable_cloud_clipboard (HKLM)
Set-SingleHklm -Id "priv_disable_cloud_clipboard" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "AllowCrossDeviceClipboard" -ValueOn 0

# ── App Privacy (ConsentStore entries) ────────────────────────────────

# All ConsentStore settings follow the same pattern: Value = "Deny" means on
$consentStorePath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore"

$consentEntries = @(
    @{ id = "priv_app_account_info";      key = "userAccountInformation" },
    @{ id = "priv_app_diagnostics";       key = "appDiagnostics" },
    @{ id = "priv_app_generative_ai";     key = "generativeAI" },
    @{ id = "priv_app_presence";          key = "humanPresence" },
    @{ id = "priv_app_location";          key = "location" },
    @{ id = "priv_app_camera";            key = "webcam" },
    @{ id = "priv_app_microphone";        key = "microphone" },
    @{ id = "priv_app_notifications";     key = "userNotificationListener" },
    @{ id = "priv_app_movements";         key = "activity" },
    @{ id = "priv_app_contacts";          key = "contacts" },
    @{ id = "priv_app_calendar";          key = "appointments" },
    @{ id = "priv_app_phone_calls";       key = "phoneCall" },
    @{ id = "priv_app_call_history";      key = "phoneCallHistory" },
    @{ id = "priv_app_email";             key = "email" },
    @{ id = "priv_app_tasks";             key = "userDataTasks" },
    @{ id = "priv_app_messages";          key = "chat" },
    @{ id = "priv_app_wireless";          key = "wirelessDevices" },
    @{ id = "priv_app_loosely_coupled";   key = "looselyCoupledDevice" },
    @{ id = "priv_app_documents";        key = "documentsLibrary" },
    @{ id = "priv_app_pictures";          key = "picturesLibrary" },
    @{ id = "priv_app_videos";            key = "videosLibrary" },
    @{ id = "priv_app_file_system";       key = "broadFileSystemAccess" },
    @{ id = "priv_app_wireless_tech";     key = "radios" },
    @{ id = "priv_app_eye_tracking";      key = "gazeInput" },
    @{ id = "priv_app_screenshots";       key = "graphicsCapture" },
    @{ id = "priv_app_screenshots_desktop"; key = "graphicsCaptureWithoutBorder" },
    @{ id = "priv_app_music";             key = "musicLibrary" },
    @{ id = "priv_app_downloads";         key = "downloadsFolder" },
    @{ id = "priv_app_passkeys";          key = "passkeyManager" },
    @{ id = "priv_app_bluetooth";          key = "bluetoothSync" },
    @{ id = "priv_app_hid";               key = "humanInterfaceDevice" },
    @{ id = "priv_app_custom_sensors";    key = "customDevice" },
    @{ id = "priv_app_serial";            key = "serialCommunication" },
    @{ id = "priv_app_usb";               key = "usb" },
    @{ id = "priv_app_wifi_info";         key = "wiFiData" },
    @{ id = "priv_app_wifi_direct";       key = "wiFiDirect" }
)

foreach ($entry in $consentEntries) {
    $path = "$consentStorePath\$($entry.key)"
    $val = (Get-ItemProperty -Path $path -Name "Value" -ErrorAction SilentlyContinue).Value
    if ($null -ne $val) {
        $output[$entry.id] = @{ is_on = ($val -eq "Deny"); current_value = "$val" }
    } else {
        $output[$entry.id] = @{ is_on = $null; current_value = $null }
    }
}

# priv_app_tracking_launches (uses Explorer\Advanced, not ConsentStore)
Set-SingleHkcu -Id "priv_app_tracking_launches" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_TrackProgs" -ValueOn 0

# priv_app_voice_activation (HKLM)
Set-SingleHklm -Id "priv_app_voice_activation" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy" -Name "LetAppsActivateWithVoice" -ValueOn 2

# priv_app_voice_activation_lock (HKLM)
Set-SingleHklm -Id "priv_app_voice_activation_lock" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\AppPrivacy" -Name "LetAppsActivateWithVoiceAboveLock" -ValueOn 2

# priv_app_background (uses BackgroundAccessApplications, not ConsentStore)
Set-SingleHkcu -Id "priv_app_background" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications" -Name "GlobalUserDisabled" -ValueOn 1

# ── Microsoft Edge (Legacy) ───────────────────────────────────────────

# priv_edge_legacy_tracking
Set-SingleHkcu -Id "priv_edge_legacy_tracking" -Path "HKCU:\SOFTWARE\Microsoft\Internet Explorer\Main\Extensions\Extensibility\{A0764A6E-4E0B-4A4E-AE2B-B3C957BD35F8}" -Name "Enabled" -ValueOn 0

# priv_edge_legacy_page_prediction
Set-SingleHkcu -Id "priv_edge_legacy_page_prediction" -Path "HKCU:\SOFTWARE\Microsoft\Internet Explorer\Main" -Name "EnablePagePrediction" -ValueOn 0

# priv_edge_legacy_search_suggestions
Set-SingleHkcu -Id "priv_edge_legacy_search_suggestions" -Path "HKCU:\SOFTWARE\Microsoft\Internet Explorer\Main" -Name "ShowSearchSuggestions" -ValueOn 0

# priv_edge_legacy_cortana
Set-SingleHkcu -Id "priv_edge_legacy_cortana" -Path "HKCU:\SOFTWARE\Microsoft\Internet Explorer\Main" -Name "CortanaConsent" -ValueOn 0

# priv_edge_legacy_search_history (value_on=1, inverted)
Set-SingleHkcu -Id "priv_edge_legacy_search_history" -Path "HKCU:\SOFTWARE\Microsoft\Internet Explorer\Main" -Name "bDisableSearchHistory" -ValueOn 1

# priv_edge_legacy_form_suggestions (REG_SZ value_on="no")
Set-SingleHkcu -Id "priv_edge_legacy_form_suggestions" -Path "HKCU:\SOFTWARE\Microsoft\Internet Explorer\Main" -Name "Use FormSuggest" -ValueOn "no"

# priv_edge_legacy_media_licenses
Set-SingleHkcu -Id "priv_edge_legacy_media_licenses" -Path "HKCU:\SOFTWARE\Microsoft\Internet Explorer\Main" -Name "PlayWithDragDropInTab" -ValueOn 0

# priv_edge_legacy_smartscreen
Set-SingleHkcu -Id "priv_edge_legacy_smartscreen" -Path "HKCU:\SOFTWARE\Microsoft\Internet Explorer\PhishingFilter" -Name "EnabledV9" -ValueOn 0

# ── Microsoft Edge (Chromium) ──────────────────────────────────────────

# priv_edge_tracking_prevention (HKLM)
Set-SingleHklm -Id "priv_edge_tracking_prevention" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "TrackingPrevention" -ValueOn 3

# priv_edge_credit_cards (HKLM)
Set-SingleHklm -Id "priv_edge_credit_cards" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "AutofillCreditCardEnabled" -ValueOn 0

# priv_edge_form_suggestions (HKLM)
Set-SingleHklm -Id "priv_edge_form_suggestions" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "AutofillAddressEnabled" -ValueOn 0

# priv_edge_search_suggestions (HKLM)
Set-SingleHklm -Id "priv_edge_search_suggestions" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "SearchSuggestEnabled" -ValueOn 0

# priv_edge_shopping (HKLM)
Set-SingleHklm -Id "priv_edge_shopping" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "EdgeShoppingAssistantEnabled" -ValueOn 0

# priv_edge_sidebar (HKLM)
Set-SingleHklm -Id "priv_edge_sidebar" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "HubsSidebarEnabled" -ValueOn 0

# priv_edge_bing_chat (HKLM)
Set-SingleHklm -Id "priv_edge_bing_chat" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "NewTabPageBingChatEnabled" -ValueOn 0

# priv_edge_copilot_context (HKLM)
Set-SingleHklm -Id "priv_edge_copilot_context" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "CopilotPageContextEnabled" -ValueOn 0

# priv_edge_diagnostic_data (HKLM)
Set-SingleHklm -Id "priv_edge_diagnostic_data" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "DiagnosticData" -ValueOn 0

# priv_edge_startup_boost (HKLM)
Set-SingleHklm -Id "priv_edge_startup_boost" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "BackgroundModeEnabled" -ValueOn 0

# priv_edge_smartscreen (HKLM, Edge Chromium)
Set-SingleHklm -Id "priv_edge_smartscreen" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "SmartScreenEnabled" -ValueOn 0

# priv_edge_default_browser (HKLM)
Set-SingleHklm -Id "priv_edge_default_browser" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Edge" -Name "DefaultBrowserSettingEnabled" -ValueOn 0

# ── Microsoft Office ────────────────────────────────────────────────────

# priv_office_telemetry (HKLM)
Set-SingleHklm -Id "priv_office_telemetry" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Office\16.0\Common\Telemetry" -Name "DisableTelemetry" -ValueOn 1

# priv_office_diagnostics (HKLM)
Set-SingleHklm -Id "priv_office_diagnostics" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Office\16.0\Common\Diagnostics" -Name "DisableDiagnostics" -ValueOn 1

# priv_office_ceip (HKLM)
Set-SingleHklm -Id "priv_office_ceip" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Office\16.0\Common\Feedback" -Name "Enabled" -ValueOn 0

# priv_office_linkedin (HKCU)
Set-SingleHkcu -Id "priv_office_linkedin" -Path "HKCU:\SOFTWARE\Microsoft\Office\16.0\Common\LinkedIn" -Name "LinkedInAvailable" -ValueOn 0

# priv_office_text_prediction (HKCU)
Set-SingleHkcu -Id "priv_office_text_prediction" -Path "HKCU:\SOFTWARE\Microsoft\Office\16.0\Common\AutoCorrect" -Name "ShowTextPredictions" -ValueOn 0

# priv_office_surveys (HKCU)
Set-SingleHkcu -Id "priv_office_surveys" -Path "HKCU:\SOFTWARE\Microsoft\Office\16.0\Common\Feedback" -Name "SurveyEnabled" -ValueOn 0

# priv_office_feedback (HKLM)
Set-SingleHklm -Id "priv_office_feedback" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Office\16.0\Common\Feedback" -Name "FeedbackEnabled" -ValueOn 0

# priv_office_connected_experiences (HKCU)
Set-SingleHkcu -Id "priv_office_connected_experiences" -Path "HKCU:\SOFTWARE\Microsoft\Office\16.0\Common\Privacy" -Name "DisconnectedState" -ValueOn 1

# ── Windows Settings Sync ───────────────────────────────────────────────

# priv_sync_themes
Set-SingleHkcu -Id "priv_sync_themes" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SettingSync\Groups\Personalization" -Name "Enabled" -ValueOn 0

# priv_sync_browser
Set-SingleHkcu -Id "priv_sync_browser" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SettingSync\Groups\BrowserSettings" -Name "Enabled" -ValueOn 0

# priv_sync_passwords
Set-SingleHkcu -Id "priv_sync_passwords" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SettingSync\Groups\Credentials" -Name "Enabled" -ValueOn 0

# priv_sync_language
Set-SingleHkcu -Id "priv_sync_language" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SettingSync\Groups\Language" -Name "Enabled" -ValueOn 0

# priv_sync_accessibility
Set-SingleHkcu -Id "priv_sync_accessibility" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SettingSync\Groups\Accessibility" -Name "Enabled" -ValueOn 0

# priv_sync_advanced
Set-SingleHkcu -Id "priv_sync_advanced" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SettingSync\Groups\Windows" -Name "Enabled" -ValueOn 0

# ── Cortana ────────────────────────────────────────────────────────────

# priv_disable_cortana (HKLM)
Set-SingleHklm -Id "priv_disable_cortana" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search" -Name "AllowCortana" -ValueOn 0

# priv_cortana_lock_screen (HKLM)
Set-SingleHklm -Id "priv_cortana_lock_screen" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search" -Name "AllowCortanaAboveLock" -ValueOn 0

# priv_cortana_input_personalization (3 HKCU entries, all must match "on")
$cip1 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\InputPersonalization" -Name "RestrictImplicitTextCollection" -ValueOn 1
$cip2 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\InputPersonalization" -Name "RestrictImplicitInkCollection" -ValueOn 1
$cip3 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\InputPersonalization\TrainedDataStore" -Name "HarvestContacts" -ValueOn 0
$cipAllFound = ($cip1.found -and $cip2.found -and $cip3.found)
$cipAnyFound = ($cip1.found -or $cip2.found -or $cip3.found)
$cipVal = @($cip1, $cip2, $cip3) | ForEach-Object { if ($_.found) { "$($_.current)" } else { "N/A" } }
$cipStr = $cipVal -join "/"
if ($cipAllFound) {
    $output["priv_cortana_input_personalization"] = @{ is_on = ($cip1.is_on -and $cip2.is_on -and $cip3.is_on); current_value = $cipStr }
} elseif ($cipAnyFound) {
    $output["priv_cortana_input_personalization"] = @{ is_on = $false; current_value = $cipStr }
} else {
    $output["priv_cortana_input_personalization"] = @{ is_on = $null; current_value = $null }
}

# ── Copilot & Windows AI ───────────────────────────────────────────────

# priv_disable_copilot (HKCU + HKLM, both must match)
$cpHkcu = Test-RegOn -Path "HKCU:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" -Name "TurnOffWindowsCopilot" -ValueOn 1
$cpHklm = Test-RegOnAdmin -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsCopilot" -Name "TurnOffWindowsCopilot" -ValueOn 1
if ("$($cpHklm.current)" -eq "need_admin") {
    $output["priv_disable_copilot"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($cpHkcu.found -and $cpHklm.found) {
    $output["priv_disable_copilot"] = @{ is_on = ($cpHkcu.is_on -and $cpHklm.is_on); current_value = "$($cpHkcu.current)/$($cpHklm.current)" }
} elseif ($cpHkcu.found -or $cpHklm.found) {
    $cpVal = @($cpHkcu, $cpHklm) | ForEach-Object { if ($_.found) { "$($_.current)" } else { "N/A" } }
    $output["priv_disable_copilot"] = @{ is_on = $false; current_value = ($cpVal -join "/") }
} else {
    $output["priv_disable_copilot"] = @{ is_on = $null; current_value = $null }
}

# priv_copilot_button
Set-SingleHkcu -Id "priv_copilot_button" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowCopilotButton" -ValueOn 0

# priv_bing_chat_eligibility
Set-SingleHkcu -Id "priv_bing_chat_eligibility" -Path "HKCU:\SOFTWARE\Microsoft\Windows\Shell\Copilot" -Name "IsUserEligible" -ValueOn 0

# priv_disable_recall (HKLM)
Set-SingleHklm -Id "priv_disable_recall" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsAI" -Name "DisableAIDataAnalysis" -ValueOn 1

# ── User Behavior ──────────────────────────────────────────────────────

# priv_tailored_experiences
Set-SingleHkcu -Id "priv_tailored_experiences" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Privacy" -Name "TailoredExperiencesWithDiagnosticDataEnabled" -ValueOn 0

# priv_handwriting_sharing (HKLM)
Set-SingleHklm -Id "priv_handwriting_sharing" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\HandwritingPrivacyDefault" -Name "PreventHandwritingDataSharing" -ValueOn 1

# priv_speech_data_collection (HKLM)
Set-SingleHklm -Id "priv_speech_data_collection" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Speech" -Name "AllowSpeechDataCollection" -ValueOn 0

# ── Windows Explorer ───────────────────────────────────────────────────

# priv_start_recommendations
Set-SingleHkcu -Id "priv_start_recommendations" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_IrisRecommendations" -ValueOn 0

# priv_recent_files_jumplist
Set-SingleHkcu -Id "priv_recent_files_jumplist" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Start_TrackDocs" -ValueOn 0

# priv_explorer_ads
Set-SingleHkcu -Id "priv_explorer_ads" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowSyncProviderNotifications" -ValueOn 0

# ── Lock Screen ────────────────────────────────────────────────────────

# priv_lock_screen_spotlight (HKLM + HKCU, both must match)
$lsHklm = Test-RegOnAdmin -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent" -Name "DisableWindowsSpotlight" -ValueOn 1
$lsHkcu = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "RotatingLockScreenEnabled" -ValueOn 0
if ("$($lsHklm.current)" -eq "need_admin") {
    $output["priv_lock_screen_spotlight"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($lsHklm.found -and $lsHkcu.found) {
    $output["priv_lock_screen_spotlight"] = @{ is_on = ($lsHklm.is_on -and $lsHkcu.is_on); current_value = "$($lsHklm.current)/$($lsHkcu.current)" }
} elseif ($lsHklm.found -or $lsHkcu.found) {
    $lsVal = @($lsHklm, $lsHkcu) | ForEach-Object { if ($_.found) { "$($_.current)" } else { "N/A" } }
    $output["priv_lock_screen_spotlight"] = @{ is_on = $false; current_value = ($lsVal -join "/") }
} else {
    $output["priv_lock_screen_spotlight"] = @{ is_on = $null; current_value = $null }
}

# priv_lock_screen_fun_facts
Set-SingleHkcu -Id "priv_lock_screen_fun_facts" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "RotatingLockScreenOverlayEnabled" -ValueOn 0

# priv_lock_screen_notifications (HKLM)
Set-SingleHklm -Id "priv_lock_screen_notifications" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\System" -Name "DisableLockScreenAppNotifications" -ValueOn 1

# ── Mobile Devices ─────────────────────────────────────────────────────

# priv_phone_link
Set-SingleHkcu -Id "priv_phone_link" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\CDP" -Name "EnableProximitySetting" -ValueOn 0

# priv_mobile_suggestions
Set-SingleHkcu -Id "priv_mobile_suggestions" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\ContentDeliveryManager" -Name "SubscribedContent-88000330Enabled" -ValueOn 0

# ── Search ──────────────────────────────────────────────────────────────

# priv_bing_search (2 HKCU entries)
$bs1 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search" -Name "BingSearchEnabled" -ValueOn 0
$bs2 = Test-RegOn -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search" -Name "CortanaConsent" -ValueOn 0
$bsVal = @($bs1, $bs2) | ForEach-Object { if ($_.found) { "$($_.current)" } else { "N/A" } }
$bsStr = $bsVal -join "/"
if ($bs1.found -and $bs2.found) {
    $output["priv_bing_search"] = @{ is_on = ($bs1.is_on -and $bs2.is_on); current_value = $bsStr }
} elseif ($bs1.found -or $bs2.found) {
    $output["priv_bing_search"] = @{ is_on = $false; current_value = $bsStr }
} else {
    $output["priv_bing_search"] = @{ is_on = $null; current_value = $null }
}

# priv_cloud_search
Set-SingleHkcu -Id "priv_cloud_search" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SearchSettings" -Name "IsCloudContentSearchEnabled" -ValueOn 0

# priv_device_search_history
Set-SingleHkcu -Id "priv_device_search_history" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\SearchSettings" -Name "IsDeviceSearchHistoryEnabled" -ValueOn 0

# priv_search_location (HKLM)
Set-SingleHklm -Id "priv_search_location" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Windows Search" -Name "AllowSearchToUseLocation" -ValueOn 0

# ── Taskbar ─────────────────────────────────────────────────────────────

# priv_taskbar_search
Set-SingleHkcu -Id "priv_taskbar_search" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Search" -Name "SearchboxTaskbarMode" -ValueOn 0

# priv_taskbar_people
Set-SingleHkcu -Id "priv_taskbar_people" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced\People" -Name "PeopleBand" -ValueOn 0

# priv_taskbar_meet_now
Set-SingleHkcu -Id "priv_taskbar_meet_now" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Communications" -Name "ConfigureChatAccount" -ValueOn 0

# ── Miscellaneous ──────────────────────────────────────────────────────

# priv_feedback_notifications (HKLM)
Set-SingleHklm -Id "priv_feedback_notifications" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection" -Name "DoNotShowFeedbackNotifications" -ValueOn 1

# priv_consumer_features (HKLM)
Set-SingleHklm -Id "priv_consumer_features" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent" -Name "DisableWindowsConsumerFeatures" -ValueOn 1

# priv_soft_landing (HKLM)
Set-SingleHklm -Id "priv_soft_landing" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent" -Name "DisableSoftLanding" -ValueOn 1

# priv_diagnostic_data (HKLM)
Set-SingleHklm -Id "priv_diagnostic_data" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DataCollection" -Name "AllowTelemetry" -ValueOn 0

# priv_account_notifications
Set-SingleHkcu -Id "priv_account_notifications" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowAccountNotifications" -ValueOn 0

# ── Windows Update ──────────────────────────────────────────────────────

# priv_exclude_driver_updates (HKLM)
Set-SingleHklm -Id "priv_exclude_driver_updates" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate" -Name "ExcludeWUDriversInQualityUpdate" -ValueOn 1

# priv_no_auto_restart (HKLM)
Set-SingleHklm -Id "priv_no_auto_restart" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU" -Name "NoAutoRebootWithLoggedOnUsers" -ValueOn 1

# priv_delivery_optimization (HKLM registry + service check)
$doDlMode = Test-RegOnAdmin -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeliveryOptimization" -Name "DODownloadMode" -ValueOn 0
$doSvc = Get-Service -Name "DoSvc" -ErrorAction SilentlyContinue
$doSvcStr = if ($doSvc) { "$($doSvc.Status)/$($doSvc.StartType)" } else { "not_found" }
if ($doDlMode.found) {
    $output["priv_delivery_optimization"] = @{ is_on = $doDlMode.is_on; current_value = "$($doDlMode.current) svc=$doSvcStr" }
} else {
    $output["priv_delivery_optimization"] = @{ is_on = $null; current_value = $null }
}

# priv_auto_update_store_apps (HKLM)
Set-SingleHklm -Id "priv_auto_update_store_apps" -Path "HKLM:\SOFTWARE\Policies\Microsoft\WindowsStore" -Name "AutoDownload" -ValueOn 2

# ── Defender ───────────────────────────────────────────────────────────

# priv_defender_sac (HKLM)
Set-SingleHklm -Id "priv_defender_sac" -Path "HKLM:\SOFTWARE\Microsoft\Windows Security Health\State" -Name "AppAndBrowser_SmartAppControlEnabled" -ValueOn 1

# priv_defender_pua (HKLM)
Set-SingleHklm -Id "priv_defender_pua" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender" -Name "PUAProtection" -ValueOn 1

# priv_defender_cfa (HKLM)
Set-SingleHklm -Id "priv_defender_cfa" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender\Windows Defender Exploit Guard\Controlled Folder Access" -Name "EnableControlledFolderAccess" -ValueOn 1

# priv_defender_tamper (HKLM)
Set-SingleHklm -Id "priv_defender_tamper" -Path "HKLM:\SOFTWARE\Microsoft\Windows Defender\Features" -Name "TamperProtection" -ValueOn 1

# priv_defender_cloud_protection (HKLM)
Set-SingleHklm -Id "priv_defender_cloud_protection" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender\Spynet" -Name "SpyNetReporting" -ValueOn 2

# ── Networking ─────────────────────────────────────────────────────────

# priv_disable_smbv1 (HKLM)
Set-SingleHklm -Id "priv_disable_smbv1" -Path "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters" -Name "SMB1" -ValueOn 0

# priv_disable_netbios (HKLM)
Set-SingleHklm -Id "priv_disable_netbios" -Path "HKLM:\SYSTEM\CurrentControlSet\Services\NetBT\Parameters" -Name "NoNameReleaseOnDemand" -ValueOn 1

# priv_disable_llmnr (HKLM)
Set-SingleHklm -Id "priv_disable_llmnr" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Name "EnableLLMNR" -ValueOn 0

# priv_disable_mdns (HKLM)
Set-SingleHklm -Id "priv_disable_mdns" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient" -Name "EnableMulticast" -ValueOn 0

# priv_disable_teredo (HKLM, REG_SZ)
Set-SingleHklm -Id "priv_disable_teredo" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\TCPIP\v6Transition" -Name "Teredo_State" -ValueOn "disabled"

# priv_disable_ipv6 (HKLM)
Set-SingleHklm -Id "priv_disable_ipv6" -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip6\Parameters" -Name "DisabledComponents" -ValueOn 255

# priv_disable_network_discovery (HKLM)
Set-SingleHklm -Id "priv_disable_network_discovery" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\NetworkDiscovery" -Name "AllowNetworkDiscovery" -ValueOn 0

# priv_disable_remote_assistance (HKLM)
Set-SingleHklm -Id "priv_disable_remote_assistance" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services" -Name "fAllowToGetHelp" -ValueOn 0

# priv_disable_remote_registry (HKLM registry + service check)
$rrReg = Test-RegOnAdmin -Path "HKLM:\SYSTEM\CurrentControlSet\Services\RemoteRegistry" -Name "Start" -ValueOn 4
$rrSvc = Get-Service -Name "RemoteRegistry" -ErrorAction SilentlyContinue
$rrSvcStr = if ($rrSvc) { "$($rrSvc.Status)/$($rrSvc.StartType)" } else { "not_found" }
if ("$($rrReg.current)" -eq "need_admin") {
    $output["priv_disable_remote_registry"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($rrReg.found) {
    $output["priv_disable_remote_registry"] = @{ is_on = $rrReg.is_on; current_value = "$($rrReg.current) svc=$rrSvcStr" }
} else {
    $output["priv_disable_remote_registry"] = @{ is_on = $null; current_value = $null }
}

# ── Explorer UI ────────────────────────────────────────────────────────

# priv_show_hidden_files
Set-SingleHkcu -Id "priv_show_hidden_files" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "Hidden" -ValueOn 1

# priv_show_file_extensions
Set-SingleHkcu -Id "priv_show_file_extensions" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "HideFileExt" -ValueOn 0

# priv_show_protected_os_files
Set-SingleHkcu -Id "priv_show_protected_os_files" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "ShowSuperHidden" -ValueOn 1

# priv_classic_context_menu — enabled when key exists (default value is empty string)
$privCtxKey = "HKCU:\SOFTWARE\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32"
if (Test-Path -Path $privCtxKey) {
    $output["priv_classic_context_menu"] = @{ is_on = $true; current_value = "enabled" }
} else {
    $output["priv_classic_context_menu"] = @{ is_on = $false; current_value = "disabled" }
}

# priv_compact_mode
Set-SingleHkcu -Id "priv_compact_mode" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "UseCompactMode" -ValueOn 1

# priv_separate_process
Set-SingleHkcu -Id "priv_separate_process" -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name "SeparateProcess" -ValueOn 1

# ── Security ───────────────────────────────────────────────────────────

# priv_firewall_domain (HKLM)
Set-SingleHklm -Id "priv_firewall_domain" -Path "HKLM:\SOFTWARE\Policies\Microsoft\WindowsFirewall\DomainProfile" -Name "EnableFirewall" -ValueOn 1

# priv_firewall_public (HKLM)
Set-SingleHklm -Id "priv_firewall_public" -Path "HKLM:\SOFTWARE\Policies\Microsoft\WindowsFirewall\PublicProfile" -Name "EnableFirewall" -ValueOn 1

# priv_firewall_private (HKLM)
Set-SingleHklm -Id "priv_firewall_private" -Path "HKLM:\SOFTWARE\Policies\Microsoft\WindowsFirewall\StandardProfile" -Name "EnableFirewall" -ValueOn 1

# priv_credential_guard (HKLM, 2 entries)
$cg1 = Test-RegOnAdmin -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceGuard" -Name "EnableVirtualizationBasedSecurity" -ValueOn 1
$cg2 = Test-RegOnAdmin -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceGuard" -Name "LsaCfgFlags" -ValueOn 1
if ("$($cg1.current)" -eq "need_admin" -or "$($cg2.current)" -eq "need_admin") {
    $output["priv_credential_guard"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($cg1.found -and $cg2.found) {
    $output["priv_credential_guard"] = @{ is_on = ($cg1.is_on -and $cg2.is_on); current_value = "$($cg1.current)/$($cg2.current)" }
} elseif ($cg1.found -or $cg2.found) {
    $cgVal = @($cg1, $cg2) | ForEach-Object { if ($_.found) { "$($_.current)" } else { "N/A" } }
    $output["priv_credential_guard"] = @{ is_on = $false; current_value = ($cgVal -join "/") }
} else {
    $output["priv_credential_guard"] = @{ is_on = $null; current_value = $null }
}

# priv_core_isolation (HKLM)
Set-SingleHklm -Id "priv_core_isolation" -Path "HKLM:\SYSTEM\CurrentControlSet\Control\DeviceGuard\Scenarios\HypervisorEnforcedCodeIntegrity" -Name "Enabled" -ValueOn 1

# priv_vbs (HKLM)
Set-SingleHklm -Id "priv_vbs" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\DeviceGuard" -Name "EnableVirtualizationBasedSecurity" -ValueOn 1

# priv_bitlocker (HKLM)
Set-SingleHklm -Id "priv_bitlocker" -Path "HKLM:\SOFTWARE\Policies\Microsoft\FVE" -Name "FDVEncryptionType" -ValueOn 1

# priv_windows_sandbox (HKLM)
Set-SingleHklm -Id "priv_windows_sandbox" -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Sandbox" -Name "AllowWindowsSandbox" -ValueOn 1

# ── Services ───────────────────────────────────────────────────────────

# priv_disable_xbox_services (HKLM registry + service check)
$xboxReg = Test-RegOnAdmin -Path "HKLM:\SYSTEM\CurrentControlSet\Services\XblAuthManager" -Name "Start" -ValueOn 4
$xboxSvc = Get-Service -Name "XblAuthManager" -ErrorAction SilentlyContinue
$xboxSvcStr = if ($xboxSvc) { "$($xboxSvc.Status)/$($xboxSvc.StartType)" } else { "not_found" }
if ("$($xboxReg.current)" -eq "need_admin") {
    $output["priv_disable_xbox_services"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($xboxReg.found) {
    $output["priv_disable_xbox_services"] = @{ is_on = $xboxReg.is_on; current_value = "$($xboxReg.current) svc=$xboxSvcStr" }
} else {
    $output["priv_disable_xbox_services"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_print_spooler (HKLM registry + service check)
$psReg = Test-RegOnAdmin -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Spooler" -Name "Start" -ValueOn 4
$psSvc = Get-Service -Name "Spooler" -ErrorAction SilentlyContinue
$psSvcStr = if ($psSvc) { "$($psSvc.Status)/$($psSvc.StartType)" } else { "not_found" }
if ("$($psReg.current)" -eq "need_admin") {
    $output["priv_disable_print_spooler"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($psReg.found) {
    $output["priv_disable_print_spooler"] = @{ is_on = $psReg.is_on; current_value = "$($psReg.current) svc=$psSvcStr" }
} else {
    $output["priv_disable_print_spooler"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_fax_service (HKLM registry + service check)
$fxReg = Test-RegOnAdmin -Path "HKLM:\SYSTEM\CurrentControlSet\Services\Fax" -Name "Start" -ValueOn 4
$fxSvc = Get-Service -Name "Fax" -ErrorAction SilentlyContinue
$fxSvcStr = if ($fxSvc) { "$($fxSvc.Status)/$($fxSvc.StartType)" } else { "not_found" }
if ("$($fxReg.current)" -eq "need_admin") {
    $output["priv_disable_fax_service"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($fxReg.found) {
    $output["priv_disable_fax_service"] = @{ is_on = $fxReg.is_on; current_value = "$($fxReg.current) svc=$fxSvcStr" }
} else {
    $output["priv_disable_fax_service"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_bluetooth_service (HKLM registry + service check)
$btReg = Test-RegOnAdmin -Path "HKLM:\SYSTEM\CurrentControlSet\Services\bthserv" -Name "Start" -ValueOn 4
$btSvc = Get-Service -Name "bthserv" -ErrorAction SilentlyContinue
$btSvcStr = if ($btSvc) { "$($btSvc.Status)/$($btSvc.StartType)" } else { "not_found" }
if ("$($btReg.current)" -eq "need_admin") {
    $output["priv_disable_bluetooth_service"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($btReg.found) {
    $output["priv_disable_bluetooth_service"] = @{ is_on = $btReg.is_on; current_value = "$($btReg.current) svc=$btSvcStr" }
} else {
    $output["priv_disable_bluetooth_service"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_rds (HKLM registry + service check)
$rdsReg = Test-RegOnAdmin -Path "HKLM:\SYSTEM\CurrentControlSet\Services\TermService" -Name "Start" -ValueOn 4
$rdsSvc = Get-Service -Name "TermService" -ErrorAction SilentlyContinue
$rdsSvcStr = if ($rdsSvc) { "$($rdsSvc.Status)/$($rdsSvc.StartType)" } else { "not_found" }
if ("$($rdsReg.current)" -eq "need_admin") {
    $output["priv_disable_rds"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($rdsReg.found) {
    $output["priv_disable_rds"] = @{ is_on = $rdsReg.is_on; current_value = "$($rdsReg.current) svc=$rdsSvcStr" }
} else {
    $output["priv_disable_rds"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_geolocation_service (HKLM registry + service check)
$geoReg = Test-RegOnAdmin -Path "HKLM:\SYSTEM\CurrentControlSet\Services\lfsvc" -Name "Start" -ValueOn 4
$geoSvc = Get-Service -Name "lfsvc" -ErrorAction SilentlyContinue
$geoSvcStr = if ($geoSvc) { "$($geoSvc.Status)/$($geoSvc.StartType)" } else { "not_found" }
if ("$($geoReg.current)" -eq "need_admin") {
    $output["priv_disable_geolocation_service"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($geoReg.found) {
    $output["priv_disable_geolocation_service"] = @{ is_on = $geoReg.is_on; current_value = "$($geoReg.current) svc=$geoSvcStr" }
} else {
    $output["priv_disable_geolocation_service"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_sensor_service (HKLM registry + service check)
$sensReg = Test-RegOnAdmin -Path "HKLM:\SYSTEM\CurrentControlSet\Services\SensorService" -Name "Start" -ValueOn 4
$sensSvc = Get-Service -Name "SensorService" -ErrorAction SilentlyContinue
$sensSvcStr = if ($sensSvc) { "$($sensSvc.Status)/$($sensSvc.StartType)" } else { "not_found" }
if ("$($sensReg.current)" -eq "need_admin") {
    $output["priv_disable_sensor_service"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($sensReg.found) {
    $output["priv_disable_sensor_service"] = @{ is_on = $sensReg.is_on; current_value = "$($sensReg.current) svc=$sensSvcStr" }
} else {
    $output["priv_disable_sensor_service"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_sysmain (HKLM registry + service check)
$smReg = Test-RegOnAdmin -Path "HKLM:\SYSTEM\CurrentControlSet\Services\SysMain" -Name "Start" -ValueOn 4
$smSvc = Get-Service -Name "SysMain" -ErrorAction SilentlyContinue
$smSvcStr = if ($smSvc) { "$($smSvc.Status)/$($smSvc.StartType)" } else { "not_found" }
if ("$($smReg.current)" -eq "need_admin") {
    $output["priv_disable_sysmain"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($smReg.found) {
    $output["priv_disable_sysmain"] = @{ is_on = $smReg.is_on; current_value = "$($smReg.current) svc=$smSvcStr" }
} else {
    $output["priv_disable_sysmain"] = @{ is_on = $null; current_value = $null }
}

# priv_disable_diagtrack (HKLM registry + service check)
$dtReg = Test-RegOnAdmin -Path "HKLM:\SYSTEM\CurrentControlSet\Services\DiagTrack" -Name "Start" -ValueOn 4
$dtSvc = Get-Service -Name "DiagTrack" -ErrorAction SilentlyContinue
$dtSvcStr = if ($dtSvc) { "$($dtSvc.Status)/$($dtSvc.StartType)" } else { "not_found" }
if ("$($dtReg.current)" -eq "need_admin") {
    $output["priv_disable_diagtrack"] = @{ is_on = $null; current_value = "need_admin" }
} elseif ($dtReg.found) {
    $output["priv_disable_diagtrack"] = @{ is_on = $dtReg.is_on; current_value = "$($dtReg.current) svc=$dtSvcStr" }
} else {
    $output["priv_disable_diagtrack"] = @{ is_on = $null; current_value = $null }
}

# ── Output JSON ───────────────────────────────────────────────────────

# Normalize output values to strings for JSON serialization
$jsonOutput = @{}
foreach ($key in $output.Keys) {
    $val = $output[$key]
    $jsonOutput[$key] = @{
        is_on = $val.is_on
        current_value = if ($val.current_value -ne $null) { "$($val.current_value)" } else { $null }
    }
}

$jsonOutput | ConvertTo-Json -Depth 3