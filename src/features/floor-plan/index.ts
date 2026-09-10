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
  createTableGroupPreset,
  deleteTableGroupPreset,
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
  TableGroupPreset,
  PlanElementKind,
} from './domain/floor-plan'
export {
  inspectTableGroupPresetAvailability,
  normalizeTableGroupPreset,
  type TableGroupPresetInput,
  type NormalizedTableGroupPreset,
} from './domain/table-group-presets'
export {
  describeSpaceType,
  findVersionScheduleConflicts,
  isFloorPlanVersionScheduleValid,
  groupAreasByFloor,
  selectActiveFloorPlanVersion,
  selectFloorPlanVersion,
} from './domain/floor-plan'
export type { EditorHistory } from './domain/editor-history'
export type { PlanBounds, PlanPlacement, Position } from './domain/geometry'
