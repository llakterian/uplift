import { motion } from 'framer-motion'
import { Heart, ExternalLink, Clock, Share2, Sparkles } from 'lucide-react'
import { FeedItem } from '../types'
import { saveBookmarkData, removeBookmarkData } from '../services/api'
import { sanitizeHtml } from '../utils/security'

interface FeedCardProps {
  item: FeedItem
  isBookmarked: boolean
  onBookmark: () => void
  onDeepDive?: (item: FeedItem) => void
  index?: number
  lang?: 'en' | 'sw'
}

function getTimeAgo(dateString: string, lang: 'en' | 'sw' = 'en'): string {
  const ms = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)
  
  if (lang === 'sw') {
    if (mins < 1) return 'Sasa hivi'
    if (mins < 60) return `${mins}dakika zilizopita`
    if (hours < 24) return `${hours}saa zilizopita`
    return `${days}siku zilizopita`
  }
  
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function ScoreBadge({ score, lang }: { score: number; lang: 'en' | 'sw' }) {
  const isHigh = score >= 9
  const isMid = score >= 6
  const cls = isHigh ? 'badge-azure shadow-[0_0_8px_hsla(203,100%,50%,0.3)]' : isMid ? 'badge-gray border-azure/30' : 'badge-gray'
  return (
    <span className={`badge ${cls}`}>
      {score}/10
    </span>
  )
}

function SourceBadge({ source, sourceName, icon }: { source: string; sourceName: string; icon?: string }) {
  const colors: Record<string, string> = {
    reddit: '#ff4500',
    devto: '#0a0a0a',
    rss: '#f97316',
    mastodon: '#6364ff',
  }
  return (
    <span
      className="badge flex items-center gap-1.5"
      style={{
        background: `${colors[source] ?? '#888'}1a`,
        color: colors[source] ?? 'var(--text-secondary)',
        fontWeight: 600,
      }}
    >
      {icon && (
        <img
          src={icon}
          alt=""
          style={{ width: 14, height: 14, borderRadius: 2, flexShrink: 0 }}
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
      {sourceName}
    </span>
  )
}

export default function FeedCard({ item, isBookmarked, onBookmark, onDeepDive, index = 0, lang = 'en' }: FeedCardProps) {
  const handleBookmark = () => {
    if (isBookmarked) {
      removeBookmarkData(item.id)
    } else {
      saveBookmarkData(item.id, item)
    }
    onBookmark()
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: sanitizeHtml(item.title, 200), url: item.sourceUrl })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(item.sourceUrl)
    }
  }

  // Sanitize all user-controlled content
  const safeTitle = sanitizeHtml(item.title, 200)
  const safeContent = sanitizeHtml(item.content, 500)
  const safeAuthor = sanitizeHtml(item.author, 100)
  const safeSourceName = sanitizeHtml(item.sourceName, 100)

  return (
    <motion.article
      className="card"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      style={{ overflow: 'hidden' }}
    >
      {/* Thumbnail */}
      {item.thumbnail && (
        <div style={{ padding: '12px 12px 0' }}>
          <img
            src={item.thumbnail}
            alt={safeTitle}
            loading="lazy"
            className="thumbnail"
          />
        </div>
      )}

      <div style={{ padding: '14px 16px 14px' }}>
        {/* Top row: source badge + score + bookmark */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <SourceBadge source={item.source} sourceName={safeSourceName} icon={item.sourceIcon} />
            <ScoreBadge score={item.positivityScore} lang={lang} />
          </div>
          <button
            id={`bookmark-${item.id}`}
            onClick={handleBookmark}
            className="btn-icon flex-shrink-0"
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this story'}
          >
            <Heart
              size={18}
              strokeWidth={2}
              fill={isBookmarked ? 'currentColor' : 'none'}
              style={{ color: isBookmarked ? '#ef4444' : 'var(--text-muted)' }}
            />
          </button>
        </div>

        {/* Title */}
        <h2
          className="mb-2 line-clamp-2"
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            lineHeight: 1.35,
          }}
        >
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'none' }}
            className="hover:text-brand transition-colors"
          >
            {safeTitle}
          </a>
        </h2>

        {/* Content excerpt */}
        {safeContent && (
          <p
            className="line-clamp-2 mb-3"
            style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}
          >
            {safeContent}
          </p>
        )}

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {item.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="badge badge-gray"
                style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.72rem' }}
              >
                #{sanitizeHtml(tag, 50)}
              </span>
            ))}
          </div>
        )}

        {/* Deep dive button */}
        {onDeepDive && (
          <button
            onClick={() => onDeepDive(item)}
            className="btn btn-ghost"
            style={{ 
              marginBottom: '12px', 
              padding: '0.3rem 0.75rem', 
              fontSize: '0.75rem',
              gap: '0.3rem',
              color: 'var(--brand-green)'
            }}
          >
            <Sparkles size={11} />
            {lang === 'sw' ? 'Nini hii itakufurahisha?' : 'Why this will make my day?'}
          </button>
        )}

        {/* Footer: author, time, share, read more */}
        <div
          className="flex items-center justify-between pt-2"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center gap-3"
            style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}
          >
            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {safeAuthor}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {getTimeAgo(item.publishedAt, lang)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              id={`share-${item.id}`}
              onClick={handleShare}
              className="btn-icon"
              title="Share"
              aria-label="Share this story"
            >
              <Share2 size={14} style={{ color: 'var(--text-muted)' }} />
            </button>
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', gap: '0.3rem' }}
            >
              {lang === 'sw' ? 'Soma' : 'Read'}
              <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>
    </motion.article >
  )
}