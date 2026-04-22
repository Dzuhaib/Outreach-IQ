'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Check, AlertCircle, Eye, EyeOff, Mail, Wifi,
  LogIn, LogOut, Cpu, User,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { OPENAI_MODELS, DEFAULT_OPENAI_MODEL } from '@/lib/utils'
import type { Settings } from '@/lib/types'

interface SettingsForm {
  openaiKey: string
  openaiModel: string
  senderName: string
  signature: string
  followUpDay3: number
  followUpDay7: number
}

const DEFAULT_FORM: SettingsForm = {
  openaiKey: '',
  openaiModel: DEFAULT_OPENAI_MODEL,
  senderName: '',
  signature: '',
  followUpDay3: 3,
  followUpDay7: 7,
}

function SettingsContent() {
  const searchParams = useSearchParams()
  const [form, setForm] = useState<SettingsForm>(DEFAULT_FORM)
  const [gmailEmail, setGmailEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [oauthNotice, setOauthNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)

  // Handle OAuth callback params
  useEffect(() => {
    const connected = searchParams.get('connected')
    const oauthError = searchParams.get('error')
    if (connected === 'gmail') {
      setOauthNotice({ type: 'success', message: 'Gmail connected successfully!' })
      // Clean URL without reload
      window.history.replaceState({}, '', '/settings')
    } else if (oauthError) {
      setOauthNotice({ type: 'error', message: decodeURIComponent(oauthError) })
      window.history.replaceState({}, '', '/settings')
    }
  }, [searchParams])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings')
        if (res.ok) {
          const data: Settings = await res.json()
          setGmailEmail(data.googleEmail)
          setForm({
            openaiKey: data.openaiKey || '',
            openaiModel: data.openaiModel || DEFAULT_OPENAI_MODEL,
            senderName: data.senderName || '',
            signature: data.signature || '',
            followUpDay3: data.followUpDay3,
            followUpDay7: data.followUpDay7,
          })
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save settings')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleTestGmail() {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/test-gmail', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setTestResult({ ok: true, message: `Connected and working as ${data.email}` })
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : 'Verification failed' })
    } finally {
      setTesting(false)
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/auth/google/disconnect', { method: 'POST' })
      if (res.ok) setGmailEmail(null)
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) return <PageLoader text="Loading settings…" />

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-1 tracking-tight">Settings</h1>
          <p className="text-sm text-text-2 mt-1">Configure your AI and Gmail credentials</p>
        </div>
        <div className="flex items-center gap-3">
          {gmailEmail && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg">
              <User className="w-3.5 h-3.5 text-text-3" />
              <span className="text-xs text-text-2">{gmailEmail}</span>
            </div>
          )}
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-2 hover:text-text-1 bg-surface border border-border rounded-lg hover:border-border-hover transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </form>
        </div>
      </div>

      {/* OAuth notice banner */}
      {oauthNotice && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border mb-6 text-sm ${
            oauthNotice.type === 'success'
              ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
              : 'text-red-400 bg-red-400/10 border-red-400/20'
          }`}
        >
          {oauthNotice.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {oauthNotice.message}
          <button
            className="ml-auto text-xs opacity-60 hover:opacity-100"
            onClick={() => setOauthNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Gmail Connection */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="w-4 h-4 text-text-2" />
            <h2 className="text-sm font-semibold text-text-1">Gmail Account</h2>
          </div>
          <p className="text-xs text-text-3 mb-5">
            Emails are sent via your Gmail account using Google OAuth — no password stored.
          </p>

          {gmailEmail ? (
            <div className="space-y-3">
              {/* Connected state */}
              <div className="flex items-center gap-3 px-4 py-3 bg-emerald-400/5 border border-emerald-400/20 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-emerald-400/20 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-1">Connected</p>
                  <p className="text-xs text-emerald-400">{gmailEmail}</p>
                </div>
              </div>

              {testResult && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm ${
                    testResult.ok
                      ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
                      : 'text-red-400 bg-red-400/10 border-red-400/20'
                  }`}
                >
                  {testResult.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                  {testResult.message}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={handleTestGmail} loading={testing}>
                  <Wifi className="w-3.5 h-3.5" />
                  Verify Connection
                </Button>
                <Button type="button" variant="danger" size="sm" onClick={handleDisconnect} loading={disconnecting}>
                  <LogOut className="w-3.5 h-3.5" />
                  Disconnect Gmail
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Not connected state */}
              <div className="flex items-center gap-3 px-4 py-3 bg-surface-2 border border-border rounded-lg">
                <div className="w-8 h-8 rounded-full bg-surface-3 border border-border flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-text-3" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-1">No account connected</p>
                  <p className="text-xs text-text-3 mt-0.5">Sign in with Google to start sending emails from your Gmail address.</p>
                </div>
              </div>

              <a href="/api/auth/google">
                <Button type="button" className="w-full">
                  <LogIn className="w-4 h-4" />
                  Connect Gmail Account
                </Button>
              </a>
            </div>
          )}
        </section>

        {/* OpenAI Configuration */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="w-4 h-4 text-text-2" />
            <h2 className="text-sm font-semibold text-text-1">OpenAI Configuration</h2>
          </div>
          <p className="text-xs text-text-3 mb-5">Used for website analysis and email generation.</p>

          <div className="space-y-4">
            <div className="relative">
              <Input
                label="OpenAI API Key"
                type={showApiKey ? 'text' : 'password'}
                placeholder="sk-..."
                value={form.openaiKey}
                onChange={(e) => setForm((f) => ({ ...f, openaiKey: e.target.value }))}
                hint="Get your API key at platform.openai.com/api-keys"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-[34px] text-text-3 hover:text-text-1 transition-colors"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Select
              label="Model"
              value={form.openaiModel}
              onChange={(e) => setForm((f) => ({ ...f, openaiModel: e.target.value }))}
              options={OPENAI_MODELS}
              hint="GPT-4o is recommended for best email quality. GPT-4o Mini is 10× cheaper."
            />
          </div>
        </section>

        {/* Sender Identity */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-1 mb-4">Sender Identity</h2>
          <div className="space-y-4">
            <Input
              label="Your Name"
              placeholder="John Smith"
              value={form.senderName}
              onChange={(e) => setForm((f) => ({ ...f, senderName: e.target.value }))}
              hint="Displayed in the From field of outgoing emails"
            />
            <Textarea
              label="Email Signature"
              placeholder={`John Smith\nWeb Developer\njohn@example.com\n+1 555 0123`}
              value={form.signature}
              onChange={(e) => setForm((f) => ({ ...f, signature: e.target.value }))}
              rows={4}
              hint="Appended to all generated emails"
            />
          </div>
        </section>

        {/* Follow-up Timing */}
        <section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text-1 mb-4">Follow-up Timing</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First Follow-up (days)"
              type="number"
              min={1}
              max={30}
              value={form.followUpDay3}
              onChange={(e) => setForm((f) => ({ ...f, followUpDay3: Number(e.target.value) }))}
              hint="Days after initial email"
            />
            <Input
              label="Second Follow-up (days)"
              type="number"
              min={1}
              max={60}
              value={form.followUpDay7}
              onChange={(e) => setForm((f) => ({ ...f, followUpDay7: Number(e.target.value) }))}
              hint="Days after initial email"
            />
          </div>
        </section>

        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" loading={saving}>
            Save Settings
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-400 animate-fade-in">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageLoader text="Loading settings…" />}>
      <SettingsContent />
    </Suspense>
  )
}
