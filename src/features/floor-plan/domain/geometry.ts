export const DEFAULT_GRID_SIZE_CM = 25

export interface PlanBounds {
  heightCm: number
  widthCm: number
}

export interface PlanPlacement {
  heightCm: number
  id: string
  rotationDeg: number
  widthCm: number
  xCm: number
  yCm: number
}

export interface Position {
  xCm: number
  yCm: number
}

export type LayoutIssueCode = 'invalid_size' | 'outside_bounds' | 'overlap'

export interface LayoutIssue {
  code: LayoutIssueCode
  placementId: string
  relatedPlacementId?: string
}

/** Returns deterministic, user-actionable issues for a draft layout. */
export function validateLayout(
  placements: readonly PlanPlacement[],
  bounds: PlanBounds,
): LayoutIssue[] {
  const issues: LayoutIssue[] = []
  for (const placement of placements) {
    if (placement.widthCm <= 0 || placement.heightCm <= 0) {
      issues.push({ code: 'invalid_size', placementId: placement.id })
      continue
    }
    if (!isPlacementWithinBounds(placement, bounds)) {
      issues.push({ code: 'outside_bounds', placementId: placement.id })
    }
    for (const other of placements) {
      if (placement.id < other.id && placementsOverlap(placement, other)) {
        issues.push({ code: 'overlap', placementId: placement.id, relatedPlacementId: other.id })
      }
    }
  }
  return issues
}

/** Snaps a coordinate to the nearest grid intersection using exact centimetres. */
export function snapCoordinate(valueCm: number, gridSizeCm = DEFAULT_GRID_SIZE_CM): number {
  if (!Number.isInteger(gridSizeCm) || gridSizeCm <= 0) {
    throw new Error('grid_size_must_be_a_positive_integer')
  }

  return Math.round(valueCm / gridSizeCm) * gridSizeCm
}

export function movePlacement(
  placement: PlanPlacement,
  position: Position,
  gridSizeCm = DEFAULT_GRID_SIZE_CM,
): PlanPlacement {
  return {
    ...placement,
    xCm: snapCoordinate(position.xCm, gridSizeCm),
    yCm: snapCoordinate(position.yCm, gridSizeCm),
  }
}

/** Edges may touch: a collision requires overlapping usable floor surface. */
export function placementsOverlap(first: PlanPlacement, second: PlanPlacement): boolean {
  return (
    first.xCm < second.xCm + second.widthCm &&
    first.xCm + first.widthCm > second.xCm &&
    first.yCm < second.yCm + second.heightCm &&
    first.yCm + first.heightCm > second.yCm
  )
}

export function findPlacementCollisions(
  placement: PlanPlacement,
  placements: readonly PlanPlacement[],
): PlanPlacement[] {
  return placements.filter(
    (candidate) => candidate.id !== placement.id && placementsOverlap(placement, candidate),
  )
}

export function isPlacementWithinBounds(placement: PlanPlacement, bounds: PlanBounds): boolean {
  return (
    placement.xCm >= 0 &&
    placement.yCm >= 0 &&
    placement.xCm + placement.widthCm <= bounds.widthCm &&
    placement.yCm + placement.heightCm <= bounds.heightCm
  )
}
