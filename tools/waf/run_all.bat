@echo off
REM === إنشاء venv لو مش موجود ===
if not exist venv (
    python -m venv venv
)

REM === تفعيل البيئة ===
call venv\Scripts\activate

REM === تثبيت المكتبات ===
pip install --upgrade pip
pip install flask requests

REM === تشغيل السيرفر في نافذة منفصلة ===
start "Flask App" cmd /k "call venv\Scripts\activate && python app.py"

REM === الانتظار 3 ثواني عشان السيرفر يشتغل ===
timeout /t 3 /nobreak >nul

REM === تشغيل سكربت الاختبارات ===
python run_all_tests.py

echo.
echo ==== انتهى التشغيل! ====
pause
