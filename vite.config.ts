import { fileURLToPath, URL } from 'node:url'

import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'qqlearn',
        short_name: 'qqlearn',
        description:
          'Sổ tay học tập đa môn: ghi chú, bấm giờ buổi học, từ vựng, lỗi sai, sổ điểm và thống kê hằng ngày.',
        lang: 'vi',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#FBF6EE',
        background_color: '#FBF6EE',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache toàn bộ asset build (js/css/html/svg/woff2) + SPA fallback
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
    },
  },
  server: {
    // F21 — chế độ dev: UI ở :5173, server PC ở :5178 — gọi /api được như cùng nguồn.
    proxy: {
      '/api': 'http://localhost:5178',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ là Playwright (chạy bằng `npm run e2e`), không cho vitest nhặt
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
