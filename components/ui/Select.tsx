'use client'

import { cn } from '@/lib/utils'
import type { SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export function Select({ label, error, hint, options, placeholder, className, id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-medium text-text-2 uppercase tracking-wide">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-sm text-text-1',
          'focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20',
          'transition-colors duration-150 cursor-pointer',
          error && 'border-red-500/50',
          className,
        )}
        {...props}
      >
        {placeholder && (
          <option value="" className="bg-surface-2">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-surface-2">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-text-3">{hint}</p>}
    </div>
  )
}
