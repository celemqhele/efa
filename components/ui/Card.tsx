import React from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
  variant?: 'surface' | 'elevated'
}

export function Card({ children, className = '', variant = 'surface' }: CardProps) {
  const baseStyles = 'border rounded-lg transition-colors duration-base'
  const variants = {
    surface: 'bg-bg-surface border-border',
    elevated: 'bg-bg-elevated border-border-subtle shadow-md',
  }

  return (
    <div className={`${baseStyles} ${variants[variant]} ${className}`}>
      {children}
    </div>
  )
}

