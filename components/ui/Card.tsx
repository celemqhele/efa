import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  variant?: 'surface' | 'elevated'
  id?: string
  style?: React.CSSProperties
}

export function Card({ children, className = '', variant = 'surface', id, style }: CardProps) {
  const baseStyles = 'border rounded-2xl transition-colors duration-base'
  const variants = {
    surface: 'bg-bg-surface border-border shadow-[0_0.5px_1px_rgba(0,0,0,0.06)]',
    elevated: 'bg-bg-elevated border-border-subtle shadow-[0_2px_8px_rgba(0,0,0,0.08)]',
  }

  return (
    <div id={id} style={style} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </div>
  )
}

