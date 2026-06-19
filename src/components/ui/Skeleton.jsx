export default function Skeleton({ className = '', width = 'w-full', height = 'h-4', count = 1 }) {
  const skeletons = Array.from({ length: count })

  return (
    <div className="space-y-2">
      {skeletons.map((_, i) => (
        <div
          key={i}
          className={`
            bg-white/[0.05] rounded-lg animate-pulse
            ${width} ${height} ${className}
          `}
        />
      ))}
    </div>
  )
}

