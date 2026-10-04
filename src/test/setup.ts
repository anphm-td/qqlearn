import '@testing-library/jest-dom/vitest'
// jsdom không có IndexedDB — Dexie (mọi repo trong '@data') cần nó để mở DB.
// fake-indexeddb cài shim toàn cục: test component chạy như trên trình duyệt thật.
import 'fake-indexeddb/auto'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom không cài window.scrollTo (AppLayout cuộn lên đầu khi đổi route) — stub để
// stderr sạch. Test chạy môi trường node (vd. server/tests) không có window — bỏ qua.
if (typeof window !== 'undefined') {
  window.scrollTo = () => {}
}

afterEach(() => {
  if (typeof document !== 'undefined') cleanup()
})
