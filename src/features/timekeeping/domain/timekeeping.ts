export const TIME_EVENT_TYPES = ['clock_in', 'break_start', 'break_end', 'clock_out'] as const
export type TimeEventType = (typeof TIME_EVENT_TYPES)[number]
export interface TimeEvent {
  eventType: TimeEventType
  occurredAt: string
}

export type EmploymentType = 'full_time' | 'part_time'

export interface TimekeepingLaborRules {
  /** Contractual target used to classify daily excess; it is not a legal limit by itself. */
  dailyTargetMinutes: number
  minimumBreakMinutes: number
  minimumDailyRestMinutes: number
  nightEndsAt: `${number}:${number}`
  nightStartsAt: `${number}:${number}`
}

export const DEFAULT_TIMEKEEPING_LABOR_RULES: TimekeepingLaborRules = {
  dailyTargetMinutes: 480,
  minimumBreakMinutes: 15,
  minimumDailyRestMinutes: 720,
  nightEndsAt: '06:00',
  nightStartsAt: '22:00',
}

export interface LaborDaySummary {
  date: string
  holidayMinutes: number
  nightMinutes: number
  workedMinutes: number
}

export interface TimekeepingLaborSummary {
  breakViolationCount: number
  complementaryMinutes: number
  days: readonly LaborDaySummary[]
  holidayMinutes: number
  nightMinutes: number
  overtimeMinutes: number
  restViolationCount: number
  splitShiftDays: number
  workedMinutes: number
}

interface WorkInterval {
  endsAt: number
  startsAt: number
}

interface Shift {
  breakMinutes: number
  endsAt: number
  startsAt: number
}
const next: Record<TimeEventType | 'none', TimeEventType[]> = {
  none: ['clock_in'],
  clock_in: ['break_start', 'clock_out'],
  break_start: ['break_end'],
  break_end: ['break_start', 'clock_out'],
  clock_out: ['clock_in'],
}
export function allowedNextEvent(last: TimeEventType | null): TimeEventType[] {
  return next[last ?? 'none']
}
export function workedMinutes(events: readonly TimeEvent[], now = new Date()): number {
  let total = 0
  let workStart: number | null = null
  for (const event of events) {
    const at = new Date(event.occurredAt).getTime()
    if (event.eventType === 'clock_in' || event.eventType === 'break_end') workStart = at
    if (
      (event.eventType === 'break_start' || event.eventType === 'clock_out') &&
      workStart !== null
    ) {
      total += Math.max(0, at - workStart)
      workStart = null
    }
  }
  if (workStart !== null) total += Math.max(0, now.getTime() - workStart)
  return Math.floor(total / 60000)
}

function minutesFromClock(value: `${number}:${number}`): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function localTimeParts(date: Date, timeZone: string): { date: string; minuteOfDay: number } {
  const values = new Map(
    new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      timeZone,
      year: 'numeric',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )
  const hours = Number(values.get('hour'))
  const minutes = Number(values.get('minute'))
  return {
    date: `${values.get('year')}-${values.get('month')}-${values.get('day')}`,
    minuteOfDay: hours * 60 + minutes,
  }
}

function isNightMinute(minuteOfDay: number, rules: TimekeepingLaborRules): boolean {
  const startsAt = minutesFromClock(rules.nightStartsAt)
  const endsAt = minutesFromClock(rules.nightEndsAt)
  return startsAt > endsAt
    ? minuteOfDay >= startsAt || minuteOfDay < endsAt
    : minuteOfDay >= startsAt && minuteOfDay < endsAt
}

