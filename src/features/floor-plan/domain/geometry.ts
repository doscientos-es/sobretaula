export const DEFAULT_GRID_SIZE_CM = 25

export interface PlanBounds {
  heightCm: number
  widthCm: number
}

export interface PlanPlacement {
  heightCm: number
  id: string
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

/**
 * Finds pairs of usable elements whose free gap is below the configured aisle
 * width. Elements that only touch at an edge are intentionally ignored.
 */
export function findNarrowPassages(
  placements: readonly PlanPlacement[],
  minimumClearanceCm: number,
): Array<{ firstPlacementId: string; secondPlacementId: string; clearanceCm: number }> {
  if (!Number.isFinite(minimumClearanceCm) || minimumClearanceCm <= 0) return []
  const result: Array<{
    firstPlacementId: string
    secondPlacementId: string
    clearanceCm: number
  }> = []
  for (let index = 0; index < placements.length; index += 1) {
    const first = placements[index]
    if (!first) continue
    const firstBounds = first
    for (let otherIndex = index + 1; otherIndex < placements.length; otherIndex += 1) {
      const second = placements[otherIndex]
      if (!second || placementsOverlap(first, second)) continue
      const secondBounds = second
      const horizontalGap =
        firstBounds.xCm + firstBounds.widthCm <= secondBounds.xCm
          ? secondBounds.xCm - (firstBounds.xCm + firstBounds.widthCm)
          : firstBounds.xCm - (secondBounds.xCm + secondBounds.widthCm)
      const verticalGap =
        firstBounds.yCm + firstBounds.heightCm <= secondBounds.yCm
          ? secondBounds.yCm - (firstBounds.yCm + firstBounds.heightCm)
          : firstBounds.yCm - (secondBounds.yCm + secondBounds.heightCm)
      const horizontalOverlap =
        firstBounds.xCm < secondBounds.xCm + secondBounds.widthCm &&
        firstBounds.xCm + firstBounds.widthCm > secondBounds.xCm
      const verticalOverlap =
        firstBounds.yCm < secondBounds.yCm + secondBounds.heightCm &&
        firstBounds.yCm + firstBounds.heightCm > secondBounds.yCm
      const clearanceCm = horizontalOverlap
        ? verticalGap
        : verticalOverlap
          ? horizontalGap
          : Math.hypot(horizontalGap, verticalGap)
      if (clearanceCm < minimumClearanceCm) {
        result.push({
          clearanceCm,
          firstPlacementId: first.id,
          secondPlacementId: second.id,
        })
      }
    }
  }
  return result
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

export function rotatePlacement(placement: PlanPlacement): PlanPlacement {
  return {
    ...placement,
    heightCm: placement.widthCm,
    widthCm: placement.heightCm,
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
