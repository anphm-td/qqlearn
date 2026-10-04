import { NavLink } from 'react-router-dom'

import { MAIN_TABS } from '@/components/layout/nav'
import Icon from '@/components/ui/Icon'
import { cn } from '@/components/ui/cn'

/**
 * TabBar đáy màn — CHỈ hiển thị <768px (design-system.md mục 10: từ 768px thay bằng Sidebar).
 * Dữ liệu menu lấy từ nav.ts (cùng nguồn với Sidebar). Tab active màu --teal.
 */
export default function TabBar() {
  return (
    <nav
      data-testid="tabbar"
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto grid w-full max-w-[430px] grid-cols-4">
        {MAIN_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 px-2 py-2.5 type-caption',
                isActive ? 'text-teal' : 'text-muted',
              )
            }
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
