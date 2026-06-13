@echo off
cd /d "%~dp0"
if "%OPENAI_API_KEY%"=="" (
  echo OPENAI_API_KEY is not set.
  echo Example:
  echo   set OPENAI_API_KEY=your_api_key_here
  echo   start-api.bat
  pause
  exit /b 1
)
node server.js
