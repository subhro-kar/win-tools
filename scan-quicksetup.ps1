# WinSuite - Scan current Quick Setup setting states
# Reads registry values, outputs JSON to stdout
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scan-quicksetup.ps1

$ErrorActionPreference = "SilentlyContinue"
$output = @{}

# ── Snipping & Screenshots ──────────────────────────────────────────────

# Snipping Tool Auto-Save
$sketchPath = "HKCU:\SOFTWARE\Microsoft\ScreenSketch"
$autoSave = (Get-ItemProperty -Path $sketchPath -Name "IsAutoSaveToClipboardEnabled" -ErrorAction SilentlyContinue).IsAutoSaveToClipboardEnabled
if ($null -ne $autoSave) {
    $output["qs_snip_autosave"] = @{ is_on = ($autoSave -eq 0); current_value = $autoSave }
} else {
    $output["qs_snip_autosave"] = @{ is_on = $null; current_value = $null }
}

# Ask to Save Edited Screenshots
$askSave = (Get-ItemProperty -Path $sketchPath -Name "IsAskToSaveOnCloseEnabled" -ErrorAction SilentlyContinue).IsAskToSaveOnCloseEnabled
if ($null -ne $askSave) {
    $output["qs_snip_edited_save"] = @{ is_on = ($askSave -eq 1); current_value = $askSave }
} else {
    $output["qs_snip_edited_save"] = @{ is_on = $null; current_value = $null }
}

# Print Screen for Snipping Tool
$advPath = "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced"
$snippingPrintScreen = (Get-ItemProperty -Path $advPath -Name "SnippingToolWithPrintScreen" -ErrorAction SilentlyContinue).SnippingToolWithPrintScreen
if ($null -ne $snippingPrintScreen) {
    $output["qs_print_screen_snipping"] = @{ is_on = ($snippingPrintScreen -eq 1); current_value = $snippingPrintScreen }
} else {
    $output["qs_print_screen_snipping"] = @{ is_on = $null; current_value = $null }
}

# ── File Explorer ──────────────────────────────────────────────────────

# Open Explorer to This PC
$launchTo = (Get-ItemProperty -Path $advPath -Name "LaunchTo" -ErrorAction SilentlyContinue).LaunchTo
if ($null -ne $launchTo) {
    # value_on=1 (This PC), value_off=0 (Home/Quick Access)
    $output["qs_open_to_this_pc"] = @{ is_on = ($launchTo -eq 1); current_value = $launchTo }
} else {
    $output["qs_open_to_this_pc"] = @{ is_on = $null; current_value = $null }
}

# Classic Context Menu
$contextMenuKey = "HKCU:\SOFTWARE\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32"
$contextMenuExists = Test-Path -Path $contextMenuKey
if ($contextMenuExists) {
    $output["qs_classic_context_menu"] = @{ is_on = $true; current_value = "enabled" }
} else {
    $output["qs_classic_context_menu"] = @{ is_on = $false; current_value = "disabled" }
}

# ── Taskbar & Start ──────────────────────────────────────────────────

# Hide Copilot from Taskbar
$copilotBtn = (Get-ItemProperty -Path $advPath -Name "ShowCopilotButton" -ErrorAction SilentlyContinue).ShowCopilotButton
if ($null -ne $copilotBtn) {
    $output["qs_hide_copilot"] = @{ is_on = ($copilotBtn -eq 0); current_value = $copilotBtn }
} else {
    $output["qs_hide_copilot"] = @{ is_on = $null; current_value = $null }
}

# ── Power & Startup ──────────────────────────────────────────────────

# Disable Fast Startup
$hiberbootPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power"
$hiberboot = (Get-ItemProperty -Path $hiberbootPath -Name "HiberbootEnabled" -ErrorAction SilentlyContinue).HiberbootEnabled
if ($null -ne $hiberboot) {
    # value_on=0 (disabled), value_off=1 (enabled)
    $output["qs_disable_fast_startup"] = @{ is_on = ($hiberboot -eq 0); current_value = $hiberboot }
} else {
    $output["qs_disable_fast_startup"] = @{ is_on = $null; current_value = "need_admin" }
}

# High Performance Power Plan
try {
    $powerPlan = powercfg /getactivescheme 2>$null
    if ($powerPlan -match "8c5e7fda-e8bf-4a96-9a85-a6e23a8c735c") {
        $output["qs_high_performance"] = @{ is_on = $true; current_value = "High Performance" }
    } elseif ($powerPlan -match "381b4222-f694-41f0-9685-ff5bb260df2e") {
        $output["qs_high_performance"] = @{ is_on = $false; current_value = "Balanced" }
    } else {
        $output["qs_high_performance"] = @{ is_on = $false; current_value = "Custom" }
    }
} catch {
    $output["qs_high_performance"] = @{ is_on = $null; current_value = "need_admin" }
}

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