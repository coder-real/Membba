import { Link } from 'react-router-dom'

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

export default function AuthShell({ eyebrow, title, description, children, footer }) {
  return (
    <div className="min-h-screen bg-[var(--color-bg-app)] text-[var(--color-text-primary)] font-sans">
      <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] px-6 py-4">
        <Link to="/" className="inline-flex items-center gap-2">
          <img src="/green.svg" alt="Membba" className="h-7" />
          <span className="font-bold tracking-tight text-[var(--color-text-primary)]">Membba</span>
        </Link>
      </header>

      <main className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="ds-card p-8">
            <div className="mb-8">
              {eyebrow && (
                <div className="mb-5 inline-flex items-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-brand)]">
                  {eyebrow}
                </div>
              )}
              <h1 className="text-[24px] font-bold leading-8 tracking-[-0.02em] text-[var(--color-text-primary)]">{title}</h1>
              {description && <p className="mt-1 text-[14px] leading-5 text-[var(--color-text-secondary)]">{description}</p>}
            </div>
            {children}
          </div>
          {footer && <div className="mt-5 text-center text-[12px] text-[var(--color-text-muted)]">{footer}</div>}
        </div>
      </main>
    </div>
  )
}

export const authInputClass = 'input py-3 text-[14px]'
export const authLabelClass = 'mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'
