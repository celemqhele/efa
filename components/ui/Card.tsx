import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  variant?: 'surface' | 'elevated'
  id?: string
  style?: React.CSSProperties
}

export function Card({ children, className = '', variant = 'surface', id, style }: CardProps) {
  const baseStyles = 'border rounded-lg transition-colors duration-base'
  const variants = {
    surface: 'bg-bg-surface border-border',
    elevated: 'bg-bg-elevated border-border-subtle shadow-md',
  }

  return (
    <div id={id} style={style} className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </div>
  )
}

