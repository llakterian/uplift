import { useState } from 'react'
import { Sparkles } from 'lucide-react'

interface PositivitySliderProps {
  value: number
  onChange: (value: number) => void
}

function PositivitySlider({ value, onChange }: PositivitySliderProps) {
  const getLabel = (val: number) => {
    if (val <= 30) return 'All News'
    if (val <= 50) return 'Balanced'
    if (val <= 70) return 'Mostly Positive'
    if (val <= 90) return 'Very Positive'
    return 'Pure Uplift'
  }

  const getColor = (val: number) => {
    if (val <= 30) return 'bg-gray-400'
    if (val <= 50) return 'bg-yellow-400'
    if (val <= 70) return 'bg-green-400'
    return 'bg-green-500'
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-green-500" />
          <span className="font-semibold text-gray-900 dark:text-white">Positivity Filter</span>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium text-white ${getColor(value)}`}>
          {getLabel(value)}
        </span>
      </div>
      
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-green-500"
      />
      
      <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span>All News</span>
        <span>Pure Uplift</span>
      </div>
    </div>
  )
}

export default PositivitySlider
