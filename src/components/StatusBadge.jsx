/**
 * StatusBadge — unified status indicator
 * status: 'active' | 'expired' | 'cancelled' | 'pending' | 'success' | 'failed'
 */
export default function StatusBadge({ status }) {
  const s = status?.toLowerCase()

  const styles = {
    active:    'bg-[#9FFF57]/12 text-[#9FFF57] border-[#9FFF57]/20',
    success:   'bg-[#9FFF57]/12 text-[#9FFF57] border-[#9FFF57]/20',
    expired:   'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    pending:   'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    cancelled: 'bg-white/[0.05] text-black dark:text-white/40 border-gray-200 dark:border-white/10',
    failed:    'bg-red-500/10 text-red-400 border-red-500/20',
  }

  const dotColor = {
    active:    '#9FFF57',
    success:   '#9FFF57',
    expired:   '#FACC15',
    pending:   '#FACC15',
    cancelled: 'rgba(255,255,255,0.3)',
    failed:    '#f87171',
  }

  const cls = styles[s] || styles.cancelled
  const dot = dotColor[s] || dotColor.cancelled
  const isActive = s === 'active' || s === 'success'

  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${cls}`}>
      <span
        className={isActive ? 'dot-pulse' : ''}
        style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dot, display: 'inline-block', flexShrink: 0 }}
      />
      {status}
    </span>
  )
}
