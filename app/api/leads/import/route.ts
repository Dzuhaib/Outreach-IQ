import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface CSVRow {
  businessname?: string
  businessName?: string
  business_name?: string
  name?: string
  websiteurl?: string
  websiteUrl?: string
  website_url?: string
  website?: string
  url?: string
  city?: string
  niche?: string
  industry?: string
  email?: string
  contactemail?: string
  contact_email?: string
}

function normalizeRow(row: CSVRow) {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const val = (row as Record<string, string | undefined>)[k] || (row as Record<string, string | undefined>)[k.toLowerCase()]
      if (val && val.trim()) return val.trim()
    }
    return null
  }

  return {
    businessName: get('businessName', 'businessname', 'business_name', 'name'),
    websiteUrl: get('websiteUrl', 'websiteurl', 'website_url', 'website', 'url'),
    city: get('city'),
    niche: get('niche', 'industry'),
    email: get('email', 'contactEmail', 'contactemail', 'contact_email'),
  }
}

/** Parse CSV text into rows of key-value objects */
function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  // Parse headers
  const headers = splitCSVLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, ''))

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVLine(lines[i])
    if (values.every((v) => !v.trim())) continue // skip empty rows
    const row: Record<string, string> = {}
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

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty or has no data rows' }, { status: 400 })
    }

    let created = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const norm = normalizeRow(rows[i] as CSVRow)
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
        errors.push(`Row ${i + 2}: failed to create lead for "${norm.businessName}"`)
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
