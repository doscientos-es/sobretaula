import { Card, CardContent, CardHeader, CardTitle, PageHeader, PageHeaderDescription, PageHeaderTitle } from '@doscientos/ui'
import type { Locale } from '@/shared/lib/i18n/locale'
import type { MenuCatalog } from '../application/menu'
import { buildMenuSections, localizedText } from '../domain/menu'

export function PublicMenuPage({ catalog, locale }: { catalog: MenuCatalog; locale: Locale }) {
  const sections = buildMenuSections({ categories: catalog.categories, items: catalog.items, locale })
  return (
    <section className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader><PageHeaderTitle>Carta</PageHeaderTitle><PageHeaderDescription>Consulta nuestros platos, alérgenos e información alimentaria.</PageHeaderDescription></PageHeader>
      {sections.map((section) => <Card key={section.category.id}><CardHeader><CardTitle>{localizedText(section.category.nameI18n, locale)}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">{section.items.map((item) => <article className="rounded-lg border p-4" key={item.id}><div className="flex justify-between gap-3"><h2 className="font-medium">{localizedText(item.nameI18n, locale)}</h2><span>{(item.priceCents / 100).toFixed(2)} €</span></div>{localizedText(item.descriptionI18n, locale) && <p className="text-muted-foreground mt-1 text-sm">{localizedText(item.descriptionI18n, locale)}</p>}<div className="mt-3 flex flex-wrap gap-2 text-xs">{item.isVegan && <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">Vegano</span>}{item.allergens?.map((allergen) => <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800" key={allergen}>Contiene {allergen}{item.allergenReasons?.[allergen]?.length ? ` · ${item.allergenReasons[allergen].join(', ')}` : ''}</span>)}</div></article>)}</CardContent></Card>)}
    </section>
  )
}
