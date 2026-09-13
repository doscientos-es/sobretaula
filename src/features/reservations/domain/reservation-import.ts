export interface ReservationImportRow {
  email?: string
  guestName: string
  guestPhone?: string
  partySize: number
  serviceName: string
  startsAt: string
}

export interface ReservationImportError {
  message: string
  row: number
}

export interface ReservationImportPreview {
  errors: ReservationImportError[]
  rows: ReservationImportRow[]
}

function parseLine(line: string, delimiter: string): string[] {
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

export function previewReservationCsv(csv: string): ReservationImportPreview {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
  if (!lines.length) return { errors: [{ message: 'empty_file', row: 1 }], rows: [] }
  const delimiter = (lines[0] ?? '').includes(';') ? ';' : ','
  const headers = parseLine(lines[0] ?? '', delimiter).map((header) => header.toLowerCase())
  const required = ['turno', 'fecha_hora', 'comensales']
  const missing = required.filter((header) => !headers.includes(header))
  if (missing.length)
    return { errors: [{ message: `missing_columns:${missing.join(',')}`, row: 1 }], rows: [] }
  const index = (header: string) => headers.indexOf(header)
  const rows: ReservationImportRow[] = []
  const errors: ReservationImportError[] = []
  for (const [offset, line] of lines.slice(1).entries()) {
    const row = offset + 2
    const values = parseLine(line, delimiter)
    const serviceName = values[index('turno')]?.trim()
    const guestName = values[index('nombre')]?.trim() || 'Sin nombre'
    const startsAt = values[index('fecha_hora')]?.trim()
    const partySize = Number(values[index('comensales')])
    if (
      !serviceName ||
      !startsAt ||
      !Number.isInteger(partySize) ||
      partySize < 1 ||
      partySize > 50
    )
      errors.push({ message: 'service_datetime_and_party_size_required', row })
    else if (Number.isNaN(new Date(startsAt).getTime()))
      errors.push({ message: 'datetime_invalid', row })
    else {
      const email = headers.includes('email') ? values[index('email')]?.trim() : undefined
      const guestPhone = headers.includes('telefono')
        ? values[index('telefono')]?.trim()
        : undefined
      rows.push({
        ...(email ? { email } : {}),
        guestName,
        ...(guestPhone ? { guestPhone } : {}),
        partySize,
        serviceName,
        startsAt: new Date(startsAt).toISOString(),
      })
    }
  }
  return { errors, rows }
}
