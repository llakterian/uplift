import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Moon, Sun, Bell } from 'lucide-react'

interface HeaderProps {
    darkMode: boolean
    onToggleDark: () => void
}

export default function Header({ darkMode, onToggleDark }: HeaderProps) {
    const [scrolled, setScrolled] = useState(false)
    const location = useLocation()

    const pageTitles: Record<string, string> = {
        '/': 'Uplift',
        '/bookmarks': 'Bookmarks',
        '/settings': 'Settings',
    }
    const title = pageTitles[location.pathname] ?? 'Uplift'

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 8)
        window.addEventListener('scroll', handler, { passive: true })
        return () => window.removeEventListener('scroll', handler)
    }, [])

    return (
        <header
            className={`sticky top-0 z-50 transition-all duration-200 ${scrolled ? 'glass shadow-[var(--shadow-md)]' : ''
                }`}
            style={{
                backgroundColor: scrolled ? undefined : 'var(--bg)',
                borderBottom: scrolled ? undefined : '1px solid var(--border)',
            }}
        >
            <div className="px-8 py-3 flex items-center justify-between gap-3">
                {/* Logo + wordmark */}
                <NavLink to="/" className="flex items-center gap-2.5 no-underline">
                    <div
                        className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
                        style={{ boxShadow: 'var(--shadow-sm)' }}
                    >
                        <img
                            src="/logo.jpg"
                            alt="Uplift logo"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <span
                        className="text-lg font-bold hidden sm:block"
                        style={{
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            color: 'var(--text-primary)',
                        }}
                    >
                        {title}
                    </span>
                    <span
                        className="text-lg font-bold sm:hidden"
                        style={{
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            color: 'var(--text-primary)',
                        }}
                    >
                        {title}
                    </span>
                </NavLink>

                {/* Tagline — desktop only */}
                <span
                    className="hidden md:block text-sm flex-1"
                    style={{ color: 'var(--text-muted)' }}
                >
                    Your daily dose of good news
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <button
                        id="dark-mode-toggle"
                        title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                        className="btn-icon"
                        onClick={onToggleDark}
                        style={{ borderRadius: 'var(--radius-sm)' }}
                    >
                        {darkMode
                            ? <Sun size={18} className="text-azure" />
                            : <Moon size={18} style={{ color: 'var(--text-secondary)' }} />
                        }
                    </button>
                    <button
                        id="notifications-btn"
                        title="Notifications"
                        className="btn-icon"
                        style={{ borderRadius: 'var(--radius-sm)' }}
                    >
                        <Bell size={18} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                </div>
            </div>
        </header>
    )
}
