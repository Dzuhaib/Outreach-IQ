'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Lead } from '@/lib/types'

interface AddLeadModalProps {
  open: boolean
  onClose: () => void
  onCreated: (lead: Lead) => void
}

interface FormState {
  businessName: string
  websiteUrl: string
  city: string
  niche: string
  email: string
}

const EMPTY: FormState = { businessName: '', websiteUrl: '', city: '', niche: '', email: '' }

export function AddLeadModal({ open, onClose, onCreated }: AddLeadModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  function validate(): boolean {
    const errs: Partial<FormState> = {}
    if (!form.businessName.trim()) errs.businessName = 'Business name is required'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Invalid email address'
    if (
      form.websiteUrl &&
      !/^https?:\/\/.+/.test(form.websiteUrl)
    )
      errs.websiteUrl = 'URL must start with http:// or https://'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setApiError('')
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create lead')
      onCreated(data)
      setForm(EMPTY)
      onClose()
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setForm(EMPTY)
    setErrors({})
    setApiError('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Add New Lead" description="Enter the business details for your new lead.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Business Name"
          placeholder="Acme Plumbing Co."
          value={form.businessName}
          onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
          error={errors.businessName}
          required
        />
        <Input
          label="Website URL"
          placeholder="https://acmeplumbing.com"
          value={form.websiteUrl}
          onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
          error={errors.websiteUrl}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="City"
            placeholder="Chicago"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
          />
          <Input
            label="Niche / Industry"
            placeholder="Plumbing"
            value={form.niche}
            onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
          />
        </div>
        <Input
          label="Contact Email"
          type="email"
          placeholder="owner@acmeplumbing.com"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          error={errors.email}
        />
        {apiError && (
          <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">
            {apiError}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Add Lead
          </Button>
        </div>
      </form>
    </Modal>
  )
}
