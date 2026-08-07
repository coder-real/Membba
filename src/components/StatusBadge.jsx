/**
 * StatusBadge — unified status indicator
 * status: 'active' | 'expired' | 'cancelled' | 'pending' | 'success' | 'failed'
 */
export default function StatusBadge({ status }) {
  const s = status?.toLowerCase()

  const styles = {
    active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    success:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    expired:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    pending:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
    cancelled: 'bg-white/5 text-white/50 border-white/10',
    failed:    'bg-rose-500/10 text-rose-400 border-rose-500/20',
  }

  const dotColor = {
    active:    '#34d399',
    success:   '#34d399',
    expired:   '#fbbf24',
    pending:   '#fbbf24',
    cancelled: 'rgba(255,255,255,0.4)',
    failed:    '#f87171',
  }

  const cls = styles[s] || styles.cancelled
  const dot = dotColor[s] || dotColor.cancelled
  const isActive = s === 'active' || s === 'success'

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cls}`}>
      <span
        className={isActive ? 'dot-pulse' : ''}
        style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: dot, display: 'inline-block', flexShrink: 0 }}
      />
      {status}
    </span>
  )
}
