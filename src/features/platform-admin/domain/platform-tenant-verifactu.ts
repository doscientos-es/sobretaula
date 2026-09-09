export interface TenantVerifactuHealthInput {
  certificateConfigured: boolean
  certificateExpiresAt: string | null
  environment: 'test' | 'prod' | null
  fiscalConfigured: boolean
  invoiceSeriesCount: number
  outboxErrorCount: number
}

export interface TenantVerifactuHealth {
  items: { label: string; ok: boolean }[]
  ready: boolean
}

/** Summarises only operational prerequisites; production remains blocked in the MVP. */
export function getTenantVerifactuHealth(
  input: TenantVerifactuHealthInput,
  now = new Date(),
): TenantVerifactuHealth {
  const production = input.environment === 'prod'
  const certificateValid =
    input.certificateConfigured &&
    input.certificateExpiresAt !== null &&
    new Date(input.certificateExpiresAt).getTime() > now.getTime()
  const items = [
    { label: 'Identidad fiscal configurada', ok: input.fiscalConfigured },
    { label: 'Serie de facturación configurada', ok: input.invoiceSeriesCount > 0 },
    { label: 'Sin errores terminales de envío', ok: input.outboxErrorCount === 0 },
    ...(production
      ? [
          { label: 'Certificado válido', ok: certificateValid },
          { label: 'Producción habilitada', ok: false },
        ]
      : [{ label: 'Entorno de pruebas seleccionado', ok: input.environment === 'test' }]),
  ]
  return { items, ready: items.every((item) => item.ok) }
}
