import type { PlanPlacement } from './geometry'

export interface FloorPlanArea {
  heightCm: number
  id: string
  isOnlineBookable: boolean
  name: string
  venueId: string
  widthCm: number
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

export interface FloorPlanTablePlacement extends PlanPlacement {
  areaId: string
  code: string
  minSeats?: number
  normalSeats?: number
  maxSeats?: number
  isLocked?: boolean
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
  areaId: string
  kind: PlanElementKind
  label: string | null
}

export interface FloorPlanData {
  areas: readonly FloorPlanArea[]
  elements: readonly FloorPlanElement[]
  placements: readonly FloorPlanTablePlacement[]
  /** All table codes in the venue, including tables in another area. */
  tableCodes?: readonly string[]
}

export function nextAvailableTableCode(
  existingCodes: readonly string[],
  pendingCodes: readonly string[] = [],
): string {
  const usedCodes = new Set([...existingCodes, ...pendingCodes])
  let number = 1
  while (usedCodes.has(String(number))) number += 1
  return String(number)
}
