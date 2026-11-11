import { useState } from 'react'
import { motion } from 'framer-motion'
import { Heart, ExternalLink, Share2, Sparkles, Bookmark } from 'lucide-react'
import { FeedItem } from '../types'
import { saveBookmarkData, removeBookmarkData } from '../services/api'
import { sanitizeHtml } from '../utils/security'
import AnimatedCounter from './ui/AnimatedCounter'

interface FeedCardProps {
  item: FeedItem
  isBookmarked: boolean
  onBookmark: () => void
  onDeepDive?: (item: FeedItem) => void
  onImageClick?: (url: string) => void
  index?: number
  lang?: 'en' | 'sw'
  featured?: boolean
}

function getTimeAgo(dateString: string, lang: 'en' | 'sw' = 'en'): string {
  const ms = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(ms / 60000)
  const hours = Math.floor(ms / 3600000)
  const days = Math.floor(ms / 86400000)

  if (lang === 'sw') {
    if (mins < 1) return 'Sasa'
    if (mins < 60) return `${mins}m`
    if (hours < 24) return `${hours}h`
    return `${days}d`
  }

  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  if (hours < 24) return `${hours}h`
  return `${days}d`
}

export default function FeedCard({ item, isBookmarked, onBookmark, onDeepDive, onImageClick, index = 0, lang = 'en', featured = false }: FeedCardProps) {
  const [liked, setLiked] = useState(false)
  const [heartBurst, setHeartBurst] = useState(false)
  const baseLikeCount = Math.abs(item.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 97) + 3
  const [likeCount, setLikeCount] = useState(baseLikeCount)

  const handleLike = (e: React.MouseEvent) => {
    e.preventDefault()
    setLiked(!liked)
    setLikeCount(c => liked ? c - 1 : c + 1)
    if (!liked) {
      setHeartBurst(true)
      setTimeout(() => setHeartBurst(false), 400)
    }
  }

  const handleBookmarkClick = () => {
    if (isBookmarked) {
      removeBookmarkData(item.id)
    } else {
      saveBookmarkData(item.id, item)
    }
    onBookmark()
  }

  const handleShare = async () => {
    const shareUrl = item.sourceUrl
    const shareTitle = item.title
    const shareDesc = item.content?.substring(0, 200) || 'Check out this uplifting story on Uplift!'

    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareDesc, url: shareUrl })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(`${shareTitle}\n\n${shareUrl}`)
    }
  }

  const safeTitle = sanitizeHtml(item.title, 300)
  const safeContent = sanitizeHtml(item.content, 200)
  const safeSourceName = sanitizeHtml(item.sourceName, 50)
  const hasImage = !!item.thumbnail

  return (
    <motion.article
      className={`mag-card ${featured ? 'mag-card-featured' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4), type: 'spring', stiffness: 260, damping: 26 }}
    >
      {hasImage && (
        <div className="mag-card-image" onClick={() => onImageClick?.(item.thumbnail!)}>
          <img
            src={`/api/image-proxy?url=${encodeURIComponent(item.thumbnail!)}&w=640`}
            srcSet={`/api/image-proxy?url=${encodeURIComponent(item.thumbnail!)}&w=320 320w, /api/image-proxy?url=${encodeURIComponent(item.thumbnail!)}&w=640 640w, /api/image-proxy?url=${encodeURIComponent(item.thumbnail!)}&w=960 960w`}
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw"
            alt=""
            loading={featured ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={featured ? 'high' : 'auto'}
          />
          <span className="mag-card-category">{item.category}</span>
        </div>
      )}
      <div className="mag-card-body">
        <div className="mag-card-meta">
          {item.sourceIcon && <img src={item.sourceIcon} alt="" className="mag-card-source-icon" />}
          <span className="mag-card-source">{safeSourceName}</span>
          <span className="mag-card-dot" />
          <span className="mag-card-time">{getTimeAgo(item.publishedAt, lang)}</span>
        </div>
        <h2 className="mag-card-title">
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{safeTitle}</a>
        </h2>
        {safeContent && <p className="mag-card-excerpt">{safeContent}</p>}
        <div className="mag-card-actions">
          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="mag-action" title="Open original">
            <ExternalLink size={15} />
          </a>
          <button onClick={handleShare} className="mag-action mag-action-green" title="Share">
            <Share2 size={15} />
          </button>
          {onDeepDive && (
            <button onClick={() => onDeepDive(item)} className="mag-action" title="Why this?">
              <Sparkles size={15} />
            </button>
          )}
          <button onClick={handleLike} className={`mag-action mag-action-pink ${liked ? 'is-liked' : ''}`} title="Like">
            <Heart size={15} fill={liked ? '#e11d48' : 'none'} color={liked ? '#e11d48' : 'currentColor'} className={heartBurst ? 'heart-burst' : ''} />
            <AnimatedCounter value={likeCount} className="text-[12px]" />
          </button>
          <button onClick={handleBookmarkClick} className={`mag-action ${isBookmarked ? 'is-bookmarked' : ''}`} title="Bookmark">
            <Bookmark size={15} fill={isBookmarked ? 'var(--brand-x)' : 'none'} />
          </button>
        </div>
      </div>
    </motion.article>
  )
}