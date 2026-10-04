import { NavLink } from 'react-router-dom'

import { MAIN_TABS, SECONDARY_NAV, type NavItem } from '@/components/layout/nav'
import Icon from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'

function NavList({ items }: { items: readonly NavItem[] }) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => cn('nav-item', isActive && 'nav-item--active')}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </>
  )
}

/**
 * Sidebar trái ~220px — CHỈ hiển thị ≥768px, thay cho TabBar (design-system.md mục 10):
 * nền --bg, viền phải 1px --rule, sticky; 4 mục chính trên, nhóm phụ (Trò chuyện · Cài đặt)
 * dưới đường kẻ ngang; mục active = bubble nền --teal chữ trắng; chân sidebar = gợi ý phím tắt
 * caption màu --muted. Cùng nguồn menu với TabBar (nav.ts).
 */
export default function Sidebar() {
  return (
    <aside
      data-testid="sidebar"
      className="sticky top-0 hidden h-dvh w-[220px] shrink-0 flex-col border-r border-rule bg-bg px-3 py-5 md:flex"
    >
      <p className="type-h2 px-3">Sổ học TOEIC</p>

      <nav aria-label="Điều hướng chính" className="mt-5 flex flex-col gap-1">
        <NavList items={MAIN_TABS} />
      </nav>

      <hr className="dashed-rule my-4" aria-hidden="true" />

      <nav aria-label="Nhóm phụ" className="flex flex-col gap-1">
        <NavList items={SECONDARY_NAV} />
      </nav>

      <p className="type-caption mt-auto px-3 text-muted">
        Phím tắt: 1–4 đổi tab · N ghi chú hôm nay
      </p>
    </aside>
  )
}
