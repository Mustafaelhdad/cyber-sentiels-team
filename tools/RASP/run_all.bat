@echo off
REM 
start cmd /k "cd %~dp0& python -m api.api"
timeout /t 1
start cmd /k "cd %~dp0& python -m example_app.app"
echo Done. Two windows launched: API (9000) and example app (5001).
