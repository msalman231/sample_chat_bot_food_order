@echo off
echo 🚀 Starting Restaurant Website with AI Chatbot...

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed. Please install Python 3.8 or higher.
    pause
    exit /b 1
)

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js 18 or higher.
    pause
    exit /b 1
)

REM Create Python virtual environment if it doesn't exist
if not exist "chatbot_env" (
    echo 📦 Creating Python virtual environment...
    python -m venv chatbot_env
)

REM Activate virtual environment
echo 🔄 Activating Python virtual environment...
call chatbot_env\Scripts\activate.bat

REM Install Python dependencies
echo 📦 Installing Python dependencies...
pip install -r requirements.txt

REM Install Node.js dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing Node.js dependencies...
    call npm install
)

echo 🤖 Starting AI Chatbot Service on port 5000...
start "AI Chatbot" cmd /k "chatbot_env\Scripts\activate.bat && python chatbot_service.py"

REM Wait for chatbot service to start
timeout /t 3 /nobreak >nul

echo 🌐 Starting GraphQL Backend Server on port 4000...
start "GraphQL Server" cmd /k "npm run dev:server"

timeout /t 2 /nobreak >nul

echo ⚛️ Starting React Frontend on port 5173...
start "React Frontend" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ✅ All services are starting up!
echo.
echo 🔗 Frontend: http://localhost:5173
echo 🔗 GraphQL: http://localhost:4000/graphql
echo 🔗 AI Chatbot: http://localhost:5000
echo.
echo 🤖 AI Features:
echo    • Natural language understanding
echo    • Context-aware responses  
echo    • Intelligent menu suggestions
echo    • Smart cart management
echo.
echo 💡 If AI service fails, the chatbot will use fallback responses
echo Press any key to continue...
pause >nul