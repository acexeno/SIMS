@echo off
echo ========================================
echo    Component Image Sync Tool
echo ========================================
echo.

echo Starting image synchronization...
node sync-component-images.js

echo.
echo ========================================
echo    Sync completed!
echo ========================================
echo.
echo Press any key to exit...
pause >nul
