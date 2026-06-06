import { NavLink } from 'react-router-dom'
import { LayoutGrid, Search, Users, Bookmark, Settings } from 'lucide-react'

const TABS = [
    { to: '/', label: 'Home', Icon: LayoutGrid },
    { to: '/explore', label: 'Explore', Icon: Search },
    { to: '/circle', label: 'Circle', Icon: Users },
    { to: '/bookmarks', label: 'Saved', Icon: Bookmark },
    { to: '/settings', label: 'Settings', Icon: Settings },
]

export default function BottomNav() {
    return (
        <nav
            id="bottom-nav"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
            style={{
                background: 'var(--bg)',
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
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-0.5 transition-all duration-200 py-2 px-3 no-underline ${
                                isActive ? 'text-[var(--brand-x)]' : 'text-[var(--text-muted)]'
                            }`
                        }
                    >
                        {({ isActive }) => (
                            <>
                                <Icon
                                    size={22}
                                    strokeWidth={isActive ? 2.3 : 1.8}
                                    fill={isActive ? 'currentColor' : 'none'}
                                    fillOpacity={isActive ? 0.2 : 0}
                                />
                                <span className="text-[10px] font-semibold leading-none">{label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </div>
        </nav>
    )
}