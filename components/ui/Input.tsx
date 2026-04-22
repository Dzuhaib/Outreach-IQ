'use client'

import { cn } from '@/lib/utils'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium text-text-2 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-1 placeholder-text-3',
          'focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20',
          'transition-colors duration-150',
          error && 'border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-text-3">{hint}</p>}
    </div>
  )
}
