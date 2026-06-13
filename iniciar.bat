@echo off
cd /d "%~dp0"
echo ========================================
echo   SCG - Contabilidad Ganadera
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ERROR: Node.js no esta instalado.
    echo Descargalo desde https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Instalando dependencias (primera vez)...
    call npm run install:all
    if errorlevel 1 (
        echo Fallo la instalacion.
        pause
        exit /b 1
    )
)

echo.
echo Iniciando servidor API (puerto 3001) y web React (puerto 5173)...
echo.
echo Abri en el navegador:  http://127.0.0.1:5173
echo (NO abras solo client/ — hace falta API + web juntos)
echo.
call npm run dev
pause
