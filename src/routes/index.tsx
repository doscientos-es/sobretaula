import {
  Card,
  CardContent,
  Badge,
  cn,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
  ArrowRight,
  Building2,
  Boxes,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardList,
  Users,
  Utensils,
} from 'lucide-react'

import { AppShellFrame } from '@/app/app-shell-frame'
import { CurrentUserSidebar } from '@/features/auth'
import { getUserDestinations, MODULE_DEFINITIONS } from '@/features/tenancy'
import { DEFAULT_LOCALE } from '@/shared/lib/i18n/locale'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

export const Route = createFileRoute('/')({
  loader: async () => {
    try {
      const destinations = await getUserDestinations()
      if (destinations.isPlatformMember) throw redirect({ to: '/admin' })
      const [tenant] = destinations.tenants
      if (tenant && destinations.tenants.length === 1) {
        throw redirect({ to: '/t/$slug', params: { slug: tenant.slug } })
      }
      return destinations
    } catch (error) {
      if (error instanceof Response && error.status === 401) {
        return { mode: 'landing' as const }
      }
      throw error
    }
  },
  component: TenantPicker,
})

function TenantPicker() {
  const data = Route.useLoaderData()
  const locale = useLocale(DEFAULT_LOCALE)
  const t = createTranslator(locale)

  if (!('tenants' in data)) return <MarketingLanding />
  const { tenants } = data

  return (
    <AppShellFrame
      className="st-app-frame st-saas-frame"
      contentClassName="mx-auto max-w-5xl p-4 sm:p-6"
      header={
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="st-saas-brand-mark lg:hidden">
            <Utensils className="size-3" />
          </span>
          <p className="st-saas-breadcrumb truncate text-xs">{t('app.myRestaurants')}</p>
        </div>
      }
      headerClassName="st-saas-header flex h-11 items-center justify-between px-5 sm:px-6"
      locale={DEFAULT_LOCALE}
      mainClassName="st-saas-main min-w-0 flex-1"
      mobileTabs={null}
      sidebar={
        <>
          <Link
            className="st-saas-brand flex items-center gap-2 px-1.5 py-1.5 text-sm font-semibold tracking-tight"
            to="/"
          >
            <span className="st-saas-brand-mark">
              <Utensils className="size-3.5" />
            </span>
            <span className="font-semibold tracking-[-0.03em]">SobreTaula</span>
          </Link>
          <CurrentUserSidebar />
        </>
      }
      sidebarClassName="st-saas-sidebar hidden w-56 p-3 lg:flex lg:h-svh lg:flex-col"
    >
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>
            {tenants.length === 0 ? t('tenant.noAccess.title') : t('tenant.choose.title')}
          </PageHeaderTitle>
          <PageHeaderDescription>
            {tenants.length === 0
              ? t('tenant.noAccess.description')
              : t('tenant.choose.description')}
          </PageHeaderDescription>
        </div>
      </PageHeader>

      {tenants.length === 0 && (
        <Card className="mt-6">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-medium">{t('tenant.noRestaurants.title')}</p>
              <p className="text-muted-foreground text-sm">
                {t('tenant.noRestaurants.description')}
              </p>
            </div>
            <Link
              className="bg-primary text-primary-foreground inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium shadow-sm"
              to="/onboarding"
            >
              {t('tenant.configure')} <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      )}

      {tenants.length > 1 && (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {tenants.map((tenant) => (
            <li key={tenant.slug}>
              <Link
                className="border-border/80 hover:border-primary/35 hover:bg-secondary bg-card flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium shadow-[var(--ui-shadow-hairline)] transition-colors"
                params={{ slug: tenant.slug }}
                to="/t/$slug"
              >
                <span className="flex items-center gap-3">
                  <Building2 className="text-primary size-4" />
                  {tenant.name}
                </span>
                <ArrowRight className="text-muted-foreground size-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShellFrame>
  )
}

const marketingModules = [
  {
    key: 'core',
    icon: Utensils,
    outcome: 'Trabaja cada servicio con menos fricción.',
  },
  {
    key: 'inventory',
    icon: Boxes,
    outcome: 'Sabe qué te cuesta cada plato y cuándo comprar.',
  },
  {
    key: 'reservations_pro',
    icon: CalendarDays,
    outcome: 'Llena mesas y reduce los no-shows.',
  },
  {
    key: 'analytics',
    icon: ChartNoAxesCombined,
    outcome: 'Descubre qué platos y trabajadores son más rentables.',
  },
  {
    key: 'loyalty',
    icon: Users,
    outcome: 'Convierte visitas puntuales en clientes habituales.',
  },
  {
    key: 'finance',
    icon: CircleDollarSign,
    outcome: 'Ten la caja y la facturación bajo control.',
  },
  {
    key: 'workforce',
    icon: ClipboardList,
    outcome: 'Organiza turnos, fichajes y propinas.',
  },
] as const

function MarketingLanding() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,var(--color-primary)/12,transparent_38%),var(--color-background)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link className="flex items-center gap-2 font-semibold tracking-tight" to="/">
          <span className="st-saas-brand-mark">
            <Utensils className="size-3.5" />
          </span>
          SobreTaula
        </Link>
        <div className="flex items-center gap-2">
          <Link className="rounded-lg px-3 py-2 text-sm font-medium" to="/login">
            Entrar
          </Link>
          <Link
            className="bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium shadow-sm"
            to="/registro"
          >
            Probar SobreTaula
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-5 pt-12 pb-14 sm:px-8 sm:pt-20">
        <div className="max-w-3xl">
          <Badge variant="neutral">Modular. Sin cambiarlo todo.</Badge>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
            Añade solo lo que tu restaurante necesita.
          </h1>
          <p className="text-muted-foreground mt-5 max-w-2xl text-lg leading-8">
            Empieza con una operativa sencilla y añade inventario, reservas, estadísticas o puntos
            de clientes cuando te aporten valor. SobreTaula crece contigo, sin obligarte a sustituir
            lo que ya funciona.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              className="bg-primary text-primary-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-medium shadow-sm"
              to="/registro"
            >
              Crea tu restaurante <ArrowRight className="size-4" />
            </Link>
            <a
              className="border-border bg-card inline-flex items-center rounded-lg border px-4 py-2.5 font-medium"
              href="#modulos"
            >
              Ver módulos
            </a>
          </div>
        </div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" id="modulos">
          {marketingModules.map(({ key, icon: Icon, outcome }) => {
            const definition = MODULE_DEFINITIONS[key]
            return (
              <Card
                className={cn(key === 'core' && 'border-primary/40 ring-primary/10 ring-2')}
                key={key}
              >
                <CardContent className="pt-6">
                  <Icon className="text-primary size-5" />
                  <p className="mt-4 font-semibold">{definition.label}</p>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">{outcome}</p>
                  <p className="text-muted-foreground mt-3 text-xs leading-5">
                    {definition.description}
                  </p>
                  <Link
                    className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium"
                    to="/registro"
                  >
                    Añadir este módulo <ArrowRight className="size-3.5" />
                  </Link>
                </CardContent>
              </Card>
            )
          })}
        </div>
        <section className="border-border bg-card mt-14 grid gap-6 rounded-2xl border p-6 sm:grid-cols-[1.2fr_1fr] sm:p-8">
          <div>
            <p className="text-primary text-sm font-semibold">La decisión es tuya</p>
            <h2 className="mt-2 text-2xl font-semibold">
              No pagues por una transformación que no necesitas.
            </h2>
            <p className="text-muted-foreground mt-3 leading-7">
              Puedes conservar tu TPV actual y empezar por un módulo concreto. Si mañana quieres
              conocer tu margen real o automatizar las reservas, lo activas sin migraciones
              traumáticas.
            </p>
          </div>
          <div className="bg-secondary/60 rounded-xl p-5">
            <p className="font-medium">Ejemplo: Estadística Avanzada</p>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
              “¿Qué trabajador te sale más rentable?” “¿Qué plato vende mucho pero apenas deja
              margen?” Respuestas accionables a partir de tus propios datos.
            </p>
            <Link
              className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium"
              to="/registro"
            >
              Descubrir estadísticas <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </section>
      </section>
    </main>
  )
}
