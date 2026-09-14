import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
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
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import type { MenuCatalog } from '../application/menu'
import {
  buildMenuSections,
  filterMenuSections,
  localizedText,
  type KitchenStation,
} from '../domain/menu'
import { InlineMenuItemRow } from './inline-menu-item-row'
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
  const [query, setQuery] = useState('')
  const [visibility, setVisibility] = useState<'all' | 'active' | 'inactive'>('all')
  const [station, setStation] = useState<KitchenStation | 'all'>('all')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const visibleSections = filterMenuSections(sections, {
    isActive: visibility === 'all' ? undefined : visibility === 'active',
    kitchenStation: station === 'all' ? undefined : station,
    locale,
    query,
  })
  const visibleItems = visibleSections.reduce((count, section) => count + section.items.length, 0)
  const hasFilters = Boolean(query.trim()) || visibility !== 'all' || station !== 'all'

  function clearFilters() {
    setQuery('')
    setVisibility('all')
    setStation('all')
  }

  return (
    <section className="space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>{t('nav.menu')}</PageHeaderTitle>
          <PageHeaderDescription>
            Mantén tus platos, precios e IVA preparados para que sala pueda cobrar con fluidez.
          </PageHeaderDescription>
        </div>
        <MenuForms
          categories={catalog.categories}
          categoryOpen={categoryOpen}
          onCategoryOpenChange={setCategoryOpen}
          onDone={reload}
          tenantId={tenantId}
        />
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Buscar y filtrar</CardTitle>
          <CardDescription>
            {hasFilters
              ? `${visibleItems} ${visibleItems === 1 ? 'plato encontrado' : 'platos encontrados'}`
              : `${catalog.items.length} ${catalog.items.length === 1 ? 'plato en carta' : 'platos en carta'}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input
            aria-label="Buscar platos o categorías"
            className="md:col-span-1"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar platos o categorías…"
            value={query}
          />
          <Select
            aria-label="Filtrar por visibilidad"
            onSelectionChange={(key) => setVisibility(String(key) as typeof visibility)}
            selectedKey={visibility}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectList>
                <SelectItem id="all">Todos los platos</SelectItem>
                <SelectItem id="active">A la venta</SelectItem>
                <SelectItem id="inactive">Retirados</SelectItem>
              </SelectList>
            </SelectContent>
          </Select>
          <Select
            aria-label="Filtrar por estación"
            onSelectionChange={(key) => setStation(String(key) as typeof station)}
            selectedKey={station}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectList>
                <SelectItem id="all">Todas las estaciones</SelectItem>
                <SelectItem id="general">General</SelectItem>
                <SelectItem id="hot">Caliente</SelectItem>
                <SelectItem id="cold">Frío</SelectItem>
                <SelectItem id="bar">Barra</SelectItem>
                <SelectItem id="dessert">Postres</SelectItem>
              </SelectList>
            </SelectContent>
          </Select>
          {hasFilters ? (
            <button
              className="text-primary w-fit text-sm font-medium hover:underline md:col-start-3"
              onClick={clearFilters}
              type="button"
            >
              Limpiar filtros
            </button>
          ) : null}
        </CardContent>
      </Card>
      {sections.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader className="items-center gap-3 py-12 text-center">
            <div
              aria-hidden="true"
              className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-2xl"
            >
              🍽️
            </div>
            <CardTitle>Empieza a construir tu carta</CardTitle>
            <CardDescription className="max-w-md">
              Crea una categoría —por ejemplo, Entrantes o Postres— y añade sus platos desde ahí.
            </CardDescription>
            <button
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium shadow-sm transition-colors"
              onClick={() => setCategoryOpen(true)}
              type="button"
            >
              Crear primera categoría
            </button>
          </CardHeader>
        </Card>
      ) : visibleSections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No hay coincidencias</CardTitle>
            <CardDescription>Prueba a cambiar la búsqueda o a limpiar los filtros.</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              className="text-primary text-sm font-medium hover:underline"
              onClick={clearFilters}
              type="button"
            >
              Limpiar filtros
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {visibleSections.map((section) => (
            <Card key={section.category.id}>
              <CardHeader>
                <CardTitle>{localizedText(section.category.nameI18n, locale)}</CardTitle>
                <CardDescription>
                  {section.items.length === 1 ? '1 plato' : `${section.items.length} platos`}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table className="min-w-[55rem]">
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
                      locale={locale}
                      onDone={reload}
                      tenantId={tenantId}
                    />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  )
}
