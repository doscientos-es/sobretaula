export {
  DEFAULT_GRID_SIZE_CM,
  findPlacementCollisions,
  isPlacementWithinBounds,
  movePlacement,
  placementBoundingBox,
  placementsOverlap,
  snapCoordinate,
} from './domain/geometry'
export {
  commitEditorHistory,
  createEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
} from './domain/editor-history'
export {
  createFloorPlanTable,
  createInitialFloorPlan,
  getFloorPlan,
  saveFloorPlanVersion,
} from './application/floor-plan'
export { FloorPlanPage } from './ui/floor-plan-page'
export type {
  FloorPlanArea,
  FloorAreaGroup,
  FloorPlanData,
  FloorPlanElement,
  FloorPlanTablePlacement,
  FloorPlanVersion,
  PlanElementKind,
} from './domain/floor-plan'
export {
  normalizeTableGroupPreset,
  type TableGroupPresetInput,
  type NormalizedTableGroupPreset,
} from './domain/table-group-presets'
export {
  describeSpaceType,
  findVersionScheduleConflicts,
  groupAreasByFloor,
  selectActiveFloorPlanVersion,
  selectFloorPlanVersion,
} from './domain/floor-plan'
export type { EditorHistory } from './domain/editor-history'
export type { PlanBounds, PlanPlacement, Position } from './domain/geometry'
