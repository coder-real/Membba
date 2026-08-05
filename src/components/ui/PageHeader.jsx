export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            {eyebrow}
          </p>
        )}
        <h1 className="m-0 text-[var(--font-page-title-size)] font-[var(--font-page-title-weight)] leading-[var(--font-page-title-lh)] tracking-[-0.02em] text-[var(--color-text-primary)]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-[14px] leading-5 text-[var(--color-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  )
}
