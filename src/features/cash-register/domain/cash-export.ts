export interface CashHistoryExportRow {
  closedAt: string | null
  countedCashCents: number | null
  openingFloatCents: number | null
  openedAt: string | null
  salesByMethod: Record<string, number>
  status: string
}

function csvCell(value: string | number | null | undefined): string {
  const text = String(value ?? '')
  return /[,"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function buildCashHistoryCsv(history: readonly CashHistoryExportRow[]): string {
  const paymentMethods = Array.from(
    new Set(history.flatMap((entry) => Object.keys(entry.salesByMethod))),
  ).sort()
  const header = [
    'apertura',
    'cierre',
    'fondo_inicial_cents',
    'efectivo_contado_cents',
    'estado',
    ...paymentMethods.map((method) => `ventas_${method}_cents`),
  ]
  const rows = history.map((entry) =>
    [
      entry.openedAt,
      entry.closedAt,
      entry.openingFloatCents,
      entry.countedCashCents,
      entry.status,
      ...paymentMethods.map((method) => entry.salesByMethod[method] ?? 0),
    ]
      .map(csvCell)
      .join(','),
  )
  return `\uFEFF${header.join(',')}\n${rows.join('\n')}`
}
