import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Heart, TrendingUp, Sparkles, X, Loader2 } from 'lucide-react'
import FeedCard from '../components/FeedCard'
import FeedCardSkeleton from '../components/FeedCardSkeleton'
import PositivitySlider from '../components/PositivitySlider'
import CategoryFilter from '../components/CategoryFilter'
import { fetchFeed, fetchDailyDigest, fetchAIDeepDive, Language } from '../services/api'
import { FeedItem } from '../types'

interface FeedPageProps {
    positivityFilter: number
    onPositivityFilterChange: (v: number) => void
    selectedCategories: string[]
    onCategoriesChange: (c: string[]) => void
    bookmarks: string[]
    onToggleBookmark: (id: string) => void
    lang: Language
}

export default function FeedPage({
    positivityFilter,
    onPositivityFilterChange,
    selectedCategories,
    onCategoriesChange,
    bookmarks,
    onToggleBookmark,
    lang,
}: FeedPageProps) {
    const [allFeed, setAllFeed] = useState<FeedItem[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [visible, setVisible] = useState(15)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
    const [intro, setIntro] = useState<string>('')
    const [deepDiveItem, setDeepDiveItem] = useState<FeedItem | null>(null)
    const [deepDiveExplanation, setDeepDiveExplanation] = useState<string>('')
    const [deepDiveLoading, setDeepDiveLoading] = useState(false)
    const intervalRef = useRef<number | null>(null)

    const load = useCallback(async (refresh = false) => {
        if (refresh) setRefreshing(true)
        else setLoading(true)
        try {
            const data = await fetchFeed(lang)
            setAllFeed(data)
            setVisible(15)
            setLastRefresh(new Date())
            const digest = await fetchDailyDigest(lang)
            if (digest.intro) setIntro(digest.intro)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [lang])

    const handleDeepDive = async (item: FeedItem) => {
        setDeepDiveItem(item)
        setDeepDiveExplanation('')
        setDeepDiveLoading(true)
        try {
            const explanation = await fetchAIDeepDive(
                item.title,
                item.classification || item.category || 'uplifting story',
                lang
            )
            setDeepDiveExplanation(explanation)
        } catch {
            setDeepDiveExplanation(lang === 'sw' 
                ? 'Samahani, siwezi kutoa maelezo sasa.' 
                : 'Sorry, I could not generate an explanation right now.')
        } finally {
            setDeepDiveLoading(false)
        }
    }

    const closeDeepDive = () => {
        setDeepDiveItem(null)
        setDeepDiveExplanation('')
    }

    // Auto-refresh every 30 seconds
    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(() => {
                load(false) // Background refresh without loading indicator
            }, 30000) // 30 seconds
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [autoRefresh, load])

    useEffect(() => { load() }, [load])

    const filtered = allFeed.filter(item => {
        const passesScore = item.positivityScore >= positivityFilter / 10
        const passesCategory = selectedCategories.length === 0 ||
            selectedCategories.includes(item.category)
        return passesScore && passesCategory
    })

    const shown = filtered.slice(0, visible)
    const hasMore = visible < filtered.length

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    return (
        <div style={{ paddingBottom: 8 }}>
            {/* Hero greeting */}
            <div
                style={{
                    padding: '20px 0 6px',
                    marginBottom: 4,
                }}
            >
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 3, fontFamily: "'Inter', sans-serif" }}>
                    {today}
                </p>
                <h1
                    style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: 'clamp(1.35rem, 5vw, 1.75rem)',
                        color: 'var(--text-primary)',
                        lineHeight: 1.2,
                        marginBottom: 6,
                    }}
                >
                    {lang === 'sw' ? 'Uplift yako ya kila siku' : 'Your daily uplift'}
                </h1>
                {intro ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--brand-green)', marginBottom: 8, fontStyle: 'italic' }}>
                        <Sparkles size={12} style={{ display: 'inline', marginRight: 4 }} />
                        {intro}
                    </p>
                ) : (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {loading
                            ? (lang === 'sw' ? 'Inatafuta habari njema kwako...' : 'Finding good news for you...')
                            : `${filtered.length} uplifting stories curated just for you`}
                    </p>
                )}
            </div>

            {/* Positivity Slider */}
            <div style={{ marginBottom: 12 }}>
                <PositivitySlider value={positivityFilter} onChange={onPositivityFilterChange} />
            </div>

            {/* Category chips */}
            <div style={{ marginBottom: 16 }}>
                <CategoryFilter selected={selectedCategories} onChange={onCategoriesChange} />
            </div>

            {/* Feed header row */}
            <div
                className="flex items-center justify-between"
                style={{ marginBottom: 12 }}
            >
                <div className="flex items-center gap-2">
                    <TrendingUp size={15} style={{ color: 'var(--brand-green)' }} />
                    <span
                        style={{
                            fontFamily: "'Plus Jakarta Sans', sans-serif",
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            color: 'var(--text-primary)',
                        }}
                    >
                        {loading ? 'Loading...' : `${filtered.length} stories`}
                    </span>
                    {autoRefresh && (
                        <span
                            style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)',
                                marginLeft: 4,
                            }}
                        >
                            • Auto-refresh on
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="btn-ghost btn"
                        style={{ 
                            padding: '0.35rem 0.8rem', 
                            fontSize: '0.8rem',
                            backgroundColor: autoRefresh ? 'var(--brand-green)' : 'transparent',
                            color: autoRefresh ? 'white' : 'var(--text-secondary)'
                        }}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        {autoRefresh ? 'Auto' : 'Manual'}
                    </button>
                    <button
                        id="refresh-feed"
                        className="btn-ghost btn"
                        style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => load(true)}
                        disabled={refreshing}
                    >
                        <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : undefined }} />
                        {refreshing ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <span
                        style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            marginLeft: 4,
                        }}
                    >
                        {lastRefresh.toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })}
                    </span>
                </div>
            </div>

            {/* Feed */}
            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1, 2, 3, 4].map(i => <FeedCardSkeleton key={i} />)}
                </div>
            ) : filtered.length === 0 ? (
                <div
                    style={{
                        textAlign: 'center',
                        padding: '48px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 12,
                    }}
                >
                    <Heart size={40} style={{ color: 'var(--border)' }} />
                    <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        No stories match your filters
                    </p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                        Try lowering the positivity filter or selecting fewer categories.
                    </p>
                    <button
                        className="btn btn-primary"
                        onClick={() => { onPositivityFilterChange(70); onCategoriesChange([]) }}
                        style={{ marginTop: 4 }}
                    >
                        Reset filters
                    </button>
                </div>
            ) : (
                <>
                    <AnimatePresence mode="popLayout">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {shown.map((item, idx) => (
                                <FeedCard
                                    key={item.id}
                                    item={item}
                                    index={idx}
                                    isBookmarked={bookmarks.includes(item.id)}
                                    onBookmark={() => onToggleBookmark(item.id)}
                                    onDeepDive={handleDeepDive}
                                    lang={lang}
                                />
                            ))}
                        </div>
                    </AnimatePresence>

                    {hasMore && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={{ textAlign: 'center', marginTop: 20 }}
                        >
                            <button
                                id="load-more-btn"
                                className="btn btn-ghost"
                                onClick={() => setVisible(v => v + 15)}
                                style={{ width: '100%', maxWidth: 260 }}
                            >
                                Load more stories
                            </button>
                        </motion.div>
                    )}
                </>
            )}

            {/* AI Deep Dive Modal */}
            <AnimatePresence>
                {deepDiveItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0,0,0,0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 100,
                            padding: 16,
                        }}
                        onClick={closeDeepDive}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            style={{
                                backgroundColor: 'var(--bg)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 24,
                                maxWidth: 480,
                                width: '100%',
                                maxHeight: '80vh',
                                overflow: 'auto',
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Sparkles size={20} style={{ color: 'var(--brand-green)' }} />
                                    <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                                        {lang === 'sw' ? 'Kwa Nini Hii Itakufurahisha' : 'Why This Will Make Your Day'}
                                    </h3>
                                </div>
                                <button onClick={closeDeepDive} className="btn-icon">
                                    <X size={18} />
                                </button>
                            </div>
                            
                            <h4 style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
                                {deepDiveItem.title}
                            </h4>
                            
                            {deepDiveLoading ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', padding: 16 }}>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>{lang === 'sw' ? 'Inazalisha maelezo...' : 'Generating explanation...'}</span>
                                </div>
                            ) : (
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    {deepDiveExplanation}
                                </p>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
