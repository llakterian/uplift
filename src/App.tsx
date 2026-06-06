import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom'
import {
  LayoutGrid, Bookmark, Settings as SettingsIcon, Users, Search, Plus
} from 'lucide-react'
import InstallBanner from './components/InstallBanner'
import FeedPage from './pages/FeedPage'
import BookmarksPage from './pages/BookmarksPage'
import SettingsPage from './pages/SettingsPage'
import CirclePage from './pages/CirclePage'
import ExplorePage from './pages/ExplorePage'
import BottomNav from './components/layout/BottomNav'
import { DEFAULT_PREFS, UserPreferences } from './types'
import { Language } from './services/api'

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

function loadUserData() {
  try {
    const raw = localStorage.getItem('uplift_user')
    if (raw) return JSON.parse(raw)
  } catch { }
  return { streak: 0, level: 'Uplift Explorer', loggedIn: false, username: null, avatar: null }
}

function saveUserData(data: { streak: number; level: string; loggedIn: boolean; username: string | null; avatar: string | null }) {
  try {
    localStorage.setItem('uplift_user', JSON.stringify(data))
  } catch { }
}

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: LayoutGrid },
  { to: '/explore', label: 'Explore', icon: Search },
  { to: '/circle', label: 'Circle', icon: Users },
  { to: '/bookmarks', label: 'Bookmarks', icon: Bookmark },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function App() {
  const [prefs, setPrefs] = useState<UserPreferences>(loadPrefs)
  const [lang, setLang] = useState<Language>(() => {
    const savedLang = localStorage.getItem('uplift_lang')
    return (savedLang === 'en' || savedLang === 'sw') ? savedLang : 'en'
  })
  const [user] = useState(loadUserData)
  const [searchQuery, setSearchQuery] = useState('')

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
  useEffect(() => { saveUserData(user) }, [user])
  useEffect(() => { localStorage.setItem('uplift_lang', lang) }, [lang])

  const isDark = prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

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

  const handleXSignIn = () => {
    // Redirect to X OAuth — handled via /api/auth/x
    window.location.href = '/api/auth/x'
  }

  return (
    <HashRouter>
      <div className="bg-[var(--bg)] min-h-screen text-[var(--text-primary)]">
        <div className="app-container">
          {/* Desktop Left Navigation — X-style */}
          <aside className="sidebar-desktop">
            {/* Uplift Logo */}
            <NavLink to="/" className="nav-item logo-item" style={{ marginTop: 4 }}>
              <div className="w-8 h-8 rounded-full overflow-hidden" style={{ borderRadius: '4px' }}>
                <img src="/logo.jpg" alt="Uplift" className="w-full h-full object-cover" />
              </div>
            </NavLink>

            {/* Navigation items */}
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }: { isActive: boolean }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
                title={label}
              >
                {({ isActive }: { isActive: boolean }) => (
                  <Icon size={22} strokeWidth={isActive ? 2.3 : 1.8} />
                )}
              </NavLink>
            ))}

            {/* Post/Amplify Button */}
            <button 
              className="sidebar-tweet-btn"
              title="Amplify"
              onClick={() => {
                const url = `https://x.com/intent/tweet?text=${encodeURIComponent('Sharing positive vibes from Uplift! 🚀 #UpliftCircle #Kenya')}`
                window.open(url, '_blank')
              }}
            >
              <Plus size={22} strokeWidth={2.5} />
            </button>

            {/* Profile — X OAuth */}
            <button 
              className="sidebar-tweet-btn" 
              style={{ background: 'transparent', marginTop: 0 }}
              title="Sign in with X"
              onClick={handleXSignIn}
            >
              <div className="w-9 h-9 rounded-full overflow-hidden bg-[var(--bg-muted)] flex items-center justify-center" style={{ border: '2px solid var(--border)' }}>
                {user.loggedIn && user.avatar ? (
                  <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-[var(--text-muted)]">
                    {user.loggedIn ? user.username?.charAt(0)?.toUpperCase() || 'U' : 'U'}
                  </span>
                )}
              </div>
            </button>
          </aside>

          {/* Main Content Area */}
          <main className="main-content">
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
                    lang={lang}
                    searchQuery={searchQuery}
                  />
                }
              />
              <Route
                path="/explore"
                element={<ExplorePage lang={lang} />}
              />
              <Route
                path="/circle"
                element={<CirclePage />}
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
                    lang={lang}
                    onLangChange={setLang}
                    user={user}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            {/* Mobile bottom nav spacer */}
            <div className="lg:hidden" style={{ height: 56 }} />
          </main>

          {/* Right sidebar — trending / verified sources */}
          <aside className="hidden lg:block" style={{ width: 350, flexShrink: 0 }}>
            <div className="fixed" style={{ width: 350, padding: '12px 24px 0 24px' }}>
              {/* Search bar */}
              <div className="relative mb-4">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search feeds..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[var(--bg-muted)] border-none rounded-full py-2.5 pl-11 pr-4 text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-1 focus:ring-[var(--brand-x)] focus:bg-[var(--bg)] transition-colors"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
                />
              </div>

              {/* Verified Sources box */}
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
                <h2 className="font-bold text-xl px-4 pt-3 pb-2" style={{ letterSpacing: '-0.02em' }}>Verified Sources</h2>
                <div className="flex flex-col">
                  {[
                    { name: 'Reddit Positive', handle: 'r/UpliftingNews', url: 'https://reddit.com/r/UpliftingNews' },
                    { name: 'Dev.to High-Value', handle: 'dev.to', url: 'https://dev.to' },
                    { name: 'RSS Global Uplift', handle: 'rss feed', url: '#' },
                  ].map((src, i) => (
                    <a
                      key={i}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                      style={{ textDecoration: 'none', color: 'var(--text-primary)' }}
                    >
                      <div className="w-10 h-10 rounded-full bg-[var(--bg-hover)] flex items-center justify-center flex-shrink-0">
                        <div className="w-4 h-4 rounded-full bg-[var(--brand-x)]" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-[15px] truncate">{src.name}</div>
                        <div className="text-[13px] text-[var(--text-muted)]">{src.handle}</div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile bottom navigation */}
        <BottomNav />

        {/* PWA install prompt */}
        <InstallBanner />
      </div>
    </HashRouter>
  )
}