# scan-secrets.ps1
# Scans the current system for migration-worthy secrets and configs.
# Outputs JSON to data/secrets-scan.json (BOM-free UTF-8).
# Currently supports: SSH keys

$ErrorActionPreference = "SilentlyContinue"
$output = @{
    ScanDate    = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    ComputerName = $env:COMPUTERNAME
    SSH         = @{}
}

# ── SSH Keys ────────────────────────────────────────────────────────
$sshDir = Join-Path $env:USERPROFILE ".ssh"
if (Test-Path $sshDir) {
    $pubFiles = @()
    Get-ChildItem -Path $sshDir -File | Where-Object { $_.Name -match '\.pub$' } | ForEach-Object {
        $pubFiles += $_.Name
    }

    $sshFiles = @()
    $sshKeys = @()

    Get-ChildItem -Path $sshDir -File | ForEach-Object {
        $name = $_.Name
        $size = $_.Length
        $hasPub = ($name + ".pub") -in $pubFiles -or $name -replace '\.pub$', '' -in $pubFiles

        # Determine file type
        $isPublic  = $name -match '\.pub$'
        $isConfig  = $name -eq "config"
        $isKnown   = $name -match '^known_hosts'
        $isAuth    = $name -match '^authorized_keys'

        # Private key detection: has matching .pub, or common key extensions, or known patterns
        $isPrivate = $false
        if ($isPublic -or $isConfig -or $isKnown -or $isAuth) {
            $isPrivate = $false
        } elseif ($name -match '\.(pem|key)$') {
            $isPrivate = $true
        } elseif ($name -match '^id_(rsa|ed25519|ecdsa|dsa)') {
            $isPrivate = $true
        } elseif (Test-Path (Join-Path $sshDir "$name.pub")) {
            $isPrivate = $true
        } elseif ($name -notmatch '\.' -and $name -notin @("config", "known_hosts", "authorized_keys")) {
            $isPrivate = $true
        }

        $fileType = "other"
        if ($isPrivate) { $fileType = "private_key" }
        elseif ($isPublic)  { $fileType = "public_key" }
        elseif ($isConfig)  { $fileType = "config" }
        elseif ($isKnown)   { $fileType = "known_hosts" }
        elseif ($isAuth)   { $fileType = "authorized_keys" }

        $sshFiles += @{
            Name   = $name
            Type   = $fileType
            Size   = $size
            HasPub = $hasPub
        }

        if ($isPrivate) {
            $sshKeys += @{
                Name   = $name
                Size   = $size
                HasPub = $hasPub
            }
        }
    }

    $output.SSH = @{
        Found    = $true
        Dir      = $sshDir
        Files    = $sshFiles
        KeyCount = ($sshFiles | Where-Object { $_.Type -eq "private_key" }).Count
        Keys     = $sshKeys
    }
} else {
    $output.SSH = @{
        Found    = $false
        Dir      = $sshDir
        Files    = @()
        KeyCount = 0
        Keys     = @()
    }
}

# ── Output JSON (BOM-free UTF-8) ────────────────────────────────────
$outPath = Join-Path $PSScriptRoot "data\secrets-scan.json"
$json = $output | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($outPath, $json, [System.Text.UTF8Encoding]::new($false))