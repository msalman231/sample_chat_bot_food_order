@echo off
REM Start Chatbot Service in Fallback Mode (No AI required)
REM This runs the chatbot with rule-based responses only

echo ====================================
echo   Restaurant Chatbot Service
echo   Running in FALLBACK MODE
echo ====================================
echo.

REM Check if virtual environment exists
if not exist "chatbot_env\Scripts\python.exe" (
    echo Error: Virtual environment not found!
    echo Please run setup first: python -m venv chatbot_env
    pause
    exit /b 1
)

echo [1/2] Activating virtual environment...
call chatbot_env\Scripts\activate.bat

echo [2/2] Starting chatbot service (FALLBACK MODE - No AI API needed)...
echo.
echo Service will run at: http://localhost:5000
echo Press CTRL+C to stop
echo.

REM Set environment to force fallback mode
set OPENAI_API_KEY=fallback_mode

python chatbot_service.py
pause
