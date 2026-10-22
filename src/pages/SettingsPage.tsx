import { useState } from 'react'
import { Sun, Moon, Info, Rss, ExternalLink, Globe, BadgeCheck, Sparkles, LogOut, LogIn, UserPlus } from 'lucide-react'
import { Language } from '../services/api'
import { AuthUser, login, register } from '../services/auth'

interface SettingsPageProps {
    darkMode: boolean
    onToggleDark: () => void
    positivityFilter: number
    onPositivityFilterChange: (v: number) => void
    lang: Language
    onLangChange: (lang: Language) => void
    session: AuthUser | null
    onSessionChange: (user: AuthUser | null) => void
    onLogout: () => void
}

const PRESETS = [
    { label: 'Gentle', value: 40, desc: 'Balanced mix of news' },
    { label: 'Positive', value: 70, desc: 'Mostly good news' },
    { label: 'Pure Uplift', value: 95, desc: 'Maximum positivity only' },
]

const SOURCES = [
    { name: 'r/UpliftingNews', url: 'https://reddit.com/r/UpliftingNews', type: 'Reddit' },
    { name: 'r/GoodNews', url: 'https://reddit.com/r/GoodNews', type: 'Reddit' },
    { name: 'r/HumansBeingBros', url: 'https://reddit.com/r/HumansBeingBros', type: 'Reddit' },
    { name: 'r/MadeMeSmile', url: 'https://reddit.com/r/MadeMeSmile', type: 'Reddit' },
    { name: 'r/aww', url: 'https://reddit.com/r/aww', type: 'Reddit' },
    { name: 'Good News Network', url: 'https://goodnewsnetwork.org', type: 'RSS' },
    { name: 'Positive.news', url: 'https://positive.news', type: 'RSS' },
]

