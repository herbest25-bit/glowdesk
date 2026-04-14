@echo off
title GlowDesk CRM
color 0A

echo.
echo  ==========================================
echo   GlowDesk CRM - Iniciando sistema...
echo  ==========================================
echo.

:: Encerrar processos anteriores
taskkill /F /IM node.exe >/dev/null 2>&1
timeout /t 1 /nobreak >/dev/null

:: Limpar cache do Next.js (evita erros de static assets)
if exist "%~dp0frontend\.next" (
    rmdir /s /q "%~dp0frontend\.next" >/dev/null 2>&1
)

:: Verificar PostgreSQL
echo [1/3] Verificando banco de dados...
net start postgresql-x64-17 >/dev/null 2>&1
timeout /t 2 /nobreak >/dev/null
echo       OK

:: Iniciar Backend
echo [2/3] Iniciando backend (porta 3001)...
start "GlowDesk Backend" cmd /k "cd /d %~dp0backend && node src/index.js"
timeout /t 4 /nobreak >/dev/null
echo       OK

:: Iniciar Frontend
echo [3/3] Iniciando frontend (porta 3000)...
start "GlowDesk Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 12 /nobreak >/dev/null
echo       OK

echo.
echo  ==========================================
echo   Sistema pronto!
echo.
echo   Acesse: http://localhost:3000
echo   Login:  admin@glowdesk.com
echo   Senha:  admin123
echo  ==========================================
echo.

start "" "http://localhost:3000"
pause
