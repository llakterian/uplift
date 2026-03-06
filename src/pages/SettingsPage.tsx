import { Sun, Moon, Info, Rss, ExternalLink } from 'lucide-react'

interface SettingsPageProps {
    darkMode: boolean
    onToggleDark: () => void
    positivityFilter: number
    onPositivityFilterChange: (v: number) => void
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
}: SettingsPageProps) {
    return (
        <div>
            <div style={{ padding: '20px 0 20px' }}>
                <h1
                    style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: '1.5rem',
                        color: 'var(--text-primary)',
                    }}
                >
                    Settings
                </h1>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Theme */}
                <section className="card" style={{ padding: '18px 18px' }}>
                    <h2
                        style={{
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            fontWeight: 700,
                            fontSize: '0.9375rem',
                            marginBottom: 14,
                            color: 'var(--text-primary)',
                        }}
                    >
                        Appearance
                    </h2>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button
                            id="theme-light-btn"
                            onClick={() => darkMode && onToggleDark()}
                            className={`btn ${!darkMode ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ flex: 1 }}
                        >
                            <Sun size={14} /> Light
                        </button>
                        <button
                            id="theme-dark-btn"
                            onClick={() => !darkMode && onToggleDark()}
                            className={`btn ${darkMode ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ flex: 1 }}
                        >
                            <Moon size={14} /> Dark
                        </button>
                    </div>
                </section>

                {/* Filter Presets */}
                <section className="card" style={{ padding: '18px 18px' }}>
                    <h2
                        style={{
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            fontWeight: 700,
                            fontSize: '0.9375rem',
                            marginBottom: 4,
                            color: 'var(--text-primary)',
                        }}
                    >
                        Positivity Presets
                    </h2>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                        Current level: {positivityFilter}%
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                                        background: active ? 'hsla(203, 100%, 50%, 0.1)' : 'var(--bg-muted)',
                                        color: active ? 'var(--brand-azure)' : 'var(--text-secondary)',
                                        border: active ? '1.5px solid var(--brand-azure)' : '1.5px solid transparent',
                                        width: '100%',
                                        textAlign: 'left',
                                    }}
                                >
                                    <span style={{ fontWeight: 700 }}>{label}</span>
                                    <span style={{ fontSize: '0.78rem', opacity: 0.75 }}>{desc}</span>
                                </button>
                            )
                        })}
                    </div>
                </section>

                {/* Sources */}
                <section className="card" style={{ padding: '18px 18px' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
                        <Rss size={16} className="text-azure" />
                        <h2
                            style={{
                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                                fontWeight: 700,
                                fontSize: '0.9375rem',
                                color: 'var(--text-primary)',
                            }}
                        >
                            Content Sources
                        </h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {SOURCES.map(({ name, url, type }) => (
                            <a
                                key={name}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 10px',
                                    borderRadius: 'var(--radius-sm)',
                                    background: 'var(--bg-muted)',
                                    textDecoration: 'none',
                                    color: 'var(--text-primary)',
                                }}
                            >
                                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.8375rem' }}>{name}</span>
                                <div className="flex items-center gap-2">
                                    <span
                                        className="badge badge-gray"
                                        style={{ fontSize: '0.68rem' }}
                                    >
                                        {type}
                                    </span>
                                    <ExternalLink size={12} style={{ color: 'var(--text-muted)' }} />
                                </div>
                            </a>
                        ))}
                    </div>
                </section>

                {/* About */}
                <section className="card" style={{ padding: '18px 18px' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
                        <Info size={16} className="text-azure" />
                        <h2
                            style={{
                                fontFamily: "'Plus Jakarta Sans', sans-serif",
                                fontWeight: 700,
                                fontSize: '0.9375rem',
                                color: 'var(--text-primary)',
                            }}
                        >
                            About Uplift
                        </h2>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                        Uplift curates good news from across the internet using AI to filter only positive,
                        inspiring stories. Built as a free, open-source PWA using Reddit, RSS, and Groq AI.
                    </p>
                    <p
                        style={{
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                            marginTop: 12,
                            fontFamily: "'Inter', sans-serif",
                        }}
                    >
                        v1.0 &middot; Stable Release
                    </p>
                </section>

            </div>

            {/* Bottom spacer for mobile nav */}
            <div className="bottom-nav-spacer" />
        </div>
    )
}
