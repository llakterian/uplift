import { FlaskRound, Heart, Stethoscope, Flame, GraduationCap } from 'lucide-react'

interface CategoryFilterProps {
  selected: string[]
  onChange: (categories: string[]) => void
}

const CATEGORIES = [
  { id: 'science', label: 'Science', icon: FlaskRound },
  { id: 'community', label: 'Community', icon: Heart },
  { id: 'health', label: 'Health', icon: Stethoscope },
  { id: 'inspiration', label: 'Inspiration', icon: Flame },
  { id: 'animals', label: 'Animals', icon: GraduationCap },
]

function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const toggleCategory = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter(c => c !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm">
      <span className="font-semibold text-gray-900 dark:text-white mb-3 block">Categories</span>
      
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(category => {
          const Icon = category.icon
          const isSelected = selected.includes(category.id)
          
          return (
            <button
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all ${
                isSelected 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              {category.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default CategoryFilter
