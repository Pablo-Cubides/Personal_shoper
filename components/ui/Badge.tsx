"use client"

import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  className?: string
}

export function Badge({ children, variant = 'secondary', className = '' }: BadgeProps) {
  const variantStyles = {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    success: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    danger: 'bg-red-500/10 text-red-500 border border-red-500/20'
  }
  
  return (
    <span className={`badge ${variantStyles[variant]} ${className}`}>
      {children}
    </span>
  )
}
