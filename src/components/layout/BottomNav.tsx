import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LayoutGrid, Search, Users, Bookmark, Settings } from 'lucide-react'

const TABS = [
    { to: '/', label: 'Home', Icon: LayoutGrid },
    { to: '/explore', label: 'Explore', Icon: Search },
    { to: '/circle', label: 'Circle', Icon: Users },
    { to: '/bookmarks', label: 'Saved', Icon: Bookmark },
    { to: '/settings', label: 'Settings', Icon: Settings },
]

export default function BottomNav() {
    const location = useLocation()
    const currentPath = location.pathname

    return (
        <nav
            id="bottom-nav"
            className="lg:hidden fixed bottom-0 left-0 right-0 z-50"
            style={{
                borderTop: '1px solid var(--border)',
                paddingBottom: 'env(safe-area-inset-bottom)',
            }}
        >
            <div className="flex items-stretch justify-around relative">
                {TABS.map(({ to, label, Icon }) => {
                    const isActive = to === '/' ? currentPath === '/' : currentPath.startsWith(to)
                    return (
                        <NavLink
                            key={to}
                            to={to}
                            end={to === '/'}
                            className={`flex flex-col items-center gap-0.5 transition-all duration-200 py-3 px-3 no-underline relative ${
                                isActive ? 'text-[var(--brand-x)]' : 'text-[var(--text-muted)]'
                            }`}
                        >
                            <Icon
                                size={22}
                                strokeWidth={isActive ? 2.3 : 1.8}
                                fill={isActive ? 'currentColor' : 'none'}
                                fillOpacity={isActive ? 0.2 : 0}
                            />
                            <span className="text-[10px] font-semibold leading-none">{label}</span>
                            {isActive && (
                                <motion.div
                                    layoutId="bottom-nav-pill"
                                    className="absolute -top-px left-2 right-2 h-[3px] rounded-b-full"
                                    style={{ background: 'var(--brand-x)' }}
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}
                        </NavLink>
                    )
                })}
            </div>
        </nav>
    )
}