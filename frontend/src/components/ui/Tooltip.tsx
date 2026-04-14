'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Info } from 'lucide-react'

type TooltipProps = {
  text: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  children?: React.ReactNode
  icon?: boolean
}

export function Tooltip({ text, position = 'top', children, icon = true }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const ref = useRef<HTMLDivElement>(null)

  function calcPosition() {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const GAP = 8
    switch (position) {
      case 'top':
        setCoords({ top: rect.top - GAP, left: rect.left + rect.width / 2 })
        break
      case 'bottom':
        setCoords({ top: rect.bottom + GAP, left: rect.left + rect.width / 2 })
        break
      case 'left':
        setCoords({ top: rect.top + rect.height / 2, left: rect.left - GAP })
        break
      case 'right':
        setCoords({ top: rect.top + rect.height / 2, left: rect.right + GAP })
        break
    }
  }

  const transformMap: Record<string, string> = {
    top:    'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left:   'translate(-100%, -50%)',
    right:  'translate(0, -50%)',
  }

  const tooltip = visible ? (
    <div
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        transform: transformMap[position],
        zIndex: 99999,
        pointerEvents: 'none',
      }}
      className="w-56 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl leading-relaxed"
    >
      {text}
    </div>
  ) : null

  return (
    <div
      ref={ref}
      className="relative inline-flex items-center"
      onMouseEnter={() => { calcPosition(); setVisible(true) }}
      onMouseLeave={() => setVisible(false)}
    >
      {children ?? (
        <span className="text-gray-400 hover:text-violet-500 transition-colors cursor-help">
          <Info className="w-3.5 h-3.5" />
        </span>
      )}
      {typeof document !== 'undefined' && tooltip
        ? createPortal(tooltip, document.body)
        : null}
    </div>
  )
}
