import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Custom floating Select component inspired by Notion/Linear UI.
 *
 * Props:
 *   value       – current value (string | number)
 *   onChange    – (value) => void
 *   options     – [{ value, label, icon? }]
 *   placeholder – string shown when nothing selected
 *   disabled    – bool
 *   className   – extra classes on the trigger button
 */
export default function Select({ value, onChange, options = [], placeholder = 'Select…', disabled = false, className = '' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Calculate dropdown position when opened
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const dropdownHeight = 256 // max-h-64 = 256px
      const hasSpaceBelow = viewportHeight - rect.bottom > dropdownHeight + 20

      setPosition({
        top: hasSpaceBelow ? rect.bottom + 6 : rect.top - dropdownHeight - 6,
        left: rect.left,
        width: rect.width,
      })
    }
  }, [open])

  const selected = options.find(o => String(o.value) === String(value))

  const handleSelect = (opt) => {
    onChange(opt.value)
    setOpen(false)
  }

  const menuContent = (
    <div
      ref={menuRef}
      className="
        fixed z-50
        bg-white dark:bg-[#141414] border border-gray-200 dark:border-white/[0.1] rounded-2xl
        shadow-[0_18px_55px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.6)] overflow-hidden
      "
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        animation: 'selectIn 0.12s ease-out',
      }}
    >
      <div className="p-1.5 max-h-64 overflow-y-auto scrollbar-thin">
        {options.map((opt) => {
          const isSelected = String(opt.value) === String(value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt)}
              className={`
                w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
                text-[13.5px] text-left transition-colors duration-100 group
                ${isSelected
                  ? 'bg-gray-100 dark:bg-white/[0.08] text-black dark:text-white font-semibold'
                  : 'text-gray-600 dark:text-white/65 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/[0.055]'
                }
              `}
            >
              {opt.icon && (
                <span className={`flex-shrink-0 transition-colors ${isSelected ? 'text-black dark:text-white' : 'text-black dark:text-white/35 group-hover:text-black dark:text-white/60'}`}>
                  {opt.icon}
                </span>
              )}
              <span className="flex-1 truncate">{opt.label}</span>
              {isSelected && (
                <svg className="w-3.5 h-3.5 text-[#c8f135] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
      <style>{`
        @keyframes selectIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  )

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={`
          w-full flex items-center justify-between gap-3
          bg-white dark:bg-[#0d0d0d] border rounded-xl px-4 py-3
          text-[14px] text-left transition-all duration-150 outline-none
          ${disabled
            ? 'border-gray-200 dark:border-white/10 text-black dark:text-white/25 cursor-not-allowed'
            : open
              ? 'border-white/25 text-black dark:text-white ring-1 ring-white/10'
              : 'border-white/[0.1] text-black dark:text-white hover:border-white/20'
          }
        `}
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {selected?.icon && <span className="text-black dark:text-white/50 flex-shrink-0">{selected.icon}</span>}
          <span className="truncate">{selected ? selected.label : <span className="text-black dark:text-white/30">{placeholder}</span>}</span>
        </span>
        {/* Chevron */}
        <svg
          className={`flex-shrink-0 w-4 h-4 text-black dark:text-white/30 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown menu — rendered via Portal */}
      {open && createPortal(menuContent, document.body)}

      <style>{`
        @keyframes selectIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  )
}
