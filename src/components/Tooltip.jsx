import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function Tooltip({ content, side = 'top' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef(null)

  useEffect(() => {
    if (!open || !buttonRef.current) return

    const update = () => {
      const rect = buttonRef.current.getBoundingClientRect()
      const gap = 10
      setPos({
        left: rect.left + rect.width / 2,
        top: side === 'bottom' ? rect.bottom + gap : rect.top - gap,
      })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, side])

  const tooltip = open ? createPortal(
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: side === 'bottom' ? 'translateX(-50%)' : 'translate(-50%, -100%)',
        zIndex: 9999,
      }}
      className="pointer-events-none w-[min(280px,calc(100vw-32px))] rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-left text-[12px] font-medium leading-relaxed text-gray-600 shadow-2xl dark:border-white/10 dark:bg-[#181818] dark:text-white/65"
    >
      {content}
    </div>,
    document.body
  ) : null

  return (
    <span className="inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Help"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] font-black text-gray-400 transition hover:border-[#c8f135]/60 hover:text-[#c8f135] dark:border-white/15 dark:text-white/35"
      >
        ?
      </button>
      {tooltip}
    </span>
  )
}
