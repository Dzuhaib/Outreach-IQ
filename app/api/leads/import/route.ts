import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/db'

type RawRow = Record<string, string | number | boolean | null | undefined>

/** Normalize a header key to lowercase no-spaces for fuzzy matching */
function normalizeKey(key: string): string {
  return String(key).toLowerCase().replace(/[\s_\-]+/g, '')
}

/** Pick the first matching value from a row by trying multiple key variants */
function pick(row: RawRow, ...candidates: string[]): string | null {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeKey(k), v]),
  )
  for (const candidate of candidates) {
    const val = normalized[normalizeKey(candidate)]
    if (val !== undefined && val !== null && String(val).trim()) {
      return String(val).trim()
    }
  }
  return null
}

function normalizeRow(row: RawRow) {
  return {
    businessName: pick(row, 'businessName', 'business_name', 'business', 'name', 'company'),
    websiteUrl: pick(row, 'websiteUrl', 'website_url', 'website', 'url', 'site'),
    city: pick(row, 'city', 'location', 'town'),
    niche: pick(row, 'niche', 'industry', 'category', 'sector'),
    email: pick(row, 'email', 'contactEmail', 'contact_email', 'emailAddress'),
  }
}

/** Parse CSV text into rows */
function parseCSV(text: string): RawRow[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = splitCSVLine(lines[0]).map((h) => h.trim())
  const rows: RawRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i])
    if (values.every((v) => !v.trim())) continue
    const row: RawRow = {}
    headers.forEach((h, idx) => { row[h] = values[idx]?.trim() || '' })
    rows.push(row)
  }
  return rows
}

function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

/** Parse XLSX/XLS buffer into rows */
function parseXLSX(buffer: ArrayBuffer): RawRow[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' })
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const name = file.name.toLowerCase()
    const isCSV = name.endsWith('.csv')
    const isXLSX = name.endsWith('.xlsx') || name.endsWith('.xls')

    if (!isCSV && !isXLSX) {
      return NextResponse.json({ error: 'File must be a CSV or Excel (.xlsx/.xls) file' }, { status: 400 })
    }

    let rows: RawRow[] = []

    if (isCSV) {
      const text = await file.text()
      rows = parseCSV(text)
    } else {
      const buffer = await file.arrayBuffer()
      rows = parseXLSX(buffer)
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File is empty or has no data rows' }, { status: 400 })
    }

    let created = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const norm = normalizeRow(rows[i])
      if (!norm.businessName) {
        errors.push(`Row ${i + 2}: missing business name`)
        continue
      }
      try {
        await prisma.lead.create({
          data: {
            businessName: norm.businessName,
            websiteUrl: norm.websiteUrl || null,
            city: norm.city || null,
            niche: norm.niche || null,
            email: norm.email || null,
            status: 'NEW',
          },
        })
        created++
      } catch {
        errors.push(`Row ${i + 2}: failed to save "${norm.businessName}"`)
      }
    }

    return NextResponse.json({ created, errors })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 },
    )
  }
}
