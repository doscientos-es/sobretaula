import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  Input,
} from '@doscientos/ui'
import { useState } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'
import { parsePriceToCents } from '@/shared/lib/money/money'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import { createMenuItem, type MenuCatalog } from '../application/menu'
import { buildMenuSections, localizedText } from '../domain/menu'
import { MenuForms } from './menu-forms'
import { MenuItemRow } from './menu-item-row'

/** Carta del restaurante: categorías ordenadas con sus platos y las altas. */
export function MenuPage({
  catalog,
  locale,
  tenantId,
}: {
  catalog: MenuCatalog
  locale: Locale
  tenantId: string
}) {
  const t = createTranslator(locale)
  const sections = buildMenuSections({
    categories: catalog.categories,
    items: catalog.items,
    locale,
  })

  const reload = useLoaderReload()

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{t('nav.menu')}</PageHeaderTitle>
          <PageHeaderDescription>
            Mantén tus platos, precios e IVA preparados para que sala pueda cobrar con fluidez.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <div className="grid gap-6">
        <div className="space-y-6">
          {sections.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>La carta está vacía</CardTitle>
                <CardDescription>
                  Crea la primera categoría con el formulario y después añade sus platos.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            sections.map((section) => (
              <Card key={section.category.id}>
                <CardHeader>
                  <CardTitle>{localizedText(section.category.nameI18n, locale)}</CardTitle>
                  <CardDescription>
                    {section.items.length === 1 ? '1 plato' : `${section.items.length} platos`}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Plato</TableHead>
                        <TableHead>Precio</TableHead>
                        <TableHead>IVA</TableHead>
                        <TableHead>Preparación</TableHead>
                        <TableHead>Estación</TableHead>
                        <TableHead>
                          <span className="sr-only">Acciones</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {section.items.map((item) => (
                        <MenuItemRow
                          item={item}
                          key={item.id}
                          locale={locale}
                          onDone={reload}
                          tenantId={tenantId}
                        />
                      ))}
                      <InlineMenuItemRow
                        categoryId={section.category.id}
                        onDone={reload}
                        tenantId={tenantId}
                      />
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </div>
        <MenuForms
          categories={catalog.categories}
          locale={locale}
          onDone={reload}
          tenantId={tenantId}
        />
      </div>
    </section>
  )
}

function InlineMenuItemRow({
  categoryId,
  onDone,
  tenantId,
}: {
  categoryId: string
  onDone: () => void
  tenantId: string
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    const priceCents = parsePriceToCents(price)
    if (!name.trim() || priceCents === null) {
      setError('Indica nombre y precio.')
      return
    }
    try {
      await createMenuItem({
        data: { categoryId, nameEs: name.trim(), priceCents, tenantId, vatRateBps: 1000 },
      })
      setName('')
      setPrice('')
      setEditing(false)
      setError('')
      onDone()
    } catch {
      setError('No se ha podido guardar el plato.')
    }
  }
  return (
    <TableRow className="bg-muted/20">
      <TableCell colSpan={5}>
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="Nombre del nuevo plato"
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del plato"
              value={name}
            />
            <Input
              aria-label="Precio del nuevo plato"
              inputMode="decimal"
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Precio"
              value={price}
            />
            <Button onClick={() => void save()} size="sm" type="button">
              Guardar
            </Button>
            <Button onClick={() => setEditing(false)} size="sm" type="button" variant="ghost">
              Cancelar
            </Button>
            {error && <span className="text-destructive text-xs">{error}</span>}
          </div>
        ) : (
          <Button onClick={() => setEditing(true)} size="sm" type="button" variant="outline">
            + Añadir plato a esta categoría
          </Button>
        )}
      </TableCell>
      <TableCell />
    </TableRow>
  )
}
