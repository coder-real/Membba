import { useState } from 'react'

/**
 * Spinner — Discord-style spinning ring loader
 * size: 'sm' | 'md' | 'lg'
 * className: additional classes (e.g. for padding)  
 */
export default function Spinner({ size = 'md', className = '' }) {
  const dim = { sm: 20, md: 32, lg: 48 }[size] || 32
  const thickness = { sm: 2, md: 3, lg: 4 }[size] || 3

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div
        style={{
          width: dim,
          height: dim,
          borderRadius: '50%',
          border: `${thickness}px solid rgba(159,255,87,0.12)`,
          borderTopColor: '#9FFF57',
          animation: 'spin-ring 0.75s linear infinite',
        }}
      />
    </div>
  )
}
