@echo off
echo ================================
echo  Compilando instalador SAGE 5.0
echo ================================
cd /d "C:\Users\javie\OneDrive\Desktop\OuterHeaven\SAGE\frontend"

echo.
echo [1/2] Compilando app Tauri...
call pnpm tauri build
if errorlevel 1 (
    echo.
    echo *** ERROR: pnpm tauri build fallo ***
    pause
    exit /b 1
)

echo.
echo [2/2] Copiando instalador al escritorio...

set ORIGEN=C:\Users\javie\AppData\Roaming\sage-rust-target\release\bundle
set DESTINO=C:\Users\javie\Desktop

REM Buscar el .msi primero, si no el .exe NSIS
if exist "%ORIGEN%\msi\SAGE_5.0.0_x64_es-ES.msi" (
    copy /Y "%ORIGEN%\msi\SAGE_5.0.0_x64_es-ES.msi" "%DESTINO%\SAGE 5.0.msi"
    echo Instalador MSI copiado al escritorio.
) else if exist "%ORIGEN%\nsis\SAGE_5.0.0_x64-setup.exe" (
    copy /Y "%ORIGEN%\nsis\SAGE_5.0.0_x64-setup.exe" "%DESTINO%\SAGE 5.0.exe"
    echo Instalador EXE copiado al escritorio.
) else (
    echo Buscando instalador generado...
    dir "%ORIGEN%\msi\*.msi" 2>nul
    dir "%ORIGEN%\nsis\*.exe" 2>nul
    echo.
    echo *** No se encontro el instalador en la ruta esperada. Revisa manualmente. ***
)

echo.
echo === LISTO ===
pause
