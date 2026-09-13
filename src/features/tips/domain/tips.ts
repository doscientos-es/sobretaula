export type TipDistribution = {
  employeeId: string
  displayName: string
  minutes: number
  amountCents: number
}

export interface TipAuditEventDescriptionInput {
  eventType: 'daily_total_saved' | 'daily_total_updated' | 'period_closed'
  fromDate: string | null
  tipDate: string | null
  toDate: string | null
}

/** Gives each immutable tip event a concise, human-readable audit description. */
export function describeTipAuditEvent({
  eventType,
  fromDate,
  tipDate,
  toDate,
}: TipAuditEventDescriptionInput): string {
  if (eventType === 'period_closed') return `Cerró el período ${fromDate} — ${toDate}`
  if (eventType === 'daily_total_updated') return `Actualizó el cierre del día ${tipDate}`
  return `Registró el cierre del día ${tipDate}`
}

export function distributeTips(
  totalCents: number,
  rows: Array<Omit<TipDistribution, 'amountCents'>>,
): TipDistribution[] {
  const totalMinutes = rows.reduce((sum, row) => sum + row.minutes, 0)
  if (!totalMinutes) return rows.map((row) => ({ ...row, amountCents: 0 }))
  let assigned = 0
  return rows.map((row, index) => {
    const amountCents =
      index === rows.length - 1
        ? totalCents - assigned
        : Math.floor((totalCents * row.minutes) / totalMinutes)
    assigned += amountCents
    return { ...row, amountCents }
  })
}
