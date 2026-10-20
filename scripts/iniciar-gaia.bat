@echo off
rem Inicia o GAIA e abre o navegador em tela cheia (modo quiosque). Para Windows.
rem Antes, uma vez: npm run install:all  e  npm run build
cd /d "%~dp0.."

rem 1) Sobe o backend numa janela minimizada (se ja estiver rodando, a porta ocupada so gera um aviso e fecha).
start "GAIA backend" /min cmd /c "cd backend && npm start >> ..\gaia.log 2>&1"
timeout /t 6 /nobreak >nul

rem 2) Abre o Chrome (ou o Edge) em tela cheia.
set URL=http://127.0.0.1:8787
set FLAGS=--kiosk --noerrdialogs --disable-infobars --no-first-run --autoplay-policy=no-user-gesture-required --user-data-dir="%USERPROFILE%\.gaia-browser"
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" %FLAGS% %URL%
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" %FLAGS% %URL%
) else (
  start "" msedge %FLAGS% %URL%
)
