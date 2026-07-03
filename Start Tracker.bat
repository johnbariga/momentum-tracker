@echo off
cd /d "%~dp0"
start "" http://localhost:8317
python -m http.server 8317
