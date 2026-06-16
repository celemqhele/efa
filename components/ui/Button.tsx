import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  isLoading?: boolean
  as?: 'button' | 'a' | any
  href?: string
}

export function Button({ 
  className = '', 
  variant = 'primary', 
  isLoading, 
  as: Component = 'button',
  children, 
  ...props 
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-fast disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97]'
  
  const variants = {
    primary: 'bg-accent text-bg-surface shadow-[0_1px_0.375px_rgba(0,0,0,0.05),0_0.25px_0.375px_rgba(0,0,0,0.15)] hover:bg-accent-hover',
    secondary: 'bg-bg-elevated text-text-primary border border-border shadow-[0_0.5px_1px_rgba(0,0,0,0.06)] hover:bg-border-subtle',
    ghost: 'bg-transparent text-text-secondary hover:bg-bg-elevated',
    destructive: 'bg-feedback-error text-bg-surface shadow-[0_1px_0.375px_rgba(0,0,0,0.05),0_0.25px_0.375px_rgba(0,0,0,0.15)] hover:opacity-90',
  }

  const sizes = 'px-5 py-2.5 text-sm'

  return (
    <Component 
      className={`${baseStyles} ${variants[variant]} ${sizes} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? 'Loading...' : children}
    </Component>
  )
}