export default function SettingsPage({
    darkMode,
    onToggleDark,
    positivityFilter,
    onPositivityFilterChange,
    lang,
    onLangChange,
    session,
    onSessionChange,
    onLogout,
}: SettingsPageProps) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [mode, setMode] = useState<'signin' | 'signup'>('signin')
    const [authError, setAuthError] = useState<string | null>(null)
    const [authBusy, setAuthBusy] = useState(false)

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setAuthError(null)
        setAuthBusy(true)
        try {
            const user = mode === 'signin'
                ? await login(email.trim(), password)
                : await register(email.trim(), password)
            onSessionChange(user)
            setPassword('')
        } catch (err: any) {
            setAuthError(err?.message || 'Something went wrong')
        } finally {
            setAuthBusy(false)
        }
    }

    return (
        <div>
            {/* X-style header */}
            <div className="x-feed-header">
                <div className="x-feed-title">
                    <h1>Settings</h1>
                </div>
            </div>

            <div className="flex flex-col">
                {/* Appearance */}
                <div className="border-b border-[var(--border)] px-4 py-4">
                    <h2 className="font-bold text-[17px] mb-3" style={{ letterSpacing: '-0.02em' }}>Appearance</h2>
                    <div className="flex gap-3">
                        <button
                            id="theme-light-btn"
                            onClick={() => darkMode && onToggleDark()}
                            className={`btn ${!darkMode ? 'btn-primary' : 'btn-outline'}`}
                            style={{ flex: 1, padding: '10px 16px', fontSize: '14px', borderRadius: 'var(--radius-full)' }}
                        >
                            <Sun size={16} /> Light
                        </button>
                        <button
                            id="theme-dark-btn"
                            onClick={() => !darkMode && onToggleDark()}
                            className={`btn ${darkMode ? 'btn-primary' : 'btn-outline'}`}
                            style={{ flex: 1, padding: '10px 16px', fontSize: '14px', borderRadius: 'var(--radius-full)' }}
                        >
                            <Moon size={16} /> Dark
                        </button>
                    </div>
                </div>

                {/* Language */}
                <div className="border-b border-[var(--border)] px-4 py-4">
                    <h2 className="font-bold text-[17px] mb-3" style={{ letterSpacing: '-0.02em' }}>Language</h2>
                    <div className="flex gap-3">
                        <button
                            id="lang-en-btn"
                            onClick={() => onLangChange('en')}
                            className={`btn ${lang === 'en' ? 'btn-primary' : 'btn-outline'}`}
                            style={{ flex: 1, padding: '10px 16px', fontSize: '14px', borderRadius: 'var(--radius-full)' }}
                        >
                            <Globe size={16} /> English
                        </button>
                        <button
                            id="lang-sw-btn"
                            onClick={() => onLangChange('sw')}
                            className={`btn ${lang === 'sw' ? 'btn-primary' : 'btn-outline'}`}
                            style={{ flex: 1, padding: '10px 16px', fontSize: '14px', borderRadius: 'var(--radius-full)' }}
                        >
                            <Globe size={16} /> Swahili
                        </button>
                    </div>
                    <p className="text-[13px] text-[var(--text-muted)] mt-2">
                        {lang === 'sw' ? 'Chagua lugha ya mapendeleo kwa maudhui yaliyotafsiriwa.' : 'Select your preferred language for translated content.'}
                    </p>
                </div>

                {/* Account */}
                <div className="border-b border-[var(--border)] px-4 py-4">
                    <h2 className="font-bold text-[17px] mb-3" style={{ letterSpacing: '-0.02em' }}>
                        {lang === 'sw' ? 'Akaunti' : 'Account'}
                    </h2>

                    {session ? (
                        <div>
                            <div className="flex items-center gap-3 bg-[var(--bg-muted)] rounded-xl p-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-muted)] flex items-center justify-center">
                                    <span className="font-bold text-[var(--text-muted)]">
                                        {session.email.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="font-bold text-sm flex items-center gap-1 truncate">
                                        {session.email}
                                        <BadgeCheck size={14} className="text-[var(--brand-x)]" />
                                    </div>
                                    <div className="text-[13px] text-[var(--text-muted)]">
                                        {session.level} &middot; {session.streak} day streak
                                    </div>
                                </div>
                            </div>
                            <button
                                id="logout-btn"
                                onClick={onLogout}
                                className="btn btn-outline w-full justify-center mt-3"
                                style={{ padding: '12px', fontSize: '14px', borderRadius: 'var(--radius-full)' }}
                            >
                                <LogOut size={16} /> {lang === 'sw' ? 'Toka' : 'Sign out'}
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleAuth}>
                            <div className="flex gap-2 mb-3">
                                <button
                                    type="button"
                                    onClick={() => { setMode('signin'); setAuthError(null) }}
                                    className={`btn ${mode === 'signin' ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ flex: 1, padding: '10px 16px', fontSize: '14px', borderRadius: 'var(--radius-full)' }}
                                >
                                    <LogIn size={16} /> {lang === 'sw' ? 'Ingia' : 'Sign in'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setMode('signup'); setAuthError(null) }}
                                    className={`btn ${mode === 'signup' ? 'btn-primary' : 'btn-outline'}`}
                                    style={{ flex: 1, padding: '10px 16px', fontSize: '14px', borderRadius: 'var(--radius-full)' }}
                                >
                                    <UserPlus size={16} /> {lang === 'sw' ? 'Jisajili' : 'Create account'}
                                </button>
                            </div>

                            <input
                                type="email"
                                id="auth-email"
                                autoComplete="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                className="w-full bg-[var(--bg-muted)] border-none rounded-xl px-4 py-3 text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-1 focus:ring-[var(--brand-x)] mb-2"
                            />
                            <input
                                type="password"
                                id="auth-password"
                                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                                className="w-full bg-[var(--bg-muted)] border-none rounded-xl px-4 py-3 text-[var(--text-primary)] text-[15px] focus:outline-none focus:ring-1 focus:ring-[var(--brand-x)] mb-2"
                            />

                            {authError && (
                                <p
                                    id="auth-error"
                                    role="alert"
                                    className="text-[13px] mb-2"
                                    style={{ color: '#ef4444' }}
                                >
                                    {authError}
                                </p>
                            )}

                            <button
                                type="submit"
                                id="auth-submit"
                                disabled={authBusy}
                                className="btn btn-primary w-full justify-center"
                                style={{ padding: '12px', fontSize: '14px', borderRadius: 'var(--radius-full)', opacity: authBusy ? 0.6 : 1 }}
                            >
                                {authBusy
                                    ? (lang === 'sw' ? 'Inasubiri...' : 'Please wait...')
                                    : (mode === 'signup'
                                        ? (lang === 'sw' ? 'Tengeneza akaunti' : 'Create account')
                                        : (lang === 'sw' ? 'Ingia' : 'Sign in'))}
                            </button>

                            <p className="text-[12px] text-[var(--text-muted)] mt-2">
                                {lang === 'sw'
                                    ? 'Inajificha kwenye kifurushi chako ili kurodi nyimbo zako kwa upanafu.'
                                    : 'Sign in to sync your saved stories and streak across devices.'}
                            </p>
                        </form>
                    )}
                </div>

                {/* Positivity Presets */}
                <div className="border-b border-[var(--border)] px-4 py-4">
                    <h2 className="font-bold text-[17px] mb-1" style={{ letterSpacing: '-0.02em' }}>Positivity Level</h2>
                    <p className="text-[13px] text-[var(--text-muted)] mb-3">Current: {positivityFilter}%</p>
                    <div className="flex flex-col gap-2">
                        {PRESETS.map(({ label, value, desc }) => {
                            const active = Math.abs(positivityFilter - value) < 5
                            return (
                                <button
                                    key={label}
                                    id={`preset-${label.toLowerCase().replace(/\s+/g, '-')}`}
                                    onClick={() => onPositivityFilterChange(value)}
                                    className="btn"
                                    style={{
                                        justifyContent: 'space-between',
                                        background: active ? 'hsla(203, 89%, 53%, 0.1)' : 'var(--bg-muted)',
                                        color: active ? 'var(--brand-x)' : 'var(--text-secondary)',
                                        border: active ? '1.5px solid var(--brand-x)' : '1.5px solid transparent',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '10px 14px',
                                        borderRadius: 'var(--radius-full)',
                                        fontSize: '14px',
                                    }}
                                >
                                    <span className="font-bold">{label}</span>
                                    <span style={{ fontSize: '13px', opacity: 0.75 }}>{desc}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Content Sources */}
                <div className="border-b border-[var(--border)] px-4 py-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Rss size={16} className="text-[var(--brand-x)]" />
                        <h2 className="font-bold text-[17px]" style={{ letterSpacing: '-0.02em' }}>Content Sources</h2>
                    </div>
                    <div className="flex flex-col gap-1">
                        {SOURCES.map(({ name, url, type }) => (
                            <a
                                key={name}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between px-3 py-2.5 rounded-full hover:bg-[var(--bg-muted)] transition-colors"
                                style={{ textDecoration: 'none', color: 'var(--text-primary)' }}
                            >
                                <span className="text-[15px]">{name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-muted)] px-3 py-1 rounded-full">{type}</span>
                                    <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                                </div>
                            </a>
                        ))}
                    </div>
                </div>

                {/* About */}
                <div className="px-4 py-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Info size={16} className="text-[var(--brand-x)]" />
                        <h2 className="font-bold text-[17px]" style={{ letterSpacing: '-0.02em' }}>About Uplift</h2>
                    </div>
                    <p className="text-[15px] text-[var(--text-secondary)] leading-relaxed">
                        Uplift curates good news from across the internet using AI to filter only positive, inspiring stories. Built as a free, open-source PWA for the Kenyan creators community.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                        <Sparkles size={14} className="text-[var(--brand-x)]" />
                        <span className="text-[13px] text-[var(--text-muted)]">v2.0 &middot; Creators Circle</span>
                    </div>
                </div>
            </div>

            {/* Bottom spacer for mobile nav */}
            <div style={{ height: 16 }} />
        </div>
    )
}