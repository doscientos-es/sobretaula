import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  DialogContent,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Field,
  FieldLabel,
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
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, BookOpen, Layers3, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import { deleteMenuCategory, updateMenuCategory, type MenuCatalog } from '../application/menu'
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
  primaryLocale,
  tenantId,
}: {
  catalog: MenuCatalog
  locale: Locale
  primaryLocale: Locale
  tenantId: string
}) {
  const t = createTranslator(locale)
  const sections = buildMenuSections({
    categories: catalog.categories,
    items: catalog.items,
    locale,
  })
  const reload = useLoaderReload()
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [visibility, setVisibility] = useState<'all' | 'active' | 'inactive'>('all')
  const [station, setStation] = useState<KitchenStation | 'all'>('all')
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<MenuCatalog['categories'][number]>()
  const [editNameEs, setEditNameEs] = useState('')
  const [editNameCa, setEditNameCa] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MenuCatalog['categories'][number]>()
  const [deletingCategory, setDeletingCategory] = useState(false)
  const [categorySaving, setCategorySaving] = useState(false)
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

  function reloadMenu() {
    void queryClient.invalidateQueries({ queryKey: ['tenant', tenantId, 'menu-catalog'] })
    reload()
  }

  function openCategoryEditor(category: MenuCatalog['categories'][number]) {
    setEditingCategory(category)
    setEditNameEs(
      primaryLocale === 'ca' ? (category.nameI18n.ca ?? '') : (category.nameI18n.es ?? ''),
    )
    setEditNameCa(
      primaryLocale === 'ca' ? (category.nameI18n.es ?? '') : (category.nameI18n.ca ?? ''),
    )
  }

  async function removeCategory(category: MenuCatalog['categories'][number]) {
    setDeleteTarget(category)
  }

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingCategory || !editNameEs.trim()) return
    setCategorySaving(true)
    try {
      await updateMenuCategory({
        data: {
          categoryId: editingCategory.id,
          nameCa: primaryLocale === 'ca' ? editNameEs.trim() : editNameCa.trim() || undefined,
          nameEs:
            primaryLocale === 'ca' ? editNameCa.trim() || editNameEs.trim() : editNameEs.trim(),
          tenantId,
        },
      })
      setEditingCategory(undefined)
      reloadMenu()
    } finally {
      setCategorySaving(false)
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteTarget) return
    setDeletingCategory(true)
    try {
      await deleteMenuCategory({ data: { categoryId: deleteTarget.id, tenantId } })
      setDeleteTarget(undefined)
      reloadMenu()
    } finally {
      setDeletingCategory(false)
    }
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
          onDone={reloadMenu}
          primaryLocale={locale}
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
            <SelectTrigger aria-label="Filtrar por visibilidad">
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
            <SelectTrigger aria-label="Filtrar por estación">
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
        <Card className="overflow-hidden border-dashed">
          <CardContent className="grid items-center gap-8 p-6 sm:grid-cols-[minmax(0,1fr)_18rem] sm:p-10">
            <div>
              <div className="bg-primary/10 text-primary mb-5 grid size-11 place-items-center rounded-xl">
                <BookOpen aria-hidden="true" className="size-5" />
              </div>
              <p className="text-muted-foreground mb-2 text-sm font-medium">
                Tu carta empieza aquí
              </p>
              <CardTitle className="text-2xl tracking-tight">
                Construye una carta lista para vender
              </CardTitle>
              <CardDescription className="mt-2 max-w-lg text-sm leading-6">
                Organiza tus platos por categorías y añade precios, IVA y estación de cocina desde
                un mismo lugar.
              </CardDescription>
              <Button className="mt-6" onClick={() => setCategoryOpen(true)} type="button">
                <Plus aria-hidden="true" className="size-4" /> Crear primera categoría
                <ArrowRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
            <div className="bg-muted/40 rounded-xl p-4">
              <p className="mb-3 text-xs font-semibold tracking-wide uppercase">Cómo empezar</p>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="bg-background grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">
                    1
                  </span>
                  <span>Crea una categoría</span>
                </li>
                <li className="flex gap-3">
                  <span className="bg-background grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">
                    2
                  </span>
                  <span>Añade tu primer plato</span>
                </li>
                <li className="flex gap-3">
                  <span className="bg-background grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold">
                    3
                  </span>
                  <span>Déjalo listo para sala</span>
                </li>
              </ol>
              <div className="text-muted-foreground mt-4 flex items-center gap-2 border-t pt-3 text-xs">
                <Layers3 aria-hidden="true" className="size-3.5" /> También puedes importar la carta
                desde CSV.
              </div>
            </div>
          </CardContent>
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
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{localizedText(section.category.nameI18n, locale)}</CardTitle>
                    <CardDescription>
                      {section.items.length === 1 ? '1 plato' : `${section.items.length} platos`}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      aria-label="Editar categoría"
                      onClick={() => openCategoryEditor(section.category)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      aria-label="Borrar categoría"
                      onClick={() => void removeCategory(section.category)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
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
                        onDone={reloadMenu}
                        tenantId={tenantId}
                      />
                    ))}
                    <InlineMenuItemRow
                      categoryId={section.category.id}
                      locale={locale}
                      onDone={reloadMenu}
                      tenantId={tenantId}
                    />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <DialogRoot
        onOpenChange={(open) => !open && setEditingCategory(undefined)}
        open={Boolean(editingCategory)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar categoría</DialogTitle>
            <DialogDescription>Actualiza el nombre y sus traducciones.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={(event) => void saveCategory(event)}>
            <Field>
              <FieldLabel htmlFor="edit-category-es">
                Nombre principal ({primaryLocale === 'ca' ? 'catalán' : 'castellano'})
              </FieldLabel>
              <Input
                id="edit-category-es"
                onChange={(event) => setEditNameEs(event.target.value)}
                required
                value={editNameEs}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-category-ca">
                Traducción ({primaryLocale === 'ca' ? 'castellano' : 'catalán'})
              </FieldLabel>
              <Input
                id="edit-category-ca"
                onChange={(event) => setEditNameCa(event.target.value)}
                value={editNameCa}
              />
            </Field>
            <Button disabled={categorySaving} type="submit">
              {categorySaving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </form>
        </DialogContent>
      </DialogRoot>
      <DialogRoot
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        open={Boolean(deleteTarget)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Borrar categoría</DialogTitle>
            <DialogDescription>
              {deleteTarget &&
                sections.find((section) => section.category.id === deleteTarget.id)?.items.length
                ? 'No puedes borrar esta categoría porque todavía tiene platos.'
                : `Se borrará “${deleteTarget ? localizedText(deleteTarget.nameI18n, locale) : ''}”. Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteTarget(undefined)} type="button" variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={
                deletingCategory ||
                Boolean(
                  deleteTarget &&
                  sections.find((section) => section.category.id === deleteTarget.id)?.items.length,
                )
              }
              onClick={() => void confirmDeleteCategory()}
              type="button"
              variant="destructive"
            >
              {deletingCategory ? 'Borrando…' : 'Borrar categoría'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </section>
  )
}
