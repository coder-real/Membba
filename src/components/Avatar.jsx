/**
 * Avatar — initials circle with letter-based color
 * name: string — used for initial + color hash
 * size: number — diameter in px (default 28)
 */
const COLORS = [
  { bg: 'rgba(159,255,87,0.15)',  border: 'rgba(159,255,87,0.3)',  text: '#9FFF57' },
  { bg: 'rgba(87,196,255,0.15)', border: 'rgba(87,196,255,0.3)',  text: '#57C4FF' },
  { bg: 'rgba(255,107,157,0.15)',border: 'rgba(255,107,157,0.3)', text: '#FF6B9D' },
  { bg: 'rgba(255,179,71,0.15)', border: 'rgba(255,179,71,0.3)',  text: '#FFB347' },
  { bg: 'rgba(179,157,255,0.15)',border: 'rgba(179,157,255,0.3)', text: '#B39DFF' },
  { bg: 'rgba(72,207,173,0.15)', border: 'rgba(72,207,173,0.3)',  text: '#48CFAD' },
]

export default function Avatar({ name, size = 28 }) {
  const str = name || '?'
  const idx = str.charCodeAt(0) % COLORS.length
  const { bg, border, text } = COLORS[idx]
  const initial = str[0].toUpperCase()
  const fontSize = Math.max(9, Math.floor(size * 0.38))

  return (
    <div
      style={{
        width: size, height: size,
        backgroundColor: bg,
        border: `1.5px solid ${border}`,
        color: text,
        fontSize,
        borderRadius: '50%',
        flexShrink: 0,
      }}
      className="flex items-center justify-center font-bold select-none"
      aria-label={str}
    >
      {initial}
    </div>
  )
}
