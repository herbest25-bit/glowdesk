@echo off
echo.
echo  ╔══════════════════════════════════════╗
echo  ║       GlowDesk — Setup Inicial       ║
echo  ╚══════════════════════════════════════╝
echo.

:: Verificar .env
if not exist backend\.env (
  echo [ERRO] Configure o backend\.env antes de continuar!
  echo Abra o arquivo backend\.env.example, preencha e salve como backend\.env
  pause
  exit /b 1
)

echo [1/2] Inicializando banco de dados...
cd backend
node src/utils/setup-db.js
if %errorlevel% neq 0 (
  echo [ERRO] Falha ao inicializar o banco. Verifique DATABASE_URL no .env
  pause
  exit /b 1
)

echo.
echo [2/2] Criando usuario admin...
node src/utils/create-admin.js

echo.
echo  Setup concluido! Execute start.bat para iniciar o sistema.
echo.
pause
