import { Creator } from '../types'
import { BadgeCheck } from 'lucide-react'

interface CreatorCardProps {
  creator: Creator
}

export default function CreatorCard({ creator }: CreatorCardProps) {
  return (
    <div className="x-card" style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <div 
        className="w-10 h-10 rounded-full overflow-hidden bg-[var(--bg-muted)] flex-shrink-0"
        style={{ border: '1px solid var(--border)' }}
      >
        {creator.avatar_url ? (
          <img src={creator.avatar_url} alt={creator.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] font-bold text-lg">
            {creator.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <h3 className="font-bold text-[var(--text-primary)] truncate text-sm hover:underline cursor-pointer">
              {creator.name}
            </h3>
            {creator.is_verified && <BadgeCheck size={14} className="text-azure flex-shrink-0" />}
          </div>
          <button className="bg-black dark:bg-white text-white dark:text-black font-bold text-[13px] px-4 py-1.5 rounded-full hover:opacity-90 transition-opacity">
            Follow
          </button>
        </div>
        
        <a 
          href={`https://x.com/${creator.x_handle}`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[var(--text-muted)] text-[13px] hover:text-azure transition-colors truncate block mb-1.5"
        >
          @{creator.x_handle}
        </a>
        
        {creator.bio && (
          <p className="text-[13px] text-[var(--text-primary)] line-clamp-2 leading-relaxed mb-2" style={{ wordBreak: 'break-word' }}>
            {creator.bio}
          </p>
        )}
        
        <div className="flex items-center gap-3 text-[12px] text-[var(--text-muted)] mt-1">
          <div className="flex gap-1 items-center">
            <span className="font-bold text-[var(--text-primary)]">{creator.reciprocity_score}</span>
            <span>Score</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {creator.categories.slice(0, 2).map(cat => (
              <span key={cat} className="text-[11px] bg-[var(--bg-muted)] px-1.5 py-0.5 rounded text-[var(--text-secondary)]">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
