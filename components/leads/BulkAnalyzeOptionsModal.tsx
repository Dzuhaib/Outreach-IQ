'use client'

import { useState } from 'react'
import { MessageCircle, Monitor, Search, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { AnalysisType } from '@/lib/types'

interface BulkAnalyzeOptionsModalProps {
  leadCount: number
  onStart: (types: AnalysisType[]) => void
  onClose: () => void
}

const OPTIONS: {
  type: AnalysisType
  icon: React.ElementType
  label: string
  description: string
  detail: string
}[] = [
  {
    type: 'chatbot',
    icon: MessageCircle,
    label: 'Chatbot Detection',
    description: 'Check if the website has a live chat or chatbot widget',
    detail: 'Detects Intercom, Drift, Zendesk, Crisp, Tidio, HubSpot, Tawk, and 8 other platforms. Fast — no AI call needed.',
  },
  {
    type: 'website',
    icon: Monitor,
    label: 'Website Issues',
    description: 'Audit design, speed, mobile responsiveness, and UX',
    detail: 'Checks mobile viewport, outdated design patterns, missing CTAs, performance signals, broken images, accessibility basics, and trust signals.',
  },
  {
    type: 'seo',
    icon: Search,
    label: 'SEO Analysis',
    description: 'Analyse headings, meta tags, schema, content depth, and keywords',
    detail: 'Parses title, meta description, H1-H3 structure, JSON-LD schema, canonical tag, image alt coverage, word count, and keyword relevance. Emails use a proposal approach — problems are never listed to the prospect.',
  },
]

export function BulkAnalyzeOptionsModal({ leadCount, onStart, onClose }: BulkAnalyzeOptionsModalProps) {
  const [selected, setSelected] = useState<Set<AnalysisType>>(
    new Set(['chatbot', 'website', 'seo']),
  )
  const [expanded, setExpanded] = useState<AnalysisType | null>(null)

  function toggle(type: AnalysisType) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size === 1) return prev // keep at least one
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-xl shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-sm font-semibold text-text-1">Choose What to Analyse</h2>
            <p className="text-xs text-text-3 mt-0.5">{leadCount} lead{leadCount !== 1 ? 's' : ''} selected</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-2 text-text-3 hover:text-text-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {OPTIONS.map(({ type, icon: Icon, label, description, detail }) => {
            const isSelected = selected.has(type)
            const isExpanded = expanded === type
            return (
              <div
                key={type}
                className={`rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-accent/40 bg-accent/5'
                    : 'border-border bg-surface-2'
                }`}
              >
                <div className="flex items-start gap-3 p-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggle(type)}
                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-accent border-accent'
                        : 'border-border-2 hover:border-accent/60'
                    }`}
                  >
                    {isSelected && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2 fill-white">
                        <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(type)}>
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-accent' : 'text-text-3'}`} />
                      <span className={`text-sm font-medium ${isSelected ? 'text-text-1' : 'text-text-2'}`}>
                        {label}
                      </span>
                    </div>
                    <p className="text-xs text-text-3 mt-0.5">{description}</p>
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : type)}
                    className="text-xs text-text-3 hover:text-text-2 transition-colors shrink-0 mt-0.5"
                  >
                    {isExpanded ? 'less' : 'details'}
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-0">
                    <p className="text-xs text-text-3 leading-relaxed border-t border-border pt-2">
                      {detail}
                    </p>
                  </div>
                )}
              </div>
            )
          })}

          <p className="text-xs text-text-3 pt-1">
            Each analysis type adds an AI call per lead. Selecting all three gives the most complete picture for email generation.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 px-5 pb-5">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            onClick={() => onStart([...selected])}
            disabled={selected.size === 0}
          >
            <Zap className="w-3.5 h-3.5" />
            Start Analysis
          </Button>
        </div>
      </div>
    </div>
  )
}
