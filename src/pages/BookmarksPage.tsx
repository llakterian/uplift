import { useState, useEffect } from 'react'
import { Bookmark } from 'lucide-react'
import FeedCard from '../components/FeedCard'
import { fetchBookmarkedItems, removeBookmarkData } from '../services/api'
import { FeedItem } from '../types'

interface BookmarksPageProps {
    bookmarks: string[]
    onToggleBookmark: (id: string) => void
}

export default function BookmarksPage({ bookmarks, onToggleBookmark }: BookmarksPageProps) {
    const [items, setItems] = useState<FeedItem[]>([])

    useEffect(() => {
        fetchBookmarkedItems(bookmarks).then(setItems)
    }, [bookmarks])

    if (bookmarks.length === 0) {
        return (
            <div
                style={{
                    textAlign: 'center',
                    padding: '64px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 16,
                }}
            >
                <div
                    style={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        background: 'var(--bg-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Bookmark size={32} style={{ color: 'var(--text-muted)' }} />
                </div>
                <h2
                    style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: '1.25rem',
                        color: 'var(--text-primary)',
                    }}
                >
                    No saved stories yet
                </h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 280, lineHeight: 1.6 }}>
                    Tap the heart icon on any story to save it here for later reading.
                </p>
            </div>
        )
    }

    return (
        <div>
            <div style={{ padding: '20px 0 16px' }}>
                <h1
                    style={{
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontWeight: 800,
                        fontSize: '1.5rem',
                        color: 'var(--text-primary)',
                        marginBottom: 4,
                    }}
                >
                    Saved Stories
                </h1>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {bookmarks.length} {bookmarks.length === 1 ? 'story' : 'stories'} saved
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {items.map((item, idx) => (
                    <FeedCard
                        key={item.id}
                        item={item}
                        index={idx}
                        isBookmarked
                        onBookmark={() => {
                            removeBookmarkData(item.id)
                            onToggleBookmark(item.id)
                        }}
                    />
                ))}
            </div>
        </div>
    )
}
