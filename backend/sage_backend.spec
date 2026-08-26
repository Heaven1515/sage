# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec — SAGE Backend · Notaría 33
# Genera un único backend.exe que incluye FastAPI + todos los módulos.

import sys
from pathlib import Path

block_cipher = None

a = Analysis(
    ['run_backend.py'],
    pathex=[str(Path('.').resolve())],
    binaries=[
        # Tesseract OCR — bundleado para que el PC destino no necesite instalarlo
        (r'C:\Program Files\Tesseract-OCR\tesseract.exe', 'tesseract'),
        (r'C:\Program Files\Tesseract-OCR\*.dll', 'tesseract'),
    ],
    datas=[
        # BD plantilla: contiene nombres_genero, usuarios y config inicial
        ('notaria.db', '.'),
        # Módulos del sistema (necesarios porque se cargan con importlib)
        ('modules', 'modules'),
        ('shared', 'shared'),
        # Datos de idioma Tesseract — van directo en la carpeta tesseract/ (TESSDATA_PREFIX apunta ahí)
        (r'C:\Program Files\Tesseract-OCR\tessdata\eng.traineddata', 'tesseract'),
        (r'C:\Program Files\Tesseract-OCR\tessdata\spa.traineddata', 'tesseract'),
    ],
    hiddenimports=[
        # Uvicorn — sus submódulos se cargan dinámicamente
        'uvicorn.lifespan.off',
        'uvicorn.lifespan.on',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.http.h11_impl',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.logging',
        'uvicorn.loops.auto',
        'uvicorn.loops.asyncio',
        # Módulos cargados con importlib (nombres con número)
        'modules.01_confecciones.routes',
        'modules.01_confecciones.controller',
        'modules.01_confecciones.model',
        'modules.01_confecciones.schema',
        'modules.02_vb.routes',
        'modules.02_vb.carpeta_routes',
        'modules.02_vb.words_routes',
        'modules.02_vb.planilla_routes',
        'modules.09_repertorios.routes',
        'modules.09_repertorios.registro_routes',
        'modules.09_repertorios.controller',
        'modules.09_repertorios.impresion_controller',
        'modules.09_repertorios.registro_controller',
        'modules.09_repertorios.registro_model',
        'modules.03_prefirma.routes',
        'modules.04_postfirma.routes',
        'modules.05_boveda.routes',
        'modules.07_configuracion.routes',
        # pywin32
        'win32api',
        'win32com',
        'win32com.client',
        'win32com.shell',
        'win32com.shell.shell',
        'pywintypes',
        # python-multipart: requerido por FastAPI para UploadFile / Form
        'multipart',
        'multipart.multipart',
        # pytesseract — OCR del módulo prefirma (no detectado por análisis estático)
        'pytesseract',
        'pytesseract.pytesseract',
        # Pillow (PIL) — requerido por pytesseract para procesar imágenes
        'PIL',
        'PIL.Image',
        # Otros
        'multiprocessing',
        'multiprocessing.util',
        'multiprocessing.reduction',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=block_cipher,
)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,   # UPX puede causar falsos positivos en antivirus
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Sin ventana de consola en producción
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
