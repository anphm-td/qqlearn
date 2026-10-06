@echo off
chcp 65001 >nul
title qqlearn - sổ học tập
cd /d "%~dp0"

echo.
echo  ============================================
echo    qqlearn - sổ học tập của bạn
echo  ============================================
echo.

rem -- Kiểm tra Node.js --
where node >nul 2>nul
if errorlevel 1 (
  echo  [qqlearn] Máy bạn chưa cài Node.js.
  echo  [qqlearn] Hãy tải bản LTS tại: https://nodejs.org
  echo  [qqlearn] Cài xong hãy nhấp đúp lại file này.
  echo.
  pause
  exit /b 1
)

rem -- Lần đầu chạy: cài thư viện --
if not exist "node_modules" (
  echo  [qqlearn] Lần đầu chạy - đang cài thư viện, khoảng vài phút...
  echo  [qqlearn] Chỉ cần làm việc này MỘT LẦN, những lần sau mở là chạy ngay.
  echo.
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo  [qqlearn] Cài thư viện bị lỗi - kiểm tra kết nối mạng rồi thử lại.
    echo.
    pause
    exit /b 1
  )
)

rem -- Build nếu chưa có bản chạy --
if not exist "dist\index.html" (
  echo  [qqlearn] Đang chuẩn bị giao diện app lần đầu...
  call npm run build
  if errorlevel 1 (
    echo  [qqlearn] Chuẩn bị giao diện bị lỗi - hãy chạy lại file này.
    echo.
    pause
    exit /b 1
  )
)
if not exist "server\dist\server\src\index.js" (
  echo  [qqlearn] Đang chuẩn bị phần server lần đầu...
  call npm run server:build
  if errorlevel 1 (
    echo  [qqlearn] Chuẩn bị server bị lỗi - hãy chạy lại file này.
    echo.
    pause
    exit /b 1
  )
)

rem -- Mở trình duyệt sau khi server lên (đợi 3 giây) --
start "" cmd /c "timeout /t 3 >nul & start http://localhost:5178"

echo  [qqlearn] Đang khởi động server...
echo  [qqlearn] PC:    http://localhost:5178
echo  [qqlearn] Điện thoại (cùng Wi-Fi): xem địa chỉ hiện bên dưới rồi mở trên máy điện thoại.
echo  [qqlearn] Để app chạy: KHÔNG đóng cửa sổ này. Muốn dừng: nhấn Ctrl+C hoặc đóng cửa sổ.
echo.
call npm run server

echo.
echo  [qqlearn] Server đã dừng. Nhấp đúp lại file qqlearn.cmd để mở lại.
pause
