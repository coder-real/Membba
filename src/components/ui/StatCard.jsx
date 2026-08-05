import Card from './Card'

const borderTone = {
  neutral: 'border-t-[var(--color-border-default)]',
  warning: 'border-t-[var(--color-warning)]',
  danger: 'border-t-[var(--color-danger)]',
  success: 'border-t-[var(--color-success)]',
}

export default function StatCard({ label, value, description, tone = 'neutral', loading = false }) {
  return (
    <Card className={`border-t-2 p-5 ${borderTone[tone] || borderTone.neutral}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{label}</p>
      {loading ? (
        <div className="mt-3 h-8 w-24 animate-pulse rounded bg-[var(--color-bg-elevated)]" />
      ) : (
        <p className="mt-2 text-[32px] font-bold leading-9 text-[var(--color-text-primary)]">{value}</p>
      )}
      {description && <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">{description}</p>}
    </Card>
  )
}
