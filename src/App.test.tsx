import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AppRoutes } from '@/app/App'

describe('khung app (smoke render)', () => {
  it('trang Home "Hôm nay" render khung + tiến độ + buổi học hôm nay', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Hôm nay' })).toBeVisible()
    // Vòng tiến độ (A4) + danh sách buổi học hôm nay đã render thật (không còn stub).
    expect(screen.getByLabelText('Tiến độ hôm nay')).toBeVisible()
    expect(screen.getByText('buổi học hôm nay')).toBeVisible()
    // Form ghi chú cuối ngày (A3) nằm ngay Home.
    expect(screen.getByLabelText('Ghi chú cuối ngày')).toBeVisible()
  })

  it('điểm ghép chéo: Home render SuggestionCard ("Gợi ý hôm nay")', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>,
    )

    expect(screen.getByText('Gợi ý hôm nay')).toBeVisible()
  })
})
