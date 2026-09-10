export const TIME_EVENT_TYPES = ['clock_in', 'break_start', 'break_end', 'clock_out'] as const
export type TimeEventType = (typeof TIME_EVENT_TYPES)[number]
export interface TimeEvent { eventType: TimeEventType; occurredAt: string }
const next: Record<TimeEventType | 'none', TimeEventType[]> = { none: ['clock_in'], clock_in: ['break_start', 'clock_out'], break_start: ['break_end'], break_end: ['break_start', 'clock_out'], clock_out: ['clock_in'] }
export function allowedNextEvent(last: TimeEventType | null): TimeEventType[] { return next[last ?? 'none'] }
export function workedMinutes(events: readonly TimeEvent[], now = new Date()): number {
  let total = 0; let workStart: number | null = null
  for (const event of events) { const at = new Date(event.occurredAt).getTime(); if (event.eventType === 'clock_in' || event.eventType === 'break_end') workStart = at; if ((event.eventType === 'break_start' || event.eventType === 'clock_out') && workStart !== null) { total += Math.max(0, at - workStart); workStart = null } }
  if (workStart !== null) total += Math.max(0, now.getTime() - workStart)
  return Math.floor(total / 60000)
}
