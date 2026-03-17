@echo off
chcp 65001 >nul
echo ============================================
echo   字牌AI大师 - 实时截屏助手
echo ============================================
echo.

:: 检查Python是否安装
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到Python，请先安装Python 3.11+
    echo 下载地址: https://www.python.org/downloads/
    echo 安装时请勾选 "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo [1/3] 检测到Python，正在安装依赖...
pip install pillow requests mss --quiet --disable-pip-version-check

if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败，请检查网络连接
    pause
    exit /b 1
)

echo [2/3] 依赖安装完成！
echo [3/3] 启动截屏助手...
echo.
echo 提示：按 Ctrl+C 可随时停止
echo.

:: 运行截屏脚本
python "%~dp0screen-capture.py" %*

pause
