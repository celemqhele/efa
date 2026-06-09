import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  isLoading?: boolean
}

export function Button({ 
  className = '', 
  variant = 'primary', 
  isLoading, 
  children, 
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-md transition-all duration-fast disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variants = {
    primary: 'bg-accent-DEFAULT text-bg-surface hover:bg-accent-hover',
    secondary: 'bg-bg-elevated text-text-primary hover:bg-border-subtle',
    ghost: 'bg-transparent text-text-secondary hover:bg-bg-elevated',
    destructive: 'bg-feedback-error text-bg-surface hover:opacity-90',
  }

  const sizes = 'px-space-4 py-space-2 text-sm'

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </button>
  )
}

