import { zonedDateTimeParts } from '@/shared/lib/date/zoned-time'

export type CalendarTimedItem = { startsAt: string }

export function weekDays(value: string): Date[] {
  const monday = new Date(`${value}T12:00:00.000Z`)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday)
    day.setUTCDate(day.getUTCDate() + index)
    return day
  })
}

export function calendarHours<T extends CalendarTimedItem>(
  agenda: Record<string, T[]>,
  timeZone: string,
) {
  const minutes = Object.values(agenda)
    .flat()
    .map((item) => {
      const { hour, minute } = zonedDateTimeParts(new Date(item.startsAt), timeZone)
      return hour * 60 + minute
    })
  const earliestHour = minutes.length ? Math.floor(Math.min(...minutes) / 60) : 11
  const latestHour = minutes.length ? Math.ceil(Math.max(...minutes) / 60) + 1 : 23
  return {
    end: Math.min(24, Math.max(23, latestHour)),
    start: Math.max(8, Math.min(11, earliestHour)),
  }
}

export function calendarTop(hour: number, minute: number, startHour: number, rowHeight = 72) {
  return ((hour * 60 + minute - startHour * 60) / 60) * rowHeight
}

export function calendarSlotFromY(
  y: number,
  startHour: number,
  hourCount: number,
  intervalMinutes = 15,
  rowHeight = 72,
) {
  const minutes = Math.max(
    0,
    Math.min(
      hourCount * 60,
      Math.round(((y / rowHeight) * 60) / intervalMinutes) * intervalMinutes,
    ),
  )
  return { hour: startHour + Math.floor(minutes / 60), minute: minutes % 60 }
}
