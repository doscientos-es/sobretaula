export function zonedLocalToIso(localDateTime: string, timeZone: string): string {
  const naive = new Date(`${localDateTime}:00Z`)
  if (Number.isNaN(naive.getTime())) throw new Error('invalid_local_datetime')
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(naive)
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  )
  const zonedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour) % 24,
    Number(values.minute),
    Number(values.second),
  )
  return new Date(naive.getTime() - (zonedAsUtc - naive.getTime())).toISOString()
}

function localDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).format(date)
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export interface ZonedWeekBounds {
  dayEndIso: string
  dayStartIso: string
  weekEndIso: string
  weekStartIso: string
}

/** Returns UTC boundaries for the current local day and Monday-based week. */
export function getZonedWeekBounds(now: Date, timeZone: string): ZonedWeekBounds {
  const localToday = new Date(`${localDateKey(now, timeZone)}T00:00:00.000Z`)
  const daysSinceMonday = (localToday.getUTCDay() + 6) % 7
  const localWeekStart = new Date(localToday)
  localWeekStart.setUTCDate(localWeekStart.getUTCDate() - daysSinceMonday)
  const localTomorrow = new Date(localToday)
  localTomorrow.setUTCDate(localTomorrow.getUTCDate() + 1)
  const localWeekEnd = new Date(localWeekStart)
  localWeekEnd.setUTCDate(localWeekEnd.getUTCDate() + 7)

  return {
    dayEndIso: zonedLocalToIso(`${formatDateOnly(localTomorrow)}T00:00`, timeZone),
    dayStartIso: zonedLocalToIso(`${formatDateOnly(localToday)}T00:00`, timeZone),
    weekEndIso: zonedLocalToIso(`${formatDateOnly(localWeekEnd)}T00:00`, timeZone),
    weekStartIso: zonedLocalToIso(`${formatDateOnly(localWeekStart)}T00:00`, timeZone),
  }
}
