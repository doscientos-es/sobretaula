export {
  DEFAULT_GRID_SIZE_CM,
  findPlacementCollisions,
  isPlacementWithinBounds,
  movePlacement,
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
  floorPlanQuery,
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
} from './domain/floor-plan'
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
