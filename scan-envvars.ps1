# WinSuite - Scan Environment Variables and PATH
# Reads HKCU:\Environment and HKLM:\...\Environment, splits PATH, detects duplicates
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scan-envvars.ps1

$ErrorActionPreference = "SilentlyContinue"

# ── Helper: Read env vars from registry preserving type info ──────────────
function Get-RegistryEnvVars {
    param(
        [string]$Scope  # "user" or "system"
    )

    $vars = @()
    try {
        if ($Scope -eq "user") {
            $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey("Environment")
        } else {
            $key = [Microsoft.Win32.Registry]::LocalMachine.OpenSubKey(
                "SYSTEM\CurrentControlSet\Control\Session Manager\Environment")
        }

        if ($null -eq $key) { return $vars }

        foreach ($valueName in $key.GetValueNames()) {
            # Skip empty/default value
            if ([string]::IsNullOrEmpty($valueName)) { continue }

            # Get raw value without expanding %VARIABLE% references
            $rawValue = $key.GetValue($valueName, $null,
                [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)

            # Get expanded value for display
            $expandedValue = $key.GetValue($valueName, $null,
                [Microsoft.Win32.RegistryValueOptions]::None)

            # Get registry type
            $kind = $key.GetValueKind($valueName)
            $typeStr = switch ($kind) {
                'String'       { 'REG_SZ' }
                'ExpandString' { 'REG_EXPAND_SZ' }
                'DWord'        { 'REG_DWORD' }
                'QWord'        { 'REG_QWORD' }
                'Binary'       { 'REG_BINARY' }
                'MultiString'  { 'REG_MULTI_SZ' }
                default        { $kind.ToString() }
            }

            $vars += @{
                name     = $valueName
                value    = if ($null -ne $rawValue) { "$rawValue" } else { $null }
                expanded = if ($null -ne $expandedValue) { "$expandedValue" } else { $null }
                scope    = $Scope
                type     = $typeStr
            }
        }

        $key.Close()
    } catch {
        # If we can't read (e.g., not admin for HKLM), return empty
    }

    return $vars
}

# ── Check admin status ───────────────────────────────────────────────────
$isAdmin = $false
try {
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
} catch { }

# ── Read all environment variables ────────────────────────────────────────
$userVars = Get-RegistryEnvVars -Scope "user"
$systemVars = Get-RegistryEnvVars -Scope "system"

# If not admin, system vars may be incomplete - mark them
if (-not $isAdmin) {
    # We can still read most system vars even without admin,
    # but mark that we can't modify them
}

# ── Process PATH specifically ────────────────────────────────────────────
$userPathRaw = ""
$systemPathRaw = ""

# Find PATH entries in the variables
foreach ($v in $userVars) {
    if ($v.name -ieq "Path") { $userPathRaw = $v.value }
}
foreach ($v in $systemVars) {
    if ($v.name -ieq "Path") { $systemPathRaw = $v.value }
}

# Split PATH into entries
$userPathParts = @()
$systemPathParts = @()

if ($userPathRaw) {
    $userPathParts = @($userPathRaw -split ';' | Where-Object { $_ -ne '' })
}
if ($systemPathRaw) {
    $systemPathParts = @($systemPathRaw -split ';' | Where-Object { $_ -ne '' })
}

# Build path entries with duplicate detection
$allPathEntries = @()
$seenPaths = @{}
$duplicateCount = 0

# System PATH entries first (they come first in the effective PATH)
$idx = 0
foreach ($part in $systemPathParts) {
    $normalized = $part.ToLowerInvariant().TrimEnd('\')
    $isDuplicate = $false
    if ($seenPaths.ContainsKey($normalized)) {
        $isDuplicate = $true
        $duplicateCount++
    } else {
        $seenPaths[$normalized] = $true
    }

    # Expand env vars for existence check (e.g., %SystemRoot% -> C:\Windows)
    $expandedPart = [Environment]::ExpandEnvironmentVariables($part)
    $pathExists = if ($expandedPart -ne $part) { Test-Path -Path $expandedPart -ErrorAction SilentlyContinue } else { Test-Path -Path $part -ErrorAction SilentlyContinue }

    $allPathEntries += @{
        path         = $part
        scope        = "system"
        is_duplicate = $isDuplicate
        exists       = [bool]$pathExists
        index        = $idx
    }
    $idx++
}

# Then User PATH entries
foreach ($part in $userPathParts) {
    $normalized = $part.ToLowerInvariant().TrimEnd('\')
    $isDuplicate = $false
    if ($seenPaths.ContainsKey($normalized)) {
        $isDuplicate = $true
        $duplicateCount++
    } else {
        $seenPaths[$normalized] = $true
    }

    # Expand env vars for existence check (e.g., %SystemRoot% -> C:\Windows)
    $expandedPart = [Environment]::ExpandEnvironmentVariables($part)
    $pathExists = if ($expandedPart -ne $part) { Test-Path -Path $expandedPart -ErrorAction SilentlyContinue } else { Test-Path -Path $part -ErrorAction SilentlyContinue }

    $allPathEntries += @{
        path         = $part
        scope        = "user"
        is_duplicate = $isDuplicate
        exists       = [bool]$pathExists
        index        = $idx
    }
    $idx++
}

# ── Build output ─────────────────────────────────────────────────────────
$variables = @()

# Combine user and system vars
foreach ($v in $systemVars) {
    $variables += @{
        name     = $v.name
        value    = $v.value
        expanded = $v.expanded
        scope    = "system"
        type     = $v.type
    }
}
foreach ($v in $userVars) {
    $variables += @{
        name     = $v.name
        value    = $v.value
        expanded = $v.expanded
        scope    = "user"
        type     = $v.type
    }
}

# Output JSON — force array for ConvertTo-Json
$variablesJson = if ($variables.Count -le 1) { ,@($variables) | ConvertTo-Json -Depth 3 } else { $variables | ConvertTo-Json -Depth 3 }
$pathEntriesJson = if ($allPathEntries.Count -le 1) { ,@($allPathEntries) | ConvertTo-Json -Depth 3 } else { $allPathEntries | ConvertTo-Json -Depth 3 }

# Build the final output as a hashtable and convert
$output = @{
    variables      = $variables
    path_entries   = $allPathEntries
    path_raw       = @{
        user   = $userPathRaw
        system = $systemPathRaw
    }
    _meta          = @{
        is_admin        = [bool]$isAdmin
        user_count       = $userVars.Count
        system_count     = $systemVars.Count
        path_total       = $allPathEntries.Count
        path_duplicates  = $duplicateCount
        user_path_count  = $userPathParts.Count
        system_path_count = $systemPathParts.Count
    }
}

$output | ConvertTo-Json -Depth 5