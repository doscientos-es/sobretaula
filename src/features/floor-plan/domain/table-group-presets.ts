export interface TableGroupPresetInput {
  name: string
  tableIds: readonly string[]
  maxSeats: number
}

export interface NormalizedTableGroupPreset {
  name: string
  tableIds: string[]
  maxSeats: number
}

export interface TableGroupPresetAvailability {
  availableTableIds: string[]
  missingTableIds: string[]
  totalSeats: number
  fitsCapacity: boolean
}

/** Normalizes a reusable table combination before persistence or application. */
export function normalizeTableGroupPreset(
  input: TableGroupPresetInput,
): NormalizedTableGroupPreset | undefined {
  const name = input.name.trim()
  const tableIds = [...new Set(input.tableIds.map((id) => id.trim()).filter(Boolean))]
  const maxSeats = Math.floor(input.maxSeats)
  if (!name || tableIds.length < 2 || maxSeats <= 0) return undefined
  return { name, tableIds, maxSeats }
}

/** Resolves a preset against the current floor, without mutating a layout. */
export function inspectTableGroupPresetAvailability(
  preset: NormalizedTableGroupPreset,
  tables: ReadonlyMap<string, number>,
): TableGroupPresetAvailability {
  const availableTableIds = preset.tableIds.filter((id) => tables.has(id))
  const missingTableIds = preset.tableIds.filter((id) => !tables.has(id))
  const totalSeats = availableTableIds.reduce(
    (sum, id) => sum + Math.max(0, Math.floor(tables.get(id) ?? 0)),
    0,
  )
  return {
    availableTableIds,
    missingTableIds,
    totalSeats,
    fitsCapacity: missingTableIds.length === 0 && totalSeats <= preset.maxSeats,
  }
}
