# Build app Android (Capacitor)

> 05/10/2026: APK debug đầu tiên đã build và chạy xác nhận trên Android Emulator — cả 4 tab (Hôm nay · Học · Sổ tay · Thống kê) hiển thị đúng thiết kế v5. Ảnh xác minh: `design/android-run/01..04.png`.

## Môi trường đã cài trên máy này

| Thành phần | Vị trí |
|---|---|
| JDK 21 (Temurin) | `C:\Users\ad\jdk\jdk-21` |
| Android SDK | `C:\Users\ad\AppData\Local\Android\Sdk` |
| Emulator AVD | `medium_phone` (API 35, x86_64) — tăng tốc WHPX |

Biến môi trường user đã đặt vĩnh viễn: `JAVA_HOME`, `ANDROID_HOME`.

## Build lại APK khi sửa code web

Chạy tại thư mục dự án (`E:\PROJECT\rag_toeic`):

```bash
npm run build          # build web -> dist/
npx cap sync           # chép dist/ vào dự án Android
cd android
cmd //c "gradlew.bat assembleDebug"
```

## Đổi logo / icon app

Logo nằm ở một chỗ duy nhất: sửa `scripts/make-icons.mjs` (định nghĩa bubble "100" — xem `.superdesign/design-system.md` mục 11), rồi:

```bash
node scripts/make-icons.mjs                  # sinh lại SVG PWA + assets/*.png
npx capacitor-assets generate --android      # sinh mipmap/adaptive/splash vào android/
# rồi build lại APK như trên (không cần npx cap sync nếu chỉ đổi icon)
```

APK ra tại: `android/app/build/outputs/apk/debug/app-debug.apk`
(bản copy tiện tay: `so-hoc-toeic-debug.apk` ở root dự án)

## Cài lên điện thoại thật

Cách 1 — USB: bật "Tuỳ chọn nhà phát triển" + "Gỡ lỗi USB" trên điện thoại, cắm cáp, rồi:

```bash
C:\Users\ad\AppData\Local\Android\Sdk\platform-tools\adb.exe install -r so-hoc-toeic-debug.apk
```

Cách 2 — copy file `so-hoc-toeic-debug.apk` vào điện thoại (Zalo/Drive/USB), mở file và cho phép "cài từ nguồn không xác định".

Lưu ý: máy thật cần Android 7.0+ (minSdk 24). Dữ liệu app lưu offline trên từng máy (IndexedDB); chế độ "Qua server PC" vào cùng `serverUrl` của máy tính trong Cài đặt nếu muốn đồng bộ.

## Việc còn lại (chưa làm)

- **APK release (ký chính thức)**: tạo keystore `keytool -genkey -v -keystore qqlearn.keystore -alias qqlearn -keyalg RSA -keysize 2048 -validity 10000`, cấu hình `signingConfig` trong `android/app/build.gradle`, build `assembleRelease`. APK debug hiện tại dùng được nhưng chỉ nên cài cá nhân.
- Kiểm chứng trên điện thoại thật.

## Sự cố thường gặp

- `gradlew` báo không tìm thấy Java → `set JAVA_HOME=C:\Users\ad\jdk\jdk-21` trước khi chạy.
- Gradle/SDK lỗi license → `sdkmanager.bat --licenses` (SDK tại `C:\Users\ad\AppData\Local\Android\Sdk`).
- Emulator khởi động chậm/báo lỗi tăng tốc → kiểm tra WHPX: `emulator.exe -accel-check`.
- Sửa code web mà quên `npx cap sync` → app trên Android vẫn hiện bản cũ.
