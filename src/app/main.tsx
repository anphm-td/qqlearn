import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// @fontsource — subset VIETNAMESE (design-system.md mục 6):
// Display Bricolage Grotesque 700/800 · Body Be Vietnam Pro 400/500/600 · Data Quicksand 600/700
import '@fontsource/be-vietnam-pro/vietnamese-400.css'
import '@fontsource/be-vietnam-pro/vietnamese-500.css'
import '@fontsource/be-vietnam-pro/vietnamese-600.css'
import '@fontsource/bricolage-grotesque/vietnamese-700.css'
import '@fontsource/bricolage-grotesque/vietnamese-800.css'
import '@fontsource/quicksand/vietnamese-600.css'
import '@fontsource/quicksand/vietnamese-700.css'

import '../index.css'
import App from './App'
import { registerSW } from 'virtual:pwa-register'

// PWA: service worker precache toàn bộ asset + navigateFallback index.html (vite.config.ts)
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
