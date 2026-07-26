@echo off
echo ================================
echo  Compilando backend SAGE...
echo ================================
cd /d "C:\Users\javie\OneDrive\Desktop\OuterHeaven\SAGE\backend"
py -3.13 -m PyInstaller sage_backend.spec --noconfirm
if errorlevel 1 (
    echo.
    echo *** ERROR: PyInstaller fallo ***
    pause
    exit /b 1
)
echo.
echo Copiando exe al sidecar de Tauri...
copy /Y "dist\backend.exe" "..\frontend\src-tauri\binaries\backend-x86_64-pc-windows-msvc.exe"
if errorlevel 1 (
    echo *** ERROR: No se pudo copiar el exe ***
    pause
    exit /b 1
)
echo.
echo === TODO LISTO - Puedes cerrar esta ventana ===
pause
