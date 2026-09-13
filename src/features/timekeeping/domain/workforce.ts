export interface WorkforceShift {
  employeeId: string
  startsAt: string
  endsAt: string
  status: 'draft' | 'published' | 'confirmed' | 'cancelled'
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
