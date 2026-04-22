'use client'

import { CheckCircle, XCircle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export interface BulkProgress {
  type: 'analyze' | 'send'
  current: number
  total: number
  currentName: string
  done: boolean
  results: { name: string; ok: boolean; error?: string }[]
}

interface BulkProgressModalProps {
  progress: BulkProgress
  onClose: () => void
}

const TYPE_LABELS = {
  analyze: 'Analyzing websites',
  send: 'Generating & sending emails',
}

export function BulkProgressModal({ progress, onClose }: BulkProgressModalProps) {
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const succeeded = progress.results.filter((r) => r.ok).length
  const failed = progress.results.filter((r) => !r.ok).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-surface border border-border rounded-xl shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text-1">{TYPE_LABELS[progress.type]}</h2>
          {progress.done && (
            <button onClick={onClose} className="p-1 rounded hover:bg-surface-2 text-text-3 hover:text-text-1 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-text-2 mb-1.5">
              <span>
                {progress.done ? 'Completed' : `Processing ${progress.currentName || '…'}`}
              </span>
              <span>{progress.current} / {progress.total}</span>
            </div>
            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Spinner while running */}
          {!progress.done && (
            <div className="flex items-center gap-2 text-sm text-text-2">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>Please keep this tab open…</span>
            </div>
          )}

          {/* Results summary */}
          {progress.results.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {progress.results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs py-1">
                  {r.ok
                    ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    : <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  }
                  <span className={r.ok ? 'text-text-2' : 'text-red-400'}>
                    {r.name}{r.error ? ` — ${r.error}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Done summary */}
          {progress.done && (
            <div className="flex items-center gap-4 pt-1">
              <span className="text-xs text-emerald-400">{succeeded} succeeded</span>
              {failed > 0 && <span className="text-xs text-red-400">{failed} failed</span>}
            </div>
          )}
        </div>

        {progress.done && (
          <div className="px-5 pb-5">
            <Button className="w-full" onClick={onClose}>Done</Button>
          </div>
        )}
      </div>
    </div>
  )
}
