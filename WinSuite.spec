# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['wintools.py'],
    pathex=[],
    binaries=[],
    datas=[('templates', 'templates'), ('static', 'static'), ('scan-apps.ps1', '.'), ('scan-tweaks.ps1', '.'), ('scan-winoptions.ps1', '.'), ('scan-privacy.ps1', '.'), ('scan-privacy-apps.ps1', '.'), ('scan-secrets.ps1', '.'), ('privacy.py', '.'), ('tweaks.py', '.'), ('winoptions.py', '.'), ('software_catalog.py', '.'), ('migrate.py', '.')],
    hiddenimports=['flask', 'pywebview', 'pywebview.winforms', 'cryptography', 'boto3', 'botocore', 'urllib3', 'jinja2', 'werkzeug', 'itsdangerous', 'click', 'markupsafe'],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='WinSuite',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='WinSuite',
)
