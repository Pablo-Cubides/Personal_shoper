"use client"
 
import React from 'react'

interface BeforeAfterSliderProps {
  original: string;
  edited: string;
}

/**
 * Simple side-by-side comparison component
 * For advanced slider with orientation detection, use components/features/BeforeAfterSlider.tsx
 */
export default function BeforeAfterSlider({ original, edited }: BeforeAfterSliderProps) {
  return (
    <div className="w-full">
      {/* Labels at top */}
      <div className="flex justify-center gap-8 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Antes (Izquierda)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Después (Derecha)</span>
        </div>
      </div>
      
      {/* Images side by side */}
      <div className="flex gap-6 items-center justify-center">
        <div className="relative flex-shrink-0 max-w-[45%]">
          {/* Blue indicator for "Antes" */}
          <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg z-10"></div>
          <img 
            src={original} 
            alt="Antes" 
            className="w-full h-auto max-h-[75vh] object-contain rounded-xl shadow-2xl ring-2 ring-blue-500/20" 
          />
        </div>
        
        <div className="relative flex-shrink-0 max-w-[45%]">
          {/* Green indicator for "Después" */}
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-green-500 border-2 border-white shadow-lg z-10"></div>
          <img 
            src={edited} 
            alt="Después" 
            className="w-full h-auto max-h-[75vh] object-contain rounded-xl shadow-2xl ring-2 ring-green-500/20" 
          />
        </div>
      </div>
      
      {/* Hint text */}
      <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
        📸 Comparación lado a lado optimizada
      </p>
    </div>
  )
}