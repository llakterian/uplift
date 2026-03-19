import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Moon, Sun, Bell, Globe, Flame } from 'lucide-react'
import { Language } from '../../services/api'

interface HeaderProps {
    darkMode: boolean
    onToggleDark: () => void
    lang: Language
    onLangChange: (lang: Language) => void
    user: {
        streak: number
        level: string
        loggedIn: boolean
    }
}

export default function Header({ darkMode, onToggleDark, lang, onLangChange, user }: HeaderProps) {
    const [scrolled, setScrolled] = useState(false)
    const [notificationsEnabled, setNotificationsEnabled] = useState(false)
    const location = useLocation()

    const handleNotifications = async () => {
        if (notificationsEnabled) {
            setNotificationsEnabled(false)
            return
        }
        
        if ('Notification' in window) {
            const permission = await Notification.requestPermission()
            if (permission === 'granted') {
                setNotificationsEnabled(true)
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'ENABLE_NOTIFICATIONS' })
                }
            }
        }
    }

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
                    {/* Language Switcher */}
                    <button
                        id="lang-toggle"
                        title={lang === 'en' ? 'Switch to Swahili' : 'Switch to English'}
                        className="btn-icon"
                        onClick={() => onLangChange(lang === 'en' ? 'sw' : 'en')}
                        style={{ borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 700, padding: '0.35rem 0.5rem' }}
                    >
                        <Globe size={16} style={{ color: 'var(--text-secondary)' }} />
                        <span style={{ marginLeft: 4 }}>{lang.toUpperCase()}</span>
                    </button>

                    {/* Streak Badge */}
                    {user.streak > 0 && (
                        <div
                            className="flex items-center gap-1 px-2 py-1 rounded-lg"
                            style={{ backgroundColor: 'var(--bg-muted)', fontSize: '0.75rem' }}
                        >
                            <Flame size={14} style={{ color: '#f97316' }} />
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.streak}</span>
                        </div>
                    )}

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
                        title={notificationsEnabled 
                            ? (lang === 'sw' ? 'Arifa zimewezeshwa' : 'Notifications enabled')
                            : (lang === 'sw' ? 'Weka arifa' : 'Enable notifications')
                        }
                        className="btn-icon"
                        onClick={handleNotifications}
                        style={{ 
                            borderRadius: 'var(--radius-sm)',
                            backgroundColor: notificationsEnabled ? 'var(--brand-green)' : 'transparent',
                        }}
                    >
                        <Bell size={18} style={{ color: notificationsEnabled ? 'white' : 'var(--text-secondary)' }} />
                    </button>
                </div>
            </div>
        </header>
    )
}
