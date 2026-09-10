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
