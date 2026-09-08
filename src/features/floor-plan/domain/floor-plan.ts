import type { PlanPlacement } from './geometry'

export interface FloorPlanArea {
  id: string
  isOnlineBookable: boolean
  name: string
  venueId: string
}

export interface FloorPlanVersion {
  areaId: string
  heightCm: number
  id: string
  name: string
  widthCm: number
}

export interface FloorPlanTablePlacement extends PlanPlacement {
  code: string
  floorPlanVersionId: string
}

export type PlanElementKind =
  | 'bar'
  | 'door'
  | 'label'
  | 'other'
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
