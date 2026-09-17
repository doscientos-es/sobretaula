export interface WorkforceShift {
  employeeId: string
  startsAt: string
  endsAt: string
  status: 'draft' | 'published' | 'confirmed' | 'cancelled'
}

export function buildWeeklyShiftPeriods({
  endsAt,
  referenceDate,
  startsAt,
  weekdays,
}: {
  endsAt: string
  referenceDate: string
  startsAt: string
  weekdays: readonly number[]
}): Array<{ endsAt: string; startsAt: string }> {
  const dateParts = referenceDate.split('-').map(Number)
  const startParts = startsAt.split(':').map(Number)
  const endParts = endsAt.split(':').map(Number)
  if (
    dateParts.length !== 3 ||
    dateParts.some((part) => !Number.isInteger(part)) ||
    startParts.length < 2 ||
    endParts.length < 2 ||
    startParts.some((part) => !Number.isInteger(part)) ||
    endParts.some((part) => !Number.isInteger(part))
  )
    return []
  const [year = 0, month = 0, day = 0] = dateParts
  const reference = new Date(year, month - 1, day)
  if (
    reference.getFullYear() !== year ||
    reference.getMonth() !== month - 1 ||
    reference.getDate() !== day
  )
    return []
  const [startHour = 0, startMinute = 0] = startParts
  const [endHour = 0, endMinute = 0] = endParts
  const startMinutes = startHour * 60 + startMinute
  const endMinutes = endHour * 60 + endMinute
  if (startMinutes < 0 || startMinutes >= 1440 || endMinutes < 0 || endMinutes >= 1440) return []
  const durationMinutes =
    endMinutes > startMinutes ? endMinutes - startMinutes : 1440 - startMinutes + endMinutes
  if (durationMinutes <= 0) return []

  const monday = new Date(reference)
  monday.setDate(reference.getDate() - ((reference.getDay() + 6) % 7))
  return [...new Set(weekdays)]
    .filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)
    .sort((left, right) => ((left + 6) % 7) - ((right + 6) % 7))
    .map((weekday) => {
      const shiftStart = new Date(monday)
      shiftStart.setDate(monday.getDate() + ((weekday + 6) % 7))
      shiftStart.setHours(startHour, startMinute, 0, 0)
      return {
        endsAt: new Date(shiftStart.getTime() + durationMinutes * 60_000).toISOString(),
        startsAt: shiftStart.toISOString(),
      }
    })
}

export function shiftMinutes(shift: Pick<WorkforceShift, 'startsAt' | 'endsAt'>): number {
  return Math.max(
    0,
    Math.floor((new Date(shift.endsAt).getTime() - new Date(shift.startsAt).getTime()) / 60000),
  )
}
export function hasShiftOverlap(
  shifts: readonly WorkforceShift[],
  candidate: WorkforceShift,
): boolean {
  return shifts.some(
    (shift) =>
      shift.employeeId === candidate.employeeId &&
      shift.status !== 'cancelled' &&
      candidate.status !== 'cancelled' &&
      new Date(shift.startsAt).getTime() < new Date(candidate.endsAt).getTime() &&
      new Date(candidate.startsAt).getTime() < new Date(shift.endsAt).getTime(),
  )
}
