import type { LucideIcon } from 'lucide-react'
import { FlaskConical, Users, Heart, Zap, PawPrint, Laptop } from 'lucide-react'
import { CATEGORIES } from '../types'

interface CategoryFilterProps {
  selected: string[]
  onChange: (categories: string[]) => void
}

const ICONS: Record<string, LucideIcon> = {
  science: FlaskConical,
  community: Users,
  health: Heart,
  inspiration: Zap,
  animals: PawPrint,
  tech: Laptop,
}

export default function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(c => c !== id) : [...selected, id])
  }

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'nowrap',
        overflowX: 'auto',
        paddingBottom: 4,
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      } as React.CSSProperties}
    >
      {/* "All" chip */}
      <button
        id="category-all"
        onClick={() => onChange([])}
        className={`chip${selected.length === 0 ? ' active' : ''}`}
        style={{ flexShrink: 0 }}
      >
        All
      </button>

      {CATEGORIES.map(cat => {
        const Icon = ICONS[cat.id]
        const isActive = selected.includes(cat.id)
        return (
          <button
            key={cat.id}
            id={`category-${cat.id}`}
            onClick={() => toggle(cat.id)}
            className={`chip${isActive ? ' active' : ''}`}
            style={{ flexShrink: 0 }}
          >
            {Icon && <Icon size={13} />}
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}
