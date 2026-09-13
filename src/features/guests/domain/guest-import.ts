export interface GuestImportRow {
  email?: string
  fullName: string
  marketingConsent: boolean
  phone?: string
}

export interface GuestImportError {
  message: string
  row: number
}

export interface GuestImportPreview {
  errors: GuestImportError[]
  rows: GuestImportRow[]
}

function cells(line: string, delimiter: string): string[] {
  const result: string[] = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') quoted = !quoted
    else if (character === delimiter && !quoted) {
      result.push(value.trim())
      value = ''
    } else value += character
  }
  result.push(value.trim())
  return result
}

export function previewGuestCsv(csv: string): GuestImportPreview {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
  if (!lines.length) return { errors: [{ message: 'empty_file', row: 1 }], rows: [] }
  const delimiter = (lines[0] ?? '').includes(';') ? ';' : ','
  const headers = cells(lines[0] ?? '', delimiter).map((header) => header.toLowerCase())
  const nameIndex = headers.indexOf('nombre')
  if (nameIndex < 0) return { errors: [{ message: 'missing_columns:nombre', row: 1 }], rows: [] }
  const rows: GuestImportRow[] = []
  const errors: GuestImportError[] = []
  for (const [offset, line] of lines.slice(1).entries()) {
    const row = offset + 2
    const values = cells(line, delimiter)
    const fullName = values[nameIndex]?.trim()
    const email = headers.includes('email') ? values[headers.indexOf('email')]?.trim() : undefined
    const phone = headers.includes('telefono')
      ? values[headers.indexOf('telefono')]?.trim()
      : undefined
    if (!fullName) errors.push({ message: 'name_required', row })
    else if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push({ message: 'email_invalid', row })
    else {
      const consent = values[headers.indexOf('consentimiento_marketing')]?.toLowerCase()
      rows.push({
        ...(email ? { email } : {}),
        fullName,
        marketingConsent: consent === 'si' || consent === 'sí' || consent === 'true',
        ...(phone ? { phone } : {}),
      })
    }
  }
  return { errors, rows }
}
