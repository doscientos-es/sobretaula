export interface SchedulingBlockWindow {
  areaId: string | null
  startsAt: Date
  endsAt: Date
  visibleOnline: boolean
}
export function blockAppliesToArea(
  block: SchedulingBlockWindow,
  areaId: string | null,
  startsAt: Date,
  endsAt: Date,
): boolean {
  return (
    block.visibleOnline &&
    (block.areaId === null || block.areaId === areaId) &&
    block.startsAt < endsAt &&
    startsAt < block.endsAt
  )
}
