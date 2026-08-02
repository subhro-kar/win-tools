$apps = @()
$regPaths = @(
    'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\*'
)

foreach ($path in $regPaths) {
    $items = Get-ItemProperty $path -EA SilentlyContinue | Where-Object { $_.DisplayName }
    foreach ($item in $items) {
        $name = ""
        if ($item.DisplayName) { $name = $item.DisplayName.Trim() }

        # Skip empty names
        if ($name -eq "") { continue }

        $version = ""
        if ($item.DisplayVersion) { $version = $item.DisplayVersion }

        $publisher = ""
        if ($item.Publisher) { $publisher = $item.Publisher.Trim() }

        $installDate = ""
        if ($item.InstallDate) { $installDate = $item.InstallDate }

        $uninstall = ""
        if ($item.UninstallString) { $uninstall = $item.UninstallString }

        $sizeBytes = 0
        $sizeStr = ""
        if ($item.EstimatedSize) {
            $sizeMB = [math]::Round($item.EstimatedSize / 1024, 2)
            $sizeStr = "$sizeMB MB"
            $sizeBytes = $item.EstimatedSize * 1024
        }

        $arch = "x64"
        if ($path -match 'WOW6432Node') { $arch = "x86" }
        elseif ($path -match 'HKCU') { $arch = "User" }

        # Determine install location
        $installLocation = ""
        if ($item.InstallLocation) { $installLocation = $item.InstallLocation }

        # Categorize
        $category = "Other"
        $nameLower = $name.ToLower()

        if ($nameLower -match 'nvidia|amd|radeon|intel.*driver|geforce|adrenalin') { $category = "Drivers" }
        elseif ($nameLower -match 'visual studio|vs code|codium|jetbrains|android studio|antigravity.*ide|eclipse') { $category = "IDE & Editors" }
        elseif ($nameLower -match 'python|node\.?js|\.net|jdk|java|temurin|nvm|go |rust|ruby') { $category = "Runtimes & SDKs" }
        elseif ($nameLower -match 'docker|wsl|hyper-v|virtual|vmware') { $category = "Virtualization" }
        elseif ($nameLower -match 'sql server|mysql|postgres|mongodb|redis|database') { $category = "Databases" }
        elseif ($nameLower -match 'git|github|svn|mercurial') { $category = "Version Control" }
        elseif ($nameLower -match 'chrome|firefox|brave|edge|opera|vivaldi') { $category = "Browsers" }
        elseif ($nameLower -match 'notepad\+\+|vscode|sublime|vim|neovim') { $category = "Text Editors" }
        elseif ($nameLower -match '7-zip|winrar|peazip|bandizip') { $category = "Archivers" }
        elseif ($nameLower -match 'vlc|potplayer|mpc|ffmpeg|codec|media') { $category = "Media" }
        elseif ($nameLower -match 'office|libreoffice|notion|obsidian|evernote|oneNote') { $category = "Office & Notes" }
        elseif ($nameLower -match 'discord|slack|teams|zoom|skype|telegram') { $category = "Communication" }
        elseif ($nameLower -match 'steam|epic|xbox|gog|game') { $category = "Gaming" }
        elseif ($nameLower -match 'vpn|proxy|tunnel|adguard|hotspot shield') { $category = "Network & VPN" }
        elseif ($nameLower -match 'antivirus|malware|defender|firewall|security') { $category = "Security" }
        elseif ($nameLower -match 'powertoys|sysinternals|handle|process|autoruns|ccleaner') { $category = "System Utilities" }
        elseif ($nameLower -match 'cpu-z|hwmonitor|crystaldisk|gpu-z|speccy|benchmark') { $category = "Hardware Monitoring" }
        elseif ($nameLower -match 'postman|insomnia|fiddler|wireshark') { $category = "Dev Tools" }
        elseif ($nameLower -match 'iis|asp\.net|\.net framework|\.net runtime|\.net sdk|\.net target|\.net host|\.net desktop|\.net standard|\.net workload|\.net apphost|\.net templates') { $category = ".NET Framework" }
        elseif ($nameLower -match 'visual c\+\+|vc.*redist') { $category = "VC++ Redistributables" }
        elseif ($nameLower -match 'msi |msi$') { $category = "OEM Software" }
        elseif ($nameLower -match 'cloudflare|putty|ssh|ftp|winscp') { $category = "Network Tools" }
        elseif ($nameLower -match 'imagemagick|gimp|paint|eagle|figma|canva') { $category = "Graphics & Design" }
        elseif ($nameLower -match 'onedrive|google drive|dropbox|icloud') { $category = "Cloud Storage" }
        elseif ($nameLower -match 'logi|logitech|razer|corsair|steelseries') { $category = "Peripherals" }
        elseif ($nameLower -match 'microsoft (visual studio|sql server|windows|edge|onedrive|game|odbc|ole db|web deploy|test platform|asp\.net|command line)') { $category = "Microsoft System" }

        $apps += [PSCustomObject]@{
            Name             = $name
            Version          = $version
            Publisher        = $publisher
            InstallDate      = $installDate
            InstallLocation  = $installLocation
            Uninstall        = $uninstall
            Size             = $sizeStr
            SizeBytes        = $sizeBytes
            Architecture     = $arch
            Category         = $category
            Source           = "Registry"
        }
    }
}

