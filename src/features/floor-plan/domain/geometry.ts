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

export interface PlanObstacle extends PlanPlacement {
  kind?: string
}

export function findBlockedAccesses(
  placements: readonly PlanPlacement[],
  accesses: readonly PlanObstacle[],
): Array<{ accessId: string; placementId: string }> {
  return accesses
    .filter((access) => access.kind === 'door' || access.kind === 'exit')
    .flatMap((access) =>
      placements
        .filter((placement) => placementsOverlap(access, placement))
        .map((placement) => ({ accessId: access.id, placementId: placement.id })),
    )
}

/** Axis-aligned footprint after rotating around the placement centre. */
export function placementBoundingBox(placement: PlanPlacement): PlanPlacement {
  const radians = ((placement.rotationDeg % 360) * Math.PI) / 180
  const sine = Math.abs(Math.sin(radians))
  const cosine = Math.abs(Math.cos(radians))
  const width = Math.round((placement.widthCm * cosine + placement.heightCm * sine) * 1e6) / 1e6
  const height = Math.round((placement.widthCm * sine + placement.heightCm * cosine) * 1e6) / 1e6
  return {
    ...placement,
    heightCm: height,
    widthCm: width,
    xCm: Math.round((placement.xCm + (placement.widthCm - width) / 2) * 1e6) / 1e6,
    yCm: Math.round((placement.yCm + (placement.heightCm - height) / 2) * 1e6) / 1e6,
  }
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
  const firstBounds = placementBoundingBox(first)
  const secondBounds = placementBoundingBox(second)
  return (
    firstBounds.xCm < secondBounds.xCm + secondBounds.widthCm &&
    firstBounds.xCm + firstBounds.widthCm > secondBounds.xCm &&
    firstBounds.yCm < secondBounds.yCm + secondBounds.heightCm &&
    firstBounds.yCm + firstBounds.heightCm > secondBounds.yCm
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
  const footprint = placementBoundingBox(placement)
  return (
    footprint.xCm >= 0 &&
    footprint.yCm >= 0 &&
    footprint.xCm + footprint.widthCm <= bounds.widthCm &&
    footprint.yCm + footprint.heightCm <= bounds.heightCm
  )
}
