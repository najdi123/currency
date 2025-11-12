@echo off
echo ============================================
echo   Development Environment Reset Script
echo ============================================
echo.

echo [1/4] Killing all Node.js processes...
taskkill /F /IM node.exe 2>nul
if %ERRORLEVEL% EQU 0 (
    echo    ✓ Node processes killed
) else (
    echo    ! No Node processes found
)
echo.

echo [2/4] Cleaning up port 4000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :4000 ^| findstr LISTENING') do (
    echo    Killing process %%a on port 4000...
    taskkill /F /PID %%a 2>nul
)
echo    ✓ Port 4000 cleaned
echo.

echo [3/4] Cleaning OHLC database...
node scripts/cleanup-ohlc.js
echo.

echo [4/4] Ready to restart!
echo.
echo ============================================
echo   Next Steps:
echo ============================================
echo   1. Run: cd apps/backend ^&^& npm run start:dev
echo   2. Wait for "Application is running" message
echo   3. Watch for "Collected X minute OHLC records"
echo.
echo Press any key to exit...
pause >nul