function buildWorkIntervals(
  events: readonly TimeEvent[],
  now: Date,
): {
  intervals: WorkInterval[]
  shifts: Shift[]
} {
  const intervals: WorkInterval[] = []
  const shifts: Shift[] = []
  let breakStart: number | null = null
  let shiftStart: number | null = null
  let shiftBreakMinutes = 0
  let workStart: number | null = null
  for (const event of [...events].sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
  )) {
    const at = new Date(event.occurredAt).getTime()
    if (!Number.isFinite(at)) continue
    if (event.eventType === 'clock_in' && shiftStart === null) {
      shiftStart = at
      shiftBreakMinutes = 0
      workStart = at
    } else if (event.eventType === 'break_start' && workStart !== null) {
      if (at > workStart) intervals.push({ endsAt: at, startsAt: workStart })
      breakStart = at
      workStart = null
    } else if (event.eventType === 'break_end' && shiftStart !== null && workStart === null) {
      if (breakStart !== null && at > breakStart) shiftBreakMinutes += (at - breakStart) / 60_000
      breakStart = null
      workStart = at
    } else if (event.eventType === 'clock_out' && shiftStart !== null) {
      if (workStart !== null && at > workStart) intervals.push({ endsAt: at, startsAt: workStart })
      if (at > shiftStart)
        shifts.push({ breakMinutes: shiftBreakMinutes, endsAt: at, startsAt: shiftStart })
      breakStart = null
      shiftStart = null
      workStart = null
    }
  }
  if (shiftStart !== null) {
    const endsAt = now.getTime()
    if (workStart !== null && endsAt > workStart) intervals.push({ endsAt, startsAt: workStart })
    if (endsAt > shiftStart)
      shifts.push({ breakMinutes: shiftBreakMinutes, endsAt, startsAt: shiftStart })
  }
  return { intervals, shifts }
}

/**
 * Indicative Spanish-timekeeping summary. Agreements and local calendars supply
 * the configurable thresholds; this function only makes the recorded facts
 * explicit and must not be used as an automated payroll decision.
 */
export function summarizeLaborTime({
  employmentType,
  events,
  holidayDates = [],
  now = new Date(),
  rules = DEFAULT_TIMEKEEPING_LABOR_RULES,
  timeZone,
}: {
  employmentType: EmploymentType
  events: readonly TimeEvent[]
  holidayDates?: readonly string[]
  now?: Date
  rules?: TimekeepingLaborRules
  timeZone: string
}): TimekeepingLaborSummary {
  const { intervals, shifts } = buildWorkIntervals(events, now)
  const holidays = new Set(holidayDates)
  const days = new Map<string, LaborDaySummary>()
  const addMinute = (at: number, duration: number) => {
    const local = localTimeParts(new Date(at), timeZone)
    const day = days.get(local.date) ?? {
      date: local.date,
      holidayMinutes: 0,
      nightMinutes: 0,
      workedMinutes: 0,
    }
    day.workedMinutes += duration
    if (holidays.has(local.date)) day.holidayMinutes += duration
    if (isNightMinute(local.minuteOfDay, rules)) day.nightMinutes += duration
    days.set(local.date, day)
  }
  for (const interval of intervals) {
    for (let at = interval.startsAt; at < interval.endsAt;) {
      const next = Math.min(interval.endsAt, at - (at % 60_000) + 60_000)
      addMinute(at, (next - at) / 60_000)
      at = next
    }
  }
  const roundedDays = [...days.values()]
    .map((day) => ({
      ...day,
      holidayMinutes: Math.floor(day.holidayMinutes),
      nightMinutes: Math.floor(day.nightMinutes),
      workedMinutes: Math.floor(day.workedMinutes),
    }))
    .sort((left, right) => left.date.localeCompare(right.date))
  const excessMinutes = roundedDays.reduce(
    (total, day) => total + Math.max(0, day.workedMinutes - rules.dailyTargetMinutes),
    0,
  )
  const shiftDays = new Map<string, number>()
  for (const shift of shifts) {
    const { date } = localTimeParts(new Date(shift.startsAt), timeZone)
    shiftDays.set(date, (shiftDays.get(date) ?? 0) + 1)
  }
  return {
    breakViolationCount: shifts.filter(
      (shift) =>
        shift.endsAt - shift.startsAt > 360 * 60_000 &&
        shift.breakMinutes < rules.minimumBreakMinutes,
    ).length,
    complementaryMinutes: employmentType === 'part_time' ? excessMinutes : 0,
    days: roundedDays,
    holidayMinutes: roundedDays.reduce((total, day) => total + day.holidayMinutes, 0),
    nightMinutes: roundedDays.reduce((total, day) => total + day.nightMinutes, 0),
    overtimeMinutes: employmentType === 'full_time' ? excessMinutes : 0,
    restViolationCount: shifts.slice(1).filter((shift, index) => {
      const previous = shifts[index]
      return (
        previous !== undefined &&
        shift.startsAt - previous.endsAt < rules.minimumDailyRestMinutes * 60_000
      )
    }).length,
    splitShiftDays: [...shiftDays.values()].filter((count) => count > 1).length,
    workedMinutes: roundedDays.reduce((total, day) => total + day.workedMinutes, 0),
  }
}
