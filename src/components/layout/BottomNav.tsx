import { NavLink } from 'react-router-dom'
import { Rss, Bookmark, Settings } from 'lucide-react'

const TABS = [
    { to: '/', label: 'Feed', Icon: Rss },
    { to: '/bookmarks', label: 'Saved', Icon: Bookmark },
    { to: '/settings', label: 'Settings', Icon: Settings },
]

export default function BottomNav() {
    return (
        <nav
            id="bottom-nav"
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 glass"
            style={{
                borderTop: '1px solid var(--border)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="flex items-stretch justify-around">
                {TABS.map(({ to, label, Icon }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) => `
                  flex flex-col items-center gap-1 transition-all duration-200
                  ${isActive ? 'text-azure scale-110' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}
                `}
                        style={({ isActive }) => ({
                            color: isActive ? 'var(--brand-green)' : 'var(--text-muted)',
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                        })}
                    >
                        {({ isActive }) => (
                            <>
                                <span
                                    className="transition-all duration-150"
                                    style={{
                                        transform: isActive ? 'scale(1.15)' : 'scale(1)',
                                        display: 'block',
                                    }}
                                >
                                    <Icon
                                        size={20}
                                        strokeWidth={isActive ? 2.3 : 1.8}
                                        fill={isActive ? 'currentColor' : 'none'}
                                        fillOpacity={isActive ? 0.18 : 0}
                                    />
                                </span>
                                <span className="text-[10px] font-semibold leading-none">{label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    )
}
