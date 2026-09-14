export interface TipsExportRow {
  amountCents: number
  createdAt: string
  date: string
  id: string
  note: string | null
  paidAt: string | null
  recordedBy: string
}

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function buildTipsCsv(
  rows: readonly TipsExportRow[],
  options: { exportedAt?: string; timezone?: string } = {},
): string {
  const exportedAt = options.exportedAt ?? new Date().toISOString()
  const timezone = options.timezone ?? 'Europe/Madrid'
  const header = [
    'schema_version',
    'exportado_en',
    'zona_horaria',
    'id',
    'fecha',
    'importe_cents',
    'nota',
    'registrado_por',
    'creado_en',
    'pagado_en',
  ]
  const body = rows.map((row) =>
    [
      '1',
      exportedAt,
      timezone,
      row.id,
      row.date,
      row.amountCents,
      row.note,
      row.recordedBy,
      row.createdAt,
      row.paidAt,
    ]
      .map(csvCell)
      .join(','),
  )
  return `\uFEFF${header.join(',')}\n${body.join('\n')}`
}
