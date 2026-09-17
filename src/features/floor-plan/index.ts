export {
  DEFAULT_GRID_SIZE_CM,
  findPlacementCollisions,
  isPlacementWithinBounds,
  movePlacement,
  placementsOverlap,
  rotatePlacement,
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
  createFloorPlanArea,
  deleteFloorPlanArea,
  getFloorPlan,
  floorPlanQuery,
  saveFloorPlan,
  updateFloorPlanArea,
  updateFloorPlanTableSeats,
} from './application/floor-plan'
export { FloorPlanPage } from './ui/floor-plan-page'
export type {
  FloorPlanArea,
  FloorAreaGroup,
  FloorPlanData,
  FloorPlanElement,
  FloorPlanTablePlacement,
  PlanElementKind,
} from './domain/floor-plan'
export { describeSpaceType, groupAreasByFloor } from './domain/floor-plan'
export type { EditorHistory } from './domain/editor-history'
export type { PlanBounds, PlanPlacement, Position } from './domain/geometry'
