@echo off
setlocal

set "PORT=8080"
set "DOCS_DIR=%~dp0"
set "VENV_DIR=%DOCS_DIR%.venv"

if not exist "%VENV_DIR%\Scripts\python.exe" (
    echo Creating virtualenv at "%VENV_DIR%" ...
    python -m venv "%VENV_DIR%"
    if errorlevel 1 (
        echo Failed to create virtualenv. Is Python installed and on PATH?
        exit /b 1
    )
)

echo Starting local docs server on port %PORT% (inside venv) ...
start "9drive-docs-server" /min cmd /c "call "%VENV_DIR%\Scripts\activate.bat" && cd /d "%DOCS_DIR%" && python -m http.server %PORT%"

timeout /t 2 /nobreak >nul

start "" "http://localhost:%PORT%/docs-viewer.html"

echo.
echo Docs server running in background window "9drive-docs-server" (venv: %VENV_DIR%).
echo Close that window (or run: taskkill /FI "WINDOWTITLE eq 9drive-docs-server*") to stop it.
endlocal