# ── Also scan UWP/Microsoft Store apps ──────────────────────────────
Write-Host "Scanning UWP/Microsoft Store applications..."
try {
    $uwpApps = Get-AppxPackage | Where-Object { $_.IsFramework -eq $false -and $_.SignatureKind -ne 'None' }
    foreach ($uwp in $uwpApps) {
        $name = $uwp.Name
        if (-not $name -or $name -eq "") { continue }

        # Skip Windows built-in packages
        if ($name -match '^Microsoft\.Windows\.' -and $name -notmatch 'Photos|Calculator|Store|Terminal|VSCode|PowerToys|Edge|OneDrive|Teams') { continue }
        if ($name -match '^Microsoft\.VCLibs|^Microsoft\.UI|^Microsoft\.NET|^Microsoft\.Ad|^Microsoft\.Advertising|^Microsoft\.Services|^Microsoft\.DesktopAppInstaller|^Windows\.') { continue }

        $publisher = ""
        if ($uwp.Publisher) { $publisher = $uwp.Publisher }

        $version = ""
        if ($uwp.Version) { $version = $uwp.Version.ToString() }

        $installLocation = ""
        if ($uwp.InstallLocation) { $installLocation = $uwp.InstallLocation }

        # Get size estimate from install location
        $sizeBytes = 0
        $sizeStr = ""
        if ($uwp.InstallLocation -and (Test-Path $uwp.InstallLocation)) {
            try {
                $dirSize = (Get-ChildItem $uwp.InstallLocation -Recurse -EA SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                if ($dirSize -gt 0) {
                    $sizeMB = [math]::Round($dirSize / 1MB, 2)
                    $sizeStr = "$sizeMB MB"
                    $sizeBytes = $dirSize
                }
            } catch { }
        }

        # Categorize UWP apps
        $category = "Windows Apps"
        $nameLower = $name.ToLower()
        if ($nameLower -match 'calculator|math') { $category = "System Utilities" }
        elseif ($nameLower -match 'photos|paint|snip|screen sketch') { $category = "Graphics & Design" }
        elseif ($nameLower -match 'weather|news|sports|finance') { $category = "Other" }
        elseif ($nameLower -match 'xbox|game') { $category = "Gaming" }
        elseif ($nameLower -match 'edge|browser') { $category = "Browsers" }
        elseif ($nameLower -match 'store') { $category = "System Utilities" }
        elseif ($nameLower -match 'terminal|windows terminal|powershell') { $category = "System Utilities" }
        elseif ($nameLower -match 'onenote|office|word|excel|powerpoint|outlook|notion') { $category = "Office & Notes" }
        elseif ($nameLower -match 'teams|skype|discord') { $category = "Communication" }
        elseif ($nameLower -match 'vscode|visual studio code') { $category = "IDE & Editors" }
        elseif ($nameLower -match 'powertoys') { $category = "System Utilities" }
        elseif ($nameLower -match 'onedrive') { $category = "Cloud Storage" }
        elseif ($nameLower -match 'spotify|netflix|media|vlc') { $category = "Media" }

        $apps += [PSCustomObject]@{
            Name             = $name
            Version          = $version
            Publisher        = $publisher
            InstallDate      = ""
            InstallLocation  = $installLocation
            Uninstall        = "Get-AppxPackage $($uwp.PackageFullName) | Remove-AppxPackage"
            Size             = $sizeStr
            SizeBytes        = $sizeBytes
            Architecture     = "UWP"
            Category         = $category
            Source           = "Microsoft Store"
        }
    }
} catch {
    Write-Host "Warning: Could not scan UWP apps: $($_.Exception.Message)"
}

# Deduplicate by Name (case-insensitive)
$seen = @{}
$unique = @()
foreach ($app in ($apps | Sort-Object Name)) {
    $key = $app.Name.ToLowerInvariant()
    if (-not $seen.ContainsKey($key)) {
        $seen[$key] = $true
        $unique += $app
    }
}

# Get system info
$osInfo = Get-CimInstance Win32_OperatingSystem
$cpuInfo = Get-CimInstance Win32_Processor | Select-Object -First 1
$gpuInfo = Get-CimInstance Win32_VideoController | Select-Object -First 1
$diskInfo = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID, Size, FreeSpace

$systemInfo = [PSCustomObject]@{
    ComputerName  = $env:COMPUTERNAME
    OS            = $osInfo.Caption
    OSVersion     = $osInfo.Version
    OSBuild       = $osInfo.BuildNumber
    TotalRAM_MB   = [math]::Round($osInfo.TotalVisibleMemorySize / 1024, 0)
    CPU           = $cpuInfo.Name
    GPU           = $gpuInfo.Name
    Disks         = @()
}

foreach ($disk in $diskInfo) {
    $sizeGB = [math]::Round($disk.Size / 1GB, 2)
    $freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
    $systemInfo.Disks += [PSCustomObject]@{
        Drive     = $disk.DeviceID
        SizeGB    = $sizeGB
        FreeGB    = $freeGB
        UsedGB    = [math]::Round($sizeGB - $freeGB, 2)
        UsedPct   = [math]::Round(($sizeGB - $freeGB) / $sizeGB * 100, 1)
    }
}

# Calculate category stats
$categoryStats = @{}
$totalSize = 0
foreach ($app in $unique) {
    $cat = $app.Category
    if (-not $categoryStats.ContainsKey($cat)) {
        $categoryStats[$cat] = @{ Count = 0; TotalSizeMB = 0 }
    }
    $categoryStats[$cat].Count++
    if ($app.SizeBytes -gt 0) {
        $categoryStats[$cat].TotalSizeMB += [math]::Round($app.SizeBytes / 1MB, 2)
        $totalSize += $app.SizeBytes
    }
}

# Output as JSON (BOM-free UTF-8)
$output = [PSCustomObject]@{
    ScanDate    = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    TotalApps   = $unique.Count
    TotalSizeMB = [math]::Round($totalSize / 1MB, 2)
    SystemInfo  = $systemInfo
    Categories  = $categoryStats.Keys | Sort-Object | ForEach-Object {
        [PSCustomObject]@{
            Name       = $_
            Count      = $categoryStats[$_].Count
            TotalSizeMB = [math]::Round($categoryStats[$_].TotalSizeMB, 2)
        }
    }
    Applications = $unique
}

$jsonOutput = $output | ConvertTo-Json -Depth 5
# Remove BOM if present and write as UTF-8 without BOM
[System.IO.File]::WriteAllText(
    "F:\tools\win-tools\data\installed-apps.json",
    $jsonOutput,
    (New-Object System.Text.UTF8Encoding($false))
)

$regCount = ($unique | Where-Object { $_.Source -eq "Registry" }).Count
$uwpCount = ($unique | Where-Object { $_.Source -eq "Microsoft Store" }).Count
Write-Host "Scan complete. Found $($unique.Count) total applications ($regCount desktop, $uwpCount UWP/Store)."
Write-Host "Data saved to data/installed-apps.json"