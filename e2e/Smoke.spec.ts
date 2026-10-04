import { expect, test } from '@playwright/test'

test.describe('Smoke — Sổ học TOEIC', () => {
  test('mở "/" được (HTTP 200) và trang render khung Home', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible()
    await expect(page.getByText('Gợi ý hôm nay')).toBeVisible()
  })

  test('mở "/onboarding" thấy heading bước đầu', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(
      page.getByRole('heading', { level: 1, name: /Bạn muốn học bao nhiêu mỗi ngày\?/ }),
    ).toBeVisible()
  })
})

test.describe('Desktop 1440×900 — Sidebar thay TabBar (design-system.md mục 10)', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('mở "/" thấy sidebar hiển thị và tabbar ẩn', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('tabbar')).toBeHidden()
  })

  test('mở "/onboarding" thấy heading bước đầu', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(
      page.getByRole('heading', { level: 1, name: /Bạn muốn học bao nhiêu mỗi ngày\?/ }),
    ).toBeVisible()
  })
})
