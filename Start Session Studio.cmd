@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js is not installed. Follow docs\SETUP.md or paste the professor prompt into local Codex.
 pause
 exit /b 1
)
node scripts/start-local.mjs
pause
