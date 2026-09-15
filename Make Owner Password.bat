@echo off
title Smart POS Cloud - Owner password
cd /d "%~dp0"
if not exist node_modules call npm install
node scripts\hash-password.js
echo.
pause
