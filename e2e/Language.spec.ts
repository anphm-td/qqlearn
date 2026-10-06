import { expect, test } from '@playwright/test'

// Xác minh yêu cầu "thêm tiếng Anh, tùy chọn trong Cài đặt":
// đổi ngôn ngữ trong Cài đặt phải chuyển toàn bộ UI sang tiếng Anh và đổi lại được,
// không cần tải lại trang (useT phản ứng theo settings).

test.describe('Ngôn ngữ vi/en — Cài đặt', () => {
  test.use({ viewport: { width: 1440, height: 900 } })

  test('chuyển sang English rồi quay lại Tiếng Việt, áp dụng ngay', async ({ page }) => {
    await page.goto('/caidat')

    // Mặc định tiếng Việt
    await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Hôm nay' })).toBeVisible()

    // Đổi sang English
    await page.getByRole('button', { name: 'English' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Today' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Study' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Notebook' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Stats' })).toBeVisible()

    // Màn khác cũng theo ngôn ngữ mới — không cần tải lại
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Today' })).toBeVisible()
    await expect(page.getByText('What did you learn today?')).toBeVisible()

    // Đổi lại tiếng Việt — dữ liệu/elemt trở về như cũ
    await page.goto('/caidat')
    await page.getByRole('button', { name: 'Tiếng Việt' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Hôm nay' })).toBeVisible()
  })

  test('màn Hôm nay hiển thị tiếng Anh ở các nhãn chính', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Cài đặt' }).click()
    await page.getByRole('button', { name: 'English' }).click()
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible()
    await expect(page.getByText('Start studying').first()).toBeVisible()
  })
})
