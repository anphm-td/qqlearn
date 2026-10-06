import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // GIỮ NGUYÊN appId — đổi sẽ thành app khác trên máy người dùng (cài đè/conflict).
  appId: 'com.qqlearn.sotoeic',
  appName: 'qqlearn',
  webDir: 'dist',
  backgroundColor: '#FBF6EE',
};

export default config;
