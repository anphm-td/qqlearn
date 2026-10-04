/*
 * Nhóm D (hệ thống) — LOGIC THUẦN dò thiết bị cho hướng dẫn cài Sổ vào máy (PWA).
 * QUY TẮC LỚP: KHÔNG import React/Dexie/window — userAgent được truyền vào dưới dạng chuỗi.
 */

export type InstallPlatform = 'ios' | 'android' | 'desktop'

export function detectPlatform(userAgent: string): InstallPlatform {
  const ua = userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

/** Các bước cài "Thêm vào Màn hình chính" theo thiết bị — ngôn ngữ thân thiện, không thuật ngữ. */
export const INSTALL_STEPS: Record<InstallPlatform, string[]> = {
  ios: [
    'Mở Sổ bằng trình duyệt Safari',
    'Bấm nút Chia sẻ (hình ô vuông có mũi tên hướng lên)',
    'Cuộn xuống chọn "Thêm vào Màn hình chính" rồi bấm "Thêm"',
  ],
  android: [
    'Mở Sổ bằng Chrome',
    'Bấm biểu tượng ba chấm ở góc phải màn hình',
    'Chọn "Thêm vào Màn hình chính" (hoặc "Cài đặt ứng dụng") rồi bấm "Cài đặt"',
  ],
  desktop: [
    'Mở Sổ trên Chrome hoặc Edge',
    'Nhìn đầu thanh địa chỉ (bên phải) — bấm biểu tượng cài đặt',
    'Chọn "Cài đặt" — Sổ sẽ mở thành cửa sổ riêng như một ứng dụng',
  ],
}

/** Một dòng gợi ý cho các thiết bị KHÁC thiết bị hiện tại. */
export const OTHER_DEVICE_HINTS: Record<InstallPlatform, string> = {
  ios: 'Trên máy tính hoặc Android: mở Sổ bằng Chrome/Edge rồi chọn "Cài đặt" tại thanh địa chỉ hoặc menu ba chấm.',
  android: 'Trên iPhone: Safari → Chia sẻ → "Thêm vào Màn hình chính". Trên máy tính: biểu tượng cài đặt ở thanh địa chỉ.',
  desktop: 'Trên iPhone: Safari → Chia sẻ → "Thêm vào Màn hình chính". Trên Android: Chrome → menu ba chấm → "Thêm vào Màn hình chính".',
}
