@echo off
echo ===============================================
echo    Little Kitten Chat - Secure Messenger
echo ===============================================
echo.

REM Проверяем наличие Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ОШИБКА: Python не найден!
    echo Пожалуйста, установите Python 3.8 или выше с https://python.org
    pause
    exit /b 1
)

echo Запуск Little Kitten Chat...
echo.

REM Запускаем приложение
python run.py

echo.
echo Приложение завершено.
pause