import { motion } from 'framer-motion'
import { Creator } from '../types'
import { TrendingUp, BadgeCheck } from 'lucide-react'

interface LeaderboardCardProps {
  creator: Creator
  rank: number
}

export default function LeaderboardCard({ creator, rank }: LeaderboardCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="x-card flex items-center gap-3 relative"
      style={{ padding: '16px' }}
    >
      <div className="w-6 text-center font-bold text-[var(--text-muted)] text-sm">
        {rank}
      </div>

      <div className="w-12 h-12 rounded-full overflow-hidden bg-[var(--bg-muted)] flex-shrink-0" style={{ border: '1px solid var(--border)' }}>
        {creator.avatar_url ? (
          <img src={creator.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] font-bold text-lg">
            {creator.name.charAt(0)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1 min-w-0">
          <div className="font-bold text-[var(--text-primary)] text-[15px] truncate hover:underline cursor-pointer">
            {creator.name}
          </div>
          {creator.is_verified && <BadgeCheck size={16} className="text-azure flex-shrink-0" />}
        </div>
        <div className="text-[14px] text-[var(--text-muted)] truncate">@{creator.x_handle}</div>
      </div>

      <div className="flex flex-col items-end">
        <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
          <TrendingUp size={12} className="text-green-500" />
          Score
        </div>
        <div className="font-black text-[var(--text-primary)] text-xl leading-none">
          {creator.reciprocity_score}
        </div>
      </div>
    </motion.div>
  )
}
