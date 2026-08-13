# WinTools - Scan installed apps for privacy allowlist picker
# Lists UWP/packaged apps and desktop apps that can be exempted from privacy restrictions
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scan-privacy-apps.ps1

$ErrorActionPreference = "SilentlyContinue"
$apps = @()

# ── UWP / Packaged Apps ──────────────────────────────────────────────

try {
    $packaged = Get-AppxPackage | Where-Object {
        $_.IsFramework -eq $false -and
        $_.SignatureKind -ne "System"
    } | Select-Object PackageFamilyName, Name, Publisher | Sort-Object Name

    foreach ($pkg in $packaged) {
        $apps += @{
            name = $pkg.Name
            id = $pkg.PackageFamilyName
            type = "package_family"
            publisher = if ($pkg.Publisher) { $pkg.Publisher.Substring(0, [Math]::Min(80, $pkg.Publisher.Length)) } else { "" }
        }
    }
} catch {
    # UWP listing failed, continue with desktop apps
}

# ── Desktop Apps (from Uninstall registry) ───────────────────────────

$uninstallPaths = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
    "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*"
)

$seen = @{}

foreach ($path in $uninstallPaths) {
    $items = Get-ItemProperty $path -ErrorAction SilentlyContinue
    foreach ($item in $items) {
        $name = $item.DisplayName
        $exe = $item.DisplayIcon

        # Skip if no name or already seen
        if ([string]::IsNullOrWhiteSpace($name)) { continue }
        if ($seen.ContainsKey($name)) { continue }

        # Try to get the executable path
        $installPath = $item.InstallLocation
        if ([string]::IsNullOrWhiteSpace($exe) -and ![string]::IsNullOrWhiteSpace($installPath)) {
            # Try to find the main exe
            $potentialExe = Get-ChildItem -Path $installPath -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($potentialExe) {
                $exe = $potentialExe.FullName
            }
        }

        # Also check UninstallString for exe path
        if ([string]::IsNullOrWhiteSpace($exe)) {
            $uninst = $item.UninstallString
            if ($uninst -match '"([^"]+\.exe)"') {
                $exe = $Matches[1]
            } elseif ($uninst -match '([^\s]+\.exe)') {
                $exe = $Matches[1]
            }
        }

        # Clean up the exe path
        if (![string]::IsNullOrWhiteSpace($exe)) {
            # Remove quotes and arguments
            $exe = $exe -replace '^"', '' -replace '"$', '' -replace '\s*/.*$', ''
            if (Test-Path $exe -ErrorAction SilentlyContinue) {
                $exe = (Resolve-Path $exe -ErrorAction SilentlyContinue).Path
            }
        }

        if (![string]::IsNullOrWhiteSpace($exe)) {
            $seen[$name] = $true
            $apps += @{
                name = $name
                id = $exe
                type = "exe_path"
                publisher = if ($item.Publisher) { $item.Publisher.Substring(0, [Math]::Min(80, $item.Publisher.Length)) } else { "" }
            }
        }
    }
}

# Sort by name and output
$apps = $apps | Sort-Object { $_.name }
$apps | ConvertTo-Json -Depth 5