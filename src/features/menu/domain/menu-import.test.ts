import { describe, expect, it } from 'vitest'

import { previewMenuCsv } from './menu-import'

describe('previewMenuCsv', () => {
  it('supports semicolon exports, decimal commas and quoted cells', () => {
    const result = previewMenuCsv(
      'categoria;nombre;precio;iva;descripcion\nEntrantes;"Croquetas; caseras";8,5;10;Para compartir',
    )
    expect(result.errors).toEqual([])
    expect(result.rows[0]).toMatchObject({
      category: 'Entrantes',
      descriptionEs: 'Para compartir',
      nameEs: 'Croquetas; caseras',
      priceCents: 850,
      vatRateBps: 1000,
    })
  })

  it('reports missing columns and invalid or duplicated rows', () => {
    const result = previewMenuCsv(
      'categoria,nombre,precio,iva,sku\nBebidas,Cerveza,3,10,A1\nBebidas,Otra,mal,10,A2\nBebidas,Duplicada,4,10,A1',
    )
    expect(result.rows).toHaveLength(1)
    expect(result.errors).toEqual([
      { message: 'price_invalid', row: 3 },
      { message: 'duplicate_sku', row: 4 },
    ])
    expect(previewMenuCsv('nombre,precio\nPlato,5').errors[0]?.message).toContain('missing_columns')
  })
})
