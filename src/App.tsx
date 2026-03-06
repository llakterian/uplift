import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { LayoutGrid, Bookmark, Settings as SettingsIcon } from 'lucide-react'
import Header from './components/layout/Header'
import BottomNav from './components/layout/BottomNav'
import InstallBanner from './components/InstallBanner'
import FeedPage from './pages/FeedPage'
import BookmarksPage from './pages/BookmarksPage'
import SettingsPage from './pages/SettingsPage'
import { DEFAULT_PREFS, UserPreferences } from './types'

function loadPrefs() {
  try {
    const raw = localStorage.getItem('uplift_prefs')
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) }
  } catch { }
  return DEFAULT_PREFS
}

function savePrefs(prefs: UserPreferences) {
  try {
    localStorage.setItem('uplift_prefs', JSON.stringify(prefs))
  } catch { }
}

export default function App() {
  const [prefs, setPrefs] = useState<UserPreferences>(loadPrefs)

  useEffect(() => {
    const root = document.documentElement
    if (prefs.theme === 'dark') {
      root.classList.add('dark')
    } else if (prefs.theme === 'light') {
      root.classList.remove('dark')
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.matches ? root.classList.add('dark') : root.classList.remove('dark')
    }
  }, [prefs.theme])

  useEffect(() => { savePrefs(prefs) }, [prefs])

  const isDark = document.documentElement.classList.contains('dark')

  const toggleDark = () => {
    setPrefs(p => ({ ...p, theme: p.theme === 'dark' ? 'light' : 'dark' }))
  }

  const setPositivity = (v: number) =>
    setPrefs(p => ({ ...p, positivityFilter: v }))

  const setCategories = (c: string[]) =>
    setPrefs(p => ({ ...p, selectedCategories: c }))

  const toggleBookmark = (id: string) => {
    setPrefs(p => ({
      ...p,
      bookmarkedIds: p.bookmarkedIds.includes(id)
        ? p.bookmarkedIds.filter(b => b !== id)
        : [...p.bookmarkedIds, id],
    }))
  }

  return (
    <HashRouter>
      <div className="bg-[var(--bg)] min-h-screen text-[var(--text-primary)]">
        <Header darkMode={isDark} onToggleDark={toggleDark} />

        <div className="app-container">
          {/* Desktop Sidebar */}
          <aside className="sidebar-desktop p-6">
            <nav className="flex flex-col gap-2 p-2">
              {[
                { to: '/', label: 'Feed', icon: LayoutGrid },
                { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
                { to: '/settings', label: 'Settings', icon: SettingsIcon },
              ].map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => `
                    flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all
                    ${isActive
                      ? 'bg-azure text-white shadow-lg shadow-[hsla(203,100%,50%,0.25)] scale-[1.02]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)]'}
                  `}
                >
                  <Icon size={18} strokeWidth={2.5} />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto m-4 p-5 rounded-2xl bg-[var(--bg-muted)] border border-[var(--border)] overflow-hidden relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-azure/5 rounded-full -mr-8 -mt-8" />
              <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-3 opacity-60">Verified Sources</p>
              <div className="flex flex-col gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                <span className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-azure" /> Reddit Positive
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-azure" /> Dev.to High-Value
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-azure" /> RSS Global Uplift
                </span>
              </div>
            </div>
          </aside>

          {/* Main Area */}
          <main className="main-content">
            <div className="feed-container py-6">
              <Routes>
                <Route
                  path="/"
                  element={
                    <FeedPage
                      positivityFilter={prefs.positivityFilter}
                      onPositivityFilterChange={setPositivity}
                      selectedCategories={prefs.selectedCategories}
                      onCategoriesChange={setCategories}
                      bookmarks={prefs.bookmarkedIds}
                      onToggleBookmark={toggleBookmark}
                    />
                  }
                />
                <Route
                  path="/bookmarks"
                  element={
                    <BookmarksPage
                      bookmarks={prefs.bookmarkedIds}
                      onToggleBookmark={toggleBookmark}
                    />
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <SettingsPage
                      darkMode={isDark}
                      onToggleDark={toggleDark}
                      positivityFilter={prefs.positivityFilter}
                      onPositivityFilterChange={setPositivity}
                    />
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>

            {/* Mobile bottom nav spacer */}
            <div className="lg:hidden" style={{ height: 80 }} />
          </main>
        </div>

        {/* Mobile bottom nav (auto-hidden on desktop via css or classes) */}
        <BottomNav />

        {/* PWA install prompt */}
        <InstallBanner />
      </div>
    </HashRouter>
  )
}
