import type { WorkforceShift } from './workforce'

export interface AvailabilityWindow {
  weekday: number
  startsAt: string
  endsAt: string
  available: boolean
}
export interface Absence {
  startsAt: string
  endsAt: string
  status: 'requested' | 'approved' | 'rejected'
}

export function isEmployeeAvailable(
  shift: WorkforceShift,
  windows: readonly AvailabilityWindow[],
  absences: readonly Absence[],
): boolean {
  const start = new Date(shift.startsAt)
  const end = new Date(shift.endsAt)
  const day = start.getDay()
  const clock = (date: Date) =>
    `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
  const window = windows.find(
    (candidate) =>
      candidate.weekday === day &&
      candidate.available &&
      candidate.startsAt <= clock(start) &&
      candidate.endsAt >= clock(end),
  )
  const absent = absences.some(
    (absence) =>
      absence.status === 'approved' &&
      absence.startsAt <= shift.startsAt.slice(0, 10) &&
      absence.endsAt >= end.toISOString().slice(0, 10),
  )
  return Boolean(window) && !absent
}
