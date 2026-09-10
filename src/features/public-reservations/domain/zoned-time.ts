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
