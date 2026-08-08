export default function SuccessDialog({
  open,
  title,
  description,
  icon,
  primaryLabel = 'Done',
  secondaryLabel,
  onPrimary,
  onSecondary,
  onClose,
  children,
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/65 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0" onClick={onClose}>
      <div className="w-full max-w-md border border-gray-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#111]" onClick={e => e.stopPropagation()}>
        <div className="mb-5 flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#c8f135]/20 bg-[#c8f135]/10 text-[#c8f135]">
            {icon || '✓'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#c8f135]">Success</p>
            <h3 className="text-[18px] font-black text-gray-900 dark:text-white">{title}</h3>
            {description && <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-white/45">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white">✕</button>
        </div>
        {children && <div className="mb-5">{children}</div>}
        <div className="flex justify-end gap-2">
          {secondaryLabel && <button type="button" onClick={onSecondary} className="btn-secondary">{secondaryLabel}</button>}
          <button type="button" onClick={onPrimary || onClose} className="btn-primary">{primaryLabel}</button>
        </div>
      </div>
    </div>
  )
}
