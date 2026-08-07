; WinSuite Installer - Inno Setup Script
; Creates a Windows installer for WinSuite
; Requires Inno Setup 6.x (https://jrsoftware.org/isdl.php)

#define AppName "WinSuite"
#define AppVersion "1.0.0"
#define AppPublisher "WinSuite"
#define AppURL "https://github.com/user/wintools"
#define AppExeName "WinSuite.exe"

[Setup]
; Basic settings
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
DefaultDirName={autopf}\{#AppName}
DefaultGroupName={#AppName}
AllowNoIcons=yes
LicenseFile=..\LICENSE.txt
OutputDir=..\output
OutputBaseFilename=WinSuite-Setup-{#AppVersion}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
PrivilegesRequiredOverridesAllowed=dialog commandline
MinVersion=10.0.17763
; Architecture: 64-bit only
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

; Uninstall settings
UninstallDisplayIcon={app}\{#AppExeName}
UninstallDisplayName={#AppName}

; Visual settings
SetupIconFile=..\icon.ico
WizardImageFile=..\installer\wizard.bmp
WizardSmallImageFile=..\installer\wizard-small.bmp

; Version info
VersionInfoVersion={#AppVersion}
VersionInfoCompany={#AppPublisher}
VersionInfoProductName={#AppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startmenuicon"; Description: "Create Start Menu shortcut"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
; Main executable and all bundled files
Source: "..\dist\WinSuite\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; PowerShell scripts (in case PyInstaller missed them)
Source: "..\scan-apps.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scan-tweaks.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scan-winoptions.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scan-privacy.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scan-privacy-apps.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scan-secrets.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#AppExeName}"; Comment: "WinSuite - Windows System Management Dashboard"
Name: "{group}\Uninstall {#AppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\{#AppExeName}"; Comment: "WinSuite - Windows System Management Dashboard"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent

[Code]
// Check for WebView2 runtime
function InitializeSetup(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;

  // Check if WebView2 is installed
  if not RegKeyExists(HKLM, 'SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-22E10DFB4F6E}') then
  begin
    if not RegKeyExists(HKLM, 'SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BEB-22E10DFB4F6E}') then
    begin
      if MsgBox('WinSuite requires Microsoft Edge WebView2 Runtime.' + #13#10 + #13#10 +
                'WebView2 was not found on your system.' + #13#10 +
                'Would you like to download it now?', mbConfirmation, MB_YESNO) = IDYES then
      begin
        ShellExec('open', 'https://go.microsoft.com/fwlink/p/?LinkId=2124703', '', '', SW_SHOWNORMAL, ewNoWait, ResultCode);
      end;
      // Continue installation even if WebView2 is not installed - user can install it later
    end;
  end;
end;

// Create data directory after installation
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    ForceDirectories(ExpandConstant('{app}\data'));
  end;
end;