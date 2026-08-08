import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

async function copyText(value) {
  const text = String(value || '')
  if (!text) return false
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  return ok
}

export function CopyIconButton({ value, label = 'Copy', className = '' }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    try {
      const ok = await copyText(value)
      if (!ok) return
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : label}
      title={copied ? 'Copied' : label}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center border border-gray-200 bg-white text-gray-500 transition hover:border-[#c8f135]/40 hover:text-[#c8f135] dark:border-white/10 dark:bg-black/20 dark:text-white/40 dark:hover:text-[#c8f135] ${className}`}
    >
      {copied ? <Check size={14} className="text-[#c8f135]" /> : <Copy size={14} />}
    </button>
  )
}

export default function CopyableField({ value, displayValue, label = 'Copy', className = '', textClassName = '' }) {
  return (
    <div className={`group relative flex min-w-0 items-center border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/[0.03] ${className}`}>
      <span className={`min-w-0 flex-1 truncate px-3 py-2 pr-10 font-mono text-[12px] text-gray-600 dark:text-white/45 ${textClassName}`} title={String(value || '')}>
        {displayValue || value || '—'}
      </span>
      <CopyIconButton value={value} label={label} className="absolute right-1 top-1/2 -translate-y-1/2 border-transparent bg-transparent" />
    </div>
  )
}
