export default function WhatsAppModeBadge({
  mode = 'basic',
  size = 'sm',
  label = 'short',
  prefix = false,
  className = '',
}) {
  const isAdvanced = mode === 'advanced'
  const sizeClass = size === 'xs'
    ? 'px-2 py-0.5 text-[11px]'
    : 'px-2.5 py-1 text-[12px]'

  const toneClass = isAdvanced
    ? 'border-amber-500/20 bg-amber-500/10 text-amber-300 font-semibold'
    : 'border-blue-500/20 bg-blue-500/10 text-blue-300 font-semibold'

  const text = (() => {
    if (label === 'full') return isAdvanced ? 'Advanced group automation · Beta' : 'Basic access · Official WhatsApp'
    if (prefix) return isAdvanced ? 'WhatsApp advanced beta' : 'WhatsApp basic'
    return isAdvanced ? 'Advanced beta' : 'Basic access'
  })()

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border ${sizeClass} ${toneClass} ${className}`}>
      {text}
    </span>
  )
}
