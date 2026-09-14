export interface ReservationExportRow {
  createdAt: string
  email: string | null
  endsAt: string
  guestName: string | null
  guestPhone: string | null
  id: string
  partySize: number
  source: string
  startsAt: string
  status: string
}

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** Exports reservation facts without internal table assignments or public tokens. */
export function buildReservationsCsv(
  rows: readonly ReservationExportRow[],
  options: { exportedAt?: string; timezone?: string } = {},
): string {
  const header = [
    'schema_version',
    'exportado_en',
    'zona_horaria',
    'id',
    'nombre',
    'email',
    'telefono',
    'comensales',
    'inicio',
    'fin',
    'estado',
    'origen',
    'creado_en',
  ]
  const body = rows.map((row) =>
    [
      '1',
      options.exportedAt ?? new Date().toISOString(),
      options.timezone ?? 'Europe/Madrid',
      row.id,
      row.guestName,
      row.email,
      row.guestPhone,
      row.partySize,
      row.startsAt,
      row.endsAt,
      row.status,
      row.source,
      row.createdAt,
    ]
      .map(csvCell)
      .join(','),
  )
  return `\uFEFF${header.join(',')}\n${body.join('\n')}`
}
