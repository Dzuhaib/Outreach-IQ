'use client'

import { useState } from 'react'
import { RefreshCw, Send, Check, Edit3 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { formatDateTime } from '@/lib/utils'
import type { EmailRecord, EmailType } from '@/lib/types'

interface EmailEditorProps {
  leadId: string
  leadEmail: string | null
  emailRecord: EmailRecord
  type: EmailType
  onRegenerate: (type: EmailType) => Promise<void>
  onSave: (emailId: string, subject: string, body: string) => Promise<void>
  onSend: (emailId: string) => Promise<void>
  generatingType: EmailType | null
  sendingId: string | null
}

export function EmailEditor({
  leadId,
  leadEmail,
  emailRecord,
  type,
  onRegenerate,
  onSave,
  onSend,
  generatingType,
  sendingId,
}: EmailEditorProps) {
  const [editing, setEditing] = useState(false)
  const [subject, setSubject] = useState(emailRecord.subject)
  const [body, setBody] = useState(emailRecord.body)
  const [saving, setSaving] = useState(false)

  const isSent = !!emailRecord.sentAt
  const isGenerating = generatingType === type
  const isSending = sendingId === emailRecord.id

  const TYPE_LABELS: Record<EmailType, string> = {
    INITIAL: 'Initial Email',
    FOLLOW_UP_3: 'Day 3 Follow-up',
    FOLLOW_UP_7: 'Day 7 Follow-up',
  }

  async function handleSave() {
    setSaving(true)
    try {
      await onSave(emailRecord.id, subject, body)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-text-1">{TYPE_LABELS[type]}</span>
          {isSent && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <Check className="w-3 h-3" />
              Sent {formatDateTime(emailRecord.sentAt!)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isSent && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRegenerate(type)}
                loading={isGenerating}
                title="Regenerate email"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </Button>
              {!editing && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => onSend(emailRecord.id)}
                loading={isSending}
                disabled={!leadEmail}
                title={!leadEmail ? 'No email address for this lead' : undefined}
              >
                <Send className="w-3.5 h-3.5" />
                Send
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Email content */}
      <div className="p-4 space-y-3">
        {!leadEmail && !isSent && (
          <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-md px-3 py-2">
            No email address set for this lead. Add one to enable sending.
          </p>
        )}

        {editing ? (
          <div className="space-y-3">
            <Input
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            <Textarea
              label="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="font-mono text-xs leading-relaxed"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSubject(emailRecord.subject)
                  setBody(emailRecord.body)
                  setEditing(false)
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} loading={saving}>
                Save Changes
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-3 uppercase tracking-wide mb-1">Subject</p>
              <p className="text-sm text-text-1 font-medium">{emailRecord.subject}</p>
            </div>
            <div>
              <p className="text-xs text-text-3 uppercase tracking-wide mb-1">Body</p>
              <pre className="text-sm text-text-2 whitespace-pre-wrap font-sans leading-relaxed">
                {emailRecord.body}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
