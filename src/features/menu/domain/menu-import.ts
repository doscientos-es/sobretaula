export interface MenuImportRow {
  category: string
  descriptionEs?: string
  nameEs: string
  priceCents: number
  sku?: string
  vatRateBps: number
  modifierGroup?: string
  modifierName?: string
  modifierPriceDeltaCents?: number
}

export interface MenuImportError {
  message: string
  row: number
}

export interface MenuImportPreview {
  errors: MenuImportError[]
  rows: MenuImportRow[]
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === delimiter && !quoted) {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += character
    }
  }
  cells.push(cell.trim())
  return cells
}

function numberValue(value: string, row: number, label: string): number {
  const normalized = value.replace(',', '.').trim()
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label}_invalid`)
  return parsed
}

/** Parses the supported carta template without writing anything to the database. */
export function previewMenuCsv(csv: string): MenuImportPreview {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
  if (lines.length === 0) return { errors: [{ message: 'empty_file', row: 1 }], rows: [] }
  const firstLine = lines[0] ?? ''
  const delimiter = firstLine.includes(';') ? ';' : ','
  const headers = parseCsvLine(firstLine, delimiter).map((header) => header.trim().toLowerCase())
  const required = ['categoria', 'nombre', 'precio', 'iva']
  const missing = required.filter((header) => !headers.includes(header))
  if (missing.length)
    return {
      errors: [{ message: `missing_columns:${missing.join(',')}`, row: 1 }],
      rows: [],
    }
  const index = (name: string) => headers.indexOf(name)
  const rows: MenuImportRow[] = []
  const errors: MenuImportError[] = []
  const skus = new Set<string>()
  for (const [offset, line] of lines.slice(1).entries()) {
    const row = offset + 2
    try {
      const cells = parseCsvLine(line, delimiter)
      const category = cells[index('categoria')]?.trim()
      const nameEs = cells[index('nombre')]?.trim()
      const sku = cells[index('sku')]?.trim() || undefined
      const modifierGroup = cells[index('grupo_modificador')]?.trim() || undefined
      const modifierName = cells[index('modificador')]?.trim() || undefined
      if ((modifierGroup && !modifierName) || (!modifierGroup && modifierName))
        throw new Error('modifier_group_and_name_required')
      if (!category || !nameEs) throw new Error('category_and_name_required')
      if (sku && skus.has(sku)) throw new Error('duplicate_sku')
      const price = numberValue(cells[index('precio')] ?? '', row, 'price')
      const vat = numberValue(cells[index('iva')] ?? '', row, 'vat')
      if (vat > 100) throw new Error('vat_invalid')
      if (sku) skus.add(sku)
      const parsedRow: MenuImportRow = {
        category,
        nameEs,
        priceCents: Math.round(price * 100),
        vatRateBps: Math.round(vat * 100),
      }
      const descriptionEs = cells[index('descripcion')]?.trim()
      if (descriptionEs) parsedRow.descriptionEs = descriptionEs
      if (sku) parsedRow.sku = sku
      if (modifierGroup && modifierName) {
        parsedRow.modifierGroup = modifierGroup
        parsedRow.modifierName = modifierName
        const supplement = cells[index('suplemento')]?.trim()
        parsedRow.modifierPriceDeltaCents = supplement
          ? Math.round(numberValue(supplement, row, 'modifier_price') * 100)
          : 0
      }
      rows.push(parsedRow)
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'invalid_row',
        row,
      })
    }
  }
  return { errors, rows }
}
