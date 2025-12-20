@echo off
echo ============================================
echo WAF Test Suite - Quick Start
echo ============================================
echo.

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Install requirements if needed
echo Installing dependencies...
pip install flask requests >nul 2>&1

REM Create test waf-map.json
echo Creating test token map...
echo {"testtoken": "http://127.0.0.1:4000"} > waf-map.json

echo.
echo ============================================
echo TEST MODE OPTIONS
echo ============================================
echo 1. Test WAF directly (no proxy)
echo 2. Test WAF with proxy mode (needs target server)
echo 3. Run full test suite with JSON output
echo 4. Start target server only
echo 5. Start WAF only
echo.

set /p choice="Enter choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Starting WAF and running tests...
    start "WAF Server" cmd /c "set WAF_MAP_FILE=waf-map.json && python app.py"
    timeout /t 3 /nobreak >nul
    python waf_test_runner.py --url http://127.0.0.1:5000
    pause
)

if "%choice%"=="2" (
    echo.
    echo Starting Target Server and WAF...
    start "Target Server" cmd /c "python test_target.py"
    timeout /t 2 /nobreak >nul
    start "WAF Server" cmd /c "set WAF_MAP_FILE=waf-map.json && python app.py"
    timeout /t 3 /nobreak >nul
    echo.
    echo Testing through proxy...
    python waf_test_runner.py --url http://127.0.0.1:5000 --token testtoken
    pause
)

if "%choice%"=="3" (
    echo.
    echo Starting WAF and running full test suite...
    start "WAF Server" cmd /c "set WAF_MAP_FILE=waf-map.json && python app.py"
    timeout /t 3 /nobreak >nul
    python waf_test_runner.py --url http://127.0.0.1:5000 --json --output test_results.json
    echo.
    echo Results saved to test_results.json
    pause
)

if "%choice%"=="4" (
    echo.
    echo Starting Target Server on port 4000...
    python test_target.py
)

if "%choice%"=="5" (
    echo.
    echo Starting WAF on port 5000...
    set WAF_MAP_FILE=waf-map.json
    python app.py
)
