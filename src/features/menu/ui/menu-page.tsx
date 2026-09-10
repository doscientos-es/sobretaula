import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@doscientos/ui'

import type { Locale } from '@/shared/lib/i18n/locale'
import { createTranslator } from '@/shared/lib/i18n/messages'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import type { MenuCatalog } from '../application/menu'
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
                  {section.items.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Todavía no hay platos en esta categoría.
                    </p>
                  ) : (
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
                      </TableBody>
                    </Table>
                  )}
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
