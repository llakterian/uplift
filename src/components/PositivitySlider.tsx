import { Sparkles } from 'lucide-react'

interface PositivitySliderProps {
  value: number
  onChange: (value: number) => void
}

const LABELS = [
  { threshold: 20, label: 'All News', desc: 'Including everything' },
  { threshold: 45, label: 'Balanced', desc: 'Mixed with positive lean' },
  { threshold: 70, label: 'Mostly Positive', desc: 'Good vibes only (mostly)' },
  { threshold: 90, label: 'Very Positive', desc: 'Handpicked good news' },
  { threshold: 101, label: 'Pure Uplift', desc: 'Maximum positivity' },
]

function getLabel(val: number) {
  return LABELS.find(l => val < l.threshold) ?? LABELS[LABELS.length - 1]
}

export default function PositivitySlider({ value, onChange }: PositivitySliderProps) {
  const lbl = getLabel(value)
  const pct = value

  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <Sparkles
            size={18}
            className="text-azure"
            style={{ flexShrink: 0 }}
          />
          <span
            className="font-display font-bold text-sm text-[var(--text-primary)]"
          >
            Positivity Filter
          </span>
        </div>

        {/* Current mode badge */}
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all duration-300"
          style={{
            background: `hsla(203, 100%, 50%, ${0.05 + (value / 100) * 0.1})`,
            borderColor: `hsla(203, 100%, 50%, ${0.1 + (value / 100) * 0.2})`,
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: 'var(--brand-azure)',
              boxShadow: value >= 70 ? '0 0 8px var(--brand-azure)' : 'none',
              animation: value >= 70 ? 'pulse-azure 2s infinite' : 'none'
            }}
          />
          <span className="text-[11px] font-bold text-azure uppercase tracking-wider">
            {lbl.label}
          </span>
        </div>
      </div>

      {/* Slider track container */}
      <div className="relative mb-3 group">
        {/* Gradient track background */}
        <div
          className="absolute inset-0 h-1.5 top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
          style={{
            background: `linear-gradient(to right, 
              var(--bg-muted) 0%, 
              var(--brand-azure) 50%, 
              var(--brand-cobalt) 100%)`
          }}
        />
        {/* Actual range input */}
        <input
          id="positivity-slider"
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="uplift-slider relative w-full"
          style={{ zIndex: 2 }}
        />
      </div>

      {/* Sub-labels row */}
      <div className="flex justify-between text-[11px] font-medium font-sans">
        <span className="text-[var(--text-muted)]">Minimum Positive Sentiment</span>
        <span className="text-azure font-bold leading-none">{pct}%</span>
      </div>

      <style>{`
        @keyframes pulse-azure {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
