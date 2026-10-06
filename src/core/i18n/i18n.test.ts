// @vitest-environment node
/*
 * Test lõi i18n (src/core/i18n) + RÀO CHẮN KEY-PARITY cho các agent feature sau.
 *  - t(): nội suy {bien}, fallback en→vi, key thiếu → trả chính key (không ném).
 *  - lookup()/interpolate(): hàm thuần dùng riêng lẻ.
 *  - KEY PARITY: duyệt MỌI file trong src/core/i18n/dict/ — tập key vi phải ===
 *    tập key en cho từng namespace (dict trống thì bỏ qua). Thêm key mới cho 1
 *    ngôn ngữ mà quên ngôn ngữ kia sẽ đỏ ngay tại đây.
 * Môi trường node: cần fs đọc danh sách file dict/ (import.meta.url là file://).
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { dicts, interpolate, lookup, t } from './index'

describe('t() — hàm dịch chính', () => {
  it('vi lấy đúng chuỗi vi; en lấy đúng chuỗi en', () => {
    expect(t('vi', 'common', 'nav.today')).toBe('Hôm nay')
    expect(t('en', 'common', 'nav.today')).toBe('Today')
  })

  it('nội suy biến {ten} trong chuỗi (number và string)', () => {
    expect(t('vi', 'common', 'progress.aria', { percent: 62 })).toBe(
      'Tiến độ hôm nay: 62% mục tiêu hằng ngày',
    )
    expect(t('vi', 'settings', 'stepper.stepDownAria', { label: 'Học mỗi ngày', step: 5, unit: 'phút' })).toBe(
      'Giảm Học mỗi ngày 5 phút',
    )
    expect(t('en', 'settings', 'data.csvOk', { label: t('en', 'settings', 'data.csv.vocab') })).toBe(
      'Downloaded the vocabulary sheet.',
    )
  })

  it('biến thiếu → giữ nguyên placeholder (không ném, không xoá)', () => {
    expect(interpolate('Xin chào {ten}!')).toBe('Xin chào {ten}!')
    expect(interpolate('Còn {so} phút', {})).toBe('Còn {so} phút')
  })

  it('fallback en → vi khi key chỉ có ở vi (vi là nguồn chuẩn)', () => {
    const en = dicts.settings.en
    const backup = en['lang.desc']
    try {
      delete en['lang.desc']
      expect(t('en', 'settings', 'lang.desc')).toBe(dicts.settings.vi['lang.desc'])
      expect(t('en', 'settings', 'lang.desc')).toBe('Đổi ngôn ngữ toàn bộ Sổ — áp dụng ngay.')
    } finally {
      en['lang.desc'] = backup // khôi phục — không làm bẩn test khác
    }
  })

  it('key thiếu ở cả hai ngôn ngữ → trả CHÍNH KEY, không ném lỗi', () => {
    expect(t('vi', 'common', 'khong.co.key.nay')).toBe('khong.co.key.nay')
    expect(t('en', 'settings', 'also.missing.key', { a: 1 })).toBe('also.missing.key')
    expect(t('vi', 'today', 'chu.a.co.gi')).toBe('chu.a.co.gi')
  })

  it('lookup thuần: en có → en; en thiếu → vi; vi thiếu → undefined', () => {
    expect(lookup(dicts.common, 'vi', 'banner.dismiss')).toBe('Đã hiểu')
    expect(lookup(dicts.common, 'en', 'banner.dismiss')).toBe('Got it')
    const fallback = lookup(dicts.common, 'en', 'chi-o-vi')
    expect(fallback).toBeUndefined()
  })
})

describe('KEY PARITY — mọi file trong src/core/i18n/dict/ (rào chắn cho agent feature)', () => {
  const dictDir = join(fileURLToPath(new URL('.', import.meta.url)), 'dict')
  const dictFiles = readdirSync(dictDir).filter((f) => f.endsWith('.ts')).sort()

  it('mọi file dict/ đều được đăng ký trong dicts (index.ts import đủ namespace)', () => {
    const registered = Object.keys(dicts).sort()
    expect(dictFiles.map((f) => f.replace(/\.ts$/, ''))).toEqual(registered)
  })

  it('tập key vi === tập key en cho từng namespace (dict trống thì bỏ qua)', () => {
    for (const [ns, dict] of Object.entries(dicts)) {
      const viKeys = Object.keys(dict.vi).sort()
      const enKeys = Object.keys(dict.en).sort()
      if (viKeys.length === 0 && enKeys.length === 0) continue // namespace mới — agent sau điền
      expect(viKeys, `namespace "${ns}": key có ở en mà thiếu ở vi → ${enKeys.filter((k) => !viKeys.includes(k)).join(', ')}`)
        .toEqual(enKeys)
    }
  })

  it('không key nào để chuỗi rỗng (rỗng phải dùng key thiếu hoặc bỏ)', () => {
    for (const [ns, dict] of Object.entries(dicts)) {
      for (const [lang, entries] of Object.entries(dict)) {
        for (const [key, value] of Object.entries(entries)) {
          expect(value.trim().length, `${ns}:${key} (${lang}) — chuỗi rỗng`).toBeGreaterThan(0)
        }
      }
    }
  })
})
