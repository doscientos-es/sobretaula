export interface GuestExportRow {
  createdAt: string
  email: string | null
  id: string
  marketingConsent: boolean
  name: string
  phone: string | null
}

function csvCell(value: string | number | boolean | null | undefined): string {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * Builds the operational contact export. Internal notes, allergies and
 * preferences are deliberately excluded from this owner/manager export.
 */
export function buildGuestContactsCsv(
  rows: readonly GuestExportRow[],
  options: { exportedAt?: string; timezone?: string } = {},
): string {
  const exportedAt = options.exportedAt ?? new Date().toISOString()
  const timezone = options.timezone ?? 'Europe/Madrid'
  const header = [
    'schema_version',
    'exportado_en',
    'zona_horaria',
    'id',
    'nombre',
    'email',
    'telefono',
    'consentimiento_marketing',
    'creado_en',
  ]
  const body = rows.map((row) =>
    [
      '1',
      exportedAt,
      timezone,
      row.id,
      row.name,
      row.email,
      row.phone,
      row.marketingConsent,
      row.createdAt,
    ]
      .map(csvCell)
      .join(','),
  )
  return `\uFEFF${header.join(',')}\n${body.join('\n')}`
}
