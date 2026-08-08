export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null
  const toneClass = tone === 'danger'
    ? 'border-rose-500/25 bg-rose-500/10 text-rose-300 hover:bg-rose-500/15'
    : 'border-[#c8f135]/25 bg-[#c8f135] text-black hover:bg-[#d6ff4f]'

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/65 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0" onClick={() => !loading && onCancel?.()}>
      <div className="w-full max-w-md border border-gray-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#111]" onClick={e => e.stopPropagation()}>
        <div className="mb-5">
          <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">Please confirm</p>
          <h3 className="text-[18px] font-black text-gray-900 dark:text-white">{title}</h3>
          {description && <p className="mt-2 text-[13px] leading-relaxed text-gray-500 dark:text-white/45">{description}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary disabled:opacity-50">{cancelLabel}</button>
          <button type="button" onClick={onConfirm} disabled={loading} className={`inline-flex items-center justify-center border px-4 py-2 text-[13px] font-black transition disabled:opacity-50 ${toneClass}`}>
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
