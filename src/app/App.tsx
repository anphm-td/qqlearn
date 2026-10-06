import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AppLayout from '@/components/layout/AppLayout'
import ChatPage from '@/features/chat/ChatPage'
import DailyNotePage from '@/features/notes/DailyNotePage'
import MistakesPage from '@/features/notebook/MistakesPage'
import NotebookPage from '@/features/notebook/NotebookPage'
import VocabPage from '@/features/notebook/VocabPage'
import VocabReviewPage from '@/features/notebook/VocabReviewPage'
import OnboardingPage from '@/features/onboarding/OnboardingPage'
import SettingsPage from '@/features/settings/SettingsPage'
import ScoresPage from '@/features/stats/ScoresPage'
import StatsPage from '@/features/stats/StatsPage'
import WeekPage from '@/features/stats/WeekPage'
import SessionPage from '@/features/study/SessionPage'
import StudyPage from '@/features/study/StudyPage'
import SubjectsPage from '@/features/subjects/SubjectsPage'
import TodayPage from '@/features/today/TodayPage'

/**
 * Cây route — xuất riêng để test render được bằng MemoryRouter.
 * 4 tab chính + trang con (mục 1 design-system.md), khung chung AppLayout
 * (TabBar đáy màn <768px, Sidebar trái ≥768px).
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Onboarding: màn lần đầu chạy app, không có TabBar/Sidebar */}
      <Route path="/onboarding" element={<OnboardingPage />} />

      <Route element={<AppLayout />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/hoc" element={<StudyPage />} />
        <Route path="/hoc/buoi-hoc" element={<SessionPage />} />
        <Route path="/sotay" element={<NotebookPage />} />
        <Route path="/sotay/tu-vung" element={<VocabPage />} />
        <Route path="/sotay/tu-vung/on-tap" element={<VocabReviewPage />} />
        <Route path="/sotay/loi-sai" element={<MistakesPage />} />
        <Route path="/mon-hoc" element={<SubjectsPage />} />
        <Route path="/thongke" element={<StatsPage />} />
        <Route path="/thongke/diem" element={<ScoresPage />} />
        <Route path="/thongke/tuan" element={<WeekPage />} />
        <Route path="/ghichu" element={<DailyNotePage />} />
        <Route path="/caidat" element={<SettingsPage />} />
        <Route path="/tro-chuyen" element={<ChatPage />} />
        <Route path="*" element={<TodayPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
