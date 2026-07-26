@echo off
echo ================================
echo  SAGE - Notaria 33
echo ================================
echo.
echo Verificando dependencias Python...
py -3.11 -m pip install -r "%OneDrive%\Desktop\SAGE\backend\requirements.txt" --quiet --disable-pip-version-check
echo Dependencias OK.
echo.
echo Iniciando backend...
start "Backend SAGE" cmd /k "cd /d "%OneDrive%\Desktop\SAGE\backend" && py -3.11 -m uvicorn main:app --reload"

timeout /t 3 /nobreak > nul

echo Iniciando frontend...
start "Frontend SAGE" cmd /k "cd /d "%OneDrive%\Desktop\SAGE\frontend" && pnpm dev"

timeout /t 6 /nobreak > nul

start chrome http://localhost:3000
