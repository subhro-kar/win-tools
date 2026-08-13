# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec file for WinSuite.

Build with: pyinstaller WinTools.spec
Or use build.bat for the full installer build.
"""

import sys
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────

BASE_DIR = Path('.')
SRC_DIR = BASE_DIR
APP_NAME = 'WinSuite'

# ── Analysis ──────────────────────────────────────────────────────────

a = Analysis(
    [str(SRC_DIR / 'wintools.py')],
    pathex=[str(SRC_DIR)],
    binaries=[],
    datas=[
        (str(SRC_DIR / 'templates'), 'templates'),
        (str(SRC_DIR / 'static'), 'static'),
        (str(SRC_DIR / 'scan-apps.ps1'), '.'),
        (str(SRC_DIR / 'scan-tweaks.ps1'), '.'),
        (str(SRC_DIR / 'scan-winoptions.ps1'), '.'),
        (str(SRC_DIR / 'scan-privacy.ps1'), '.'),
        (str(SRC_DIR / 'scan-privacy-apps.ps1'), '.'),
        (str(SRC_DIR / 'scan-secrets.ps1'), '.'),
        (str(SRC_DIR / 'privacy.py'), '.'),
        (str(SRC_DIR / 'tweaks.py'), '.'),
        (str(SRC_DIR / 'winoptions.py'), '.'),
        (str(SRC_DIR / 'software_catalog.py'), '.'),
        (str(SRC_DIR / 'migrate.py'), '.'),
    ],
    hiddenimports=[
        'flask',
        'pywebview',
        'cryptography',
        'boto3',
        'botocore',
        'urllib3',
        'jinja2',
        'werkzeug',
        'itsdangerous',
        'click',
        'markupsafe',
        'pywebview.winforms',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
        'pytest',
        'setuptools',
        'pip',
    ],
    noarchive=False,
)

# ── EXE ────────────────────────────────────────────────────────────────

exe = EXE(
    pyz=a.PYZ,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name=APP_NAME,
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # No console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(SRC_DIR / 'icon.ico') if (SRC_DIR / 'icon.ico').exists() else None,
)

# ── COLLECT ────────────────────────────────────────────────────────────

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name=APP_NAME,
)