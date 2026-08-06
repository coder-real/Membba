const toneClass = {
  success: 'badge-active',
  active: 'badge-active',
  resolved: 'badge-resolved',
  warning: 'badge-open',
  open: 'badge-open',
  pending: 'badge-pending',
  danger: 'badge-failed',
  failed: 'badge-failed',
  cancelled: 'badge-cancelled',
  neutral: 'bg-[rgba(160,160,160,0.10)] text-[var(--color-text-secondary)]',
}

export default function Badge({ children, tone = 'neutral', className = '' }) {
  return <span className={`badge ${toneClass[tone] || toneClass.neutral} ${className}`}>{children}</span>
}
