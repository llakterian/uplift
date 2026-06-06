import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, Heart, Sparkles, X, Loader2 } from 'lucide-react'
import FeedCard from '../components/FeedCard'
import FeedCardSkeleton from '../components/FeedCardSkeleton'
import ImageLightbox from '../components/ImageLightbox'
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
    searchQuery?: string
}

export default function FeedPage({
    positivityFilter,
    onPositivityFilterChange,
    selectedCategories,
    onCategoriesChange,
    bookmarks,
    onToggleBookmark,
    lang,
    searchQuery = '',
}: FeedPageProps) {
    const [allFeed, setAllFeed] = useState<FeedItem[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [visible, setVisible] = useState(20)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [intro, setIntro] = useState<string>('')
    const [deepDiveItem, setDeepDiveItem] = useState<FeedItem | null>(null)
    const [deepDiveExplanation, setDeepDiveExplanation] = useState<string>('')
    const [deepDiveLoading, setDeepDiveLoading] = useState(false)
    const [lightboxImage, setLightboxImage] = useState<string | null>(null)
    const intervalRef = useRef<number | null>(null)

    const load = useCallback(async (refresh = false) => {
        if (refresh) {
            setRefreshing(true)
            try {
                const data = await fetchFeed(lang)
                setAllFeed(data)
            } finally {
                setRefreshing(false)
            }
        } else {
            setLoading(true)
            try {
                const data = await fetchFeed(lang)
                setAllFeed(data)
                setVisible(20)
                const digest = await fetchDailyDigest(lang)
                if (digest.intro) setIntro(digest.intro)
            } finally {
                setLoading(false)
            }
        }
    }, [lang])

    useEffect(() => {
        if (autoRefresh) {
            intervalRef.current = setInterval(() => load(true), 60000) // Auto-refresh every 60 seconds
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current)
        }
    }, [autoRefresh, load])

    useEffect(() => { load() }, [load])

    const filtered = allFeed.filter(item => {
        const passesScore = item.positivityScore >= positivityFilter / 10
        const passesCategory = selectedCategories.length === 0 || selectedCategories.includes(item.category)
        const passesSearch = searchQuery === '' || 
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.sourceName.toLowerCase().includes(searchQuery.toLowerCase())
        return passesScore && passesCategory && passesSearch
    })

    const shown = filtered.slice(0, visible)
    const hasMore = visible < filtered.length

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
            setDeepDiveExplanation(lang === 'sw' ? 'Samahani, siwezi kutoa maelezo sasa.' : 'Sorry, I could not generate an explanation right now.')
        } finally {
            setDeepDiveLoading(false)
        }
    }

    return (
        <div>
            {/* X-style Feed Header */}
            <div className="x-feed-header">
                <div className="x-feed-title">
                    <h1>{lang === 'sw' ? 'Nyumbani' : 'Home'}</h1>
                </div>
                <div className="x-feed-stats">
                    {loading ? (
                        <span className="x-loading">Loading...</span>
                    ) : (
                        <span>{filtered.length} stories</span>
                    )}
                    <button
                        id="refresh-feed"
                        className="x-refresh-btn"
                        onClick={() => load(true)}
                        disabled={refreshing}
                        title={refreshing ? 'Refreshing...' : 'Refresh'}
                    >
                        <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Intro banner */}
            {intro && (
                <div className="px-4 py-3 border-b border-[var(--border)]" style={{ background: 'hsla(203, 89%, 53%, 0.05)' }}>
                    <p className="x-feed-intro">
                        <Sparkles size={12} className="text-[var(--brand-x)]" />
                        {intro.length > 120 ? intro.substring(0, 120) + '...' : intro}
                    </p>
                </div>
            )}

            {/* Compact filters */}
            <div className="x-filters">
                <CategoryFilter selected={selectedCategories} onChange={onCategoriesChange} />
                <div className="x-filter-right">
                    <PositivitySlider value={positivityFilter} onChange={onPositivityFilterChange} />
                    <button
                        className={`x-auto-btn ${autoRefresh ? 'active' : ''}`}
                        onClick={() => setAutoRefresh(!autoRefresh)}
                    >
                        {autoRefresh ? 'Auto' : 'Manual'}
                    </button>
                </div>
            </div>

            {/* Feed */}
            {loading ? (
                <div>
                    {[1, 2, 3, 4, 5].map(i => <FeedCardSkeleton key={i} />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="x-empty">
                    <Heart size={40} style={{ color: 'var(--text-muted)' }} />
                    <p>No stories match</p>
                    <p>Try lowering the positivity filter.</p>
                    <button onClick={() => { onPositivityFilterChange(70); onCategoriesChange([]) }} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '14px' }}>
                        Reset filters
                    </button>
                </div>
            ) : (
                <>
                    <div>
                        {shown.map((item, idx) => (
                            <FeedCard
                                key={item.id}
                                item={item}
                                index={idx}
                                isBookmarked={bookmarks.includes(item.id)}
                                onBookmark={() => onToggleBookmark(item.id)}
                                onDeepDive={handleDeepDive}
                                onImageClick={setLightboxImage}
                                lang={lang}
                            />
                        ))}
                    </div>

                    {hasMore && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="x-load-more"
                        >
                            <button
                                id="load-more-btn"
                                className="x-load-more-btn"
                                onClick={() => setVisible(v => v + 20)}
                            >
                                Show more
                            </button>
                        </motion.div>
                    )}
                </>
            )}

            {/* Refreshing indicator */}
            {refreshing && (
                <div className="x-refreshing">
                    <Loader2 size={14} className="spin" />
                    <span>Updating...</span>
                </div>
            )}

            {/* AI Deep Dive Modal */}
            <AnimatePresence>
                {deepDiveItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="x-modal-overlay"
                        onClick={() => setDeepDiveItem(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="x-modal"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="x-modal-header">
                                <div className="x-modal-title">
                                    <Sparkles size={18} style={{ color: 'var(--brand-x)' }} />
                                    <span>{lang === 'sw' ? 'Kwa Nini?' : 'Why This Might Interest You'}</span>
                                </div>
                                <button onClick={() => setDeepDiveItem(null)} className="x-close-btn">
                                    <X size={18} />
                                </button>
                            </div>
                            
                            <h4 className="x-modal-story-title">{deepDiveItem.title}</h4>
                            
                            {deepDiveLoading ? (
                                <div className="x-modal-loading">
                                    <Loader2 size={16} className="spin" />
                                    <span>{lang === 'sw' ? 'Inazalisha...' : 'Generating...'}</span>
                                </div>
                            ) : (
                                <p className="x-modal-content">{deepDiveExplanation}</p>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Image Lightbox */}
            {lightboxImage && (
                <ImageLightbox
                    src={lightboxImage}
                    alt="Image preview"
                    onClose={() => setLightboxImage(null)}
                />
            )}
        </div>
    )
}