'use client'

import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

interface CSVImportProps {
  open: boolean
  onClose: () => void
  onImported: (count: number) => void
}

interface ImportResult {
  created: number
  errors: string[]
}

export function CSVImport({ open, onClose, onImported }: CSVImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    if (!f.name.endsWith('.csv')) {
      alert('Please select a CSV file')
      return
    }
    setFile(f)
    setResult(null)
  }

  async function handleImport() {
    if (!file) return
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/leads/import', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Import failed')
      setResult(data as ImportResult)
      onImported(data.created)
    } catch (err) {
      setResult({ created: 0, errors: [err instanceof Error ? err.message : 'Import failed'] })
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    setFile(null)
    setResult(null)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import from CSV" size="md">
      <div className="space-y-4">
        {/* Format hint */}
        <div className="bg-surface-2 border border-border rounded-md p-3">
          <p className="text-xs text-text-2 font-medium mb-1">Expected CSV columns:</p>
          <code className="text-xs text-accent">
            businessName, websiteUrl, city, niche, email
          </code>
          <p className="text-xs text-text-3 mt-1">Headers are case-insensitive. Only businessName is required.</p>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-border-2'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const f = e.dataTransfer.files[0]
            if (f) handleFile(f)
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          {file ? (
            <div className="flex items-center justify-center gap-2">
              <FileText className="w-5 h-5 text-accent" />
              <span className="text-sm text-text-1 font-medium">{file.name}</span>
            </div>
          ) : (
            <div>
              <Upload className="w-6 h-6 text-text-3 mx-auto mb-2" />
              <p className="text-sm text-text-2">Drop your CSV here or click to browse</p>
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="space-y-2">
            {result.created > 0 && (
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-md px-3 py-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span className="text-sm">Successfully imported {result.created} lead{result.created !== 1 ? 's' : ''}</span>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="bg-red-400/10 border border-red-400/20 rounded-md px-3 py-2">
                <div className="flex items-center gap-2 text-red-400 mb-1">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-medium">{result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</span>
                </div>
                <ul className="text-xs text-red-300 space-y-0.5">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 5 && <li>…and {result.errors.length - 5} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleClose}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleImport} loading={loading} disabled={!file}>
              Import
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
