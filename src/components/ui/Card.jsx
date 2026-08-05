export default function Card({ children, className = '', as: Tag = 'div' }) {
  return (
    <Tag className={`ds-card ${className}`}>
      {children}
    </Tag>
  )
}

export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] px-5 py-4 ${className}`}>
      <div className="min-w-0">
        {title && <h2 className="text-[16px] font-semibold leading-6 text-[var(--color-text-primary)]">{title}</h2>}
        {description && <p className="mt-0.5 text-[13px] leading-[18px] text-[var(--color-text-secondary)]">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function CardBody({ children, className = '' }) {
  return <div className={`p-5 ${className}`}>{children}</div>
}
