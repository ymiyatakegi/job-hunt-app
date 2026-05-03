@echo off
cd /d "%~dp0"
echo Device Transferを起動します。
echo.
echo 表示された Phone のURLをスマホで開いてください。
echo 終了するときはこの画面を閉じてください。
echo.
node server.js
pause
