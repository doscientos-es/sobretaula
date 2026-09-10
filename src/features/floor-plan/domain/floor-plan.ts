import type { PlanPlacement } from './geometry'

export interface FloorPlanArea {
  id: string
  isOnlineBookable: boolean
  name: string
  venueId: string
  /** Optional until the floor/zone migration is rolled out. */
  floorNumber?: number | null | undefined
  spaceType?: 'indoor' | 'covered_terrace' | 'outdoor_terrace' | 'other' | undefined
  outdoorOpen?: boolean | undefined
}

export interface FloorAreaGroup {
  floorNumber: number | null
  label: string
  areas: readonly FloorPlanArea[]
}

export function describeSpaceType(type: FloorPlanArea['spaceType']): string {
  if (type === 'covered_terrace') return 'Terraza cubierta'
  if (type === 'outdoor_terrace') return 'Terraza exterior'
  if (type === 'indoor') return 'Interior'
  return 'Zona'
}

export function groupAreasByFloor(areas: readonly FloorPlanArea[]): FloorAreaGroup[] {
  const groups = new Map<number | null, FloorPlanArea[]>()
  for (const area of areas) {
    const key = area.floorNumber ?? null
    groups.set(key, [...(groups.get(key) ?? []), area])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === null ? -1 : b === null ? 1 : a - b))
    .map(([floorNumber, grouped]) => ({
      areas: grouped,
      floorNumber,
      label:
        floorNumber === null
          ? 'Sin planta asignada'
          : floorNumber === 0
            ? 'Planta baja'
            : `Planta ${floorNumber}`,
    }))
}

export interface FloorPlanVersion {
  areaId: string
  heightCm: number
  id: string
  name: string
  widthCm: number
  activeFrom?: string
  activeTo?: string | null
}

/** Returns false for malformed timestamps or an empty/reversed interval. */
export function isFloorPlanVersionScheduleValid(version: FloorPlanVersion): boolean {
  const from = version.activeFrom
    ? new Date(version.activeFrom).getTime()
    : Number.NEGATIVE_INFINITY
  const to = version.activeTo ? new Date(version.activeTo).getTime() : Number.POSITIVE_INFINITY
  return !Number.isNaN(from) && !Number.isNaN(to) && from < to
}

export function selectFloorPlanVersion(
  versions: readonly FloorPlanVersion[],
  areaId: string,
  at = new Date(),
): FloorPlanVersion | undefined {
  const timestamp = at.getTime()
  return versions
    .filter((version) => version.areaId === areaId)
    .filter(isFloorPlanVersionScheduleValid)
    .filter((version) => {
      const from = version.activeFrom
        ? new Date(version.activeFrom).getTime()
        : Number.NEGATIVE_INFINITY
      const to = version.activeTo ? new Date(version.activeTo).getTime() : Number.POSITIVE_INFINITY
      return from <= timestamp && timestamp < to
    })
    .sort((a, b) => (b.activeFrom ?? '').localeCompare(a.activeFrom ?? ''))[0]
}

export function selectActiveFloorPlanVersion(
  versions: readonly FloorPlanVersion[],
  at = new Date(),
): FloorPlanVersion | undefined {
  const timestamp = at.getTime()
  return versions
    .filter(isFloorPlanVersionScheduleValid)
    .filter((version) => {
      const from = version.activeFrom
        ? new Date(version.activeFrom).getTime()
        : Number.NEGATIVE_INFINITY
      const to = version.activeTo ? new Date(version.activeTo).getTime() : Number.POSITIVE_INFINITY
      return from <= timestamp && timestamp < to
    })
    .sort((a, b) => (b.activeFrom ?? '').localeCompare(a.activeFrom ?? ''))[0]
}

export function findVersionScheduleConflicts(
  versions: readonly FloorPlanVersion[],
): Array<{ areaId: string; firstVersionId: string; secondVersionId: string }> {
  const conflicts: Array<{ areaId: string; firstVersionId: string; secondVersionId: string }> = []
  const byArea = new Map<string, FloorPlanVersion[]>()
  for (const version of versions) if (!isFloorPlanVersionScheduleValid(version)) continue
  for (const version of versions)
    byArea.set(version.areaId, [...(byArea.get(version.areaId) ?? []), version])
  for (const [areaId, areaVersions] of byArea) {
    for (let index = 0; index < areaVersions.length; index += 1) {
      const first = areaVersions[index]
      if (!first) continue
      const firstFrom = first.activeFrom
        ? new Date(first.activeFrom).getTime()
        : Number.NEGATIVE_INFINITY
      const firstTo = first.activeTo ? new Date(first.activeTo).getTime() : Number.POSITIVE_INFINITY
      for (const second of areaVersions.slice(index + 1)) {
        const secondFrom = second.activeFrom
          ? new Date(second.activeFrom).getTime()
          : Number.NEGATIVE_INFINITY
        const secondTo = second.activeTo
          ? new Date(second.activeTo).getTime()
          : Number.POSITIVE_INFINITY
        if (firstFrom < secondTo && secondFrom < firstTo)
          conflicts.push({ areaId, firstVersionId: first.id, secondVersionId: second.id })
      }
    }
  }
  return conflicts
}

export interface FloorPlanTablePlacement extends PlanPlacement {
  code: string
  floorPlanVersionId: string
}

export type PlanElementKind =
  | 'bathroom'
  | 'bar'
  | 'exit'
  | 'kitchen'
  | 'door'
  | 'label'
  | 'other'
  | 'obstacle'
  | 'pillar'
  | 'plant'
  | 'stairs'
  | 'wall'
  | 'window'

export interface FloorPlanElement extends PlanPlacement {
  floorPlanVersionId: string
  kind: PlanElementKind
  label: string | null
}

export interface FloorPlanData {
  areas: readonly FloorPlanArea[]
  elements: readonly FloorPlanElement[]
  placements: readonly FloorPlanTablePlacement[]
  versions: readonly FloorPlanVersion[]
}
