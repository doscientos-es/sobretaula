import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  MetricCard,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { CalendarCheck2, Clock3, Euro, Users, type LucideIcon } from 'lucide-react'

import { createTranslator } from '@/shared/lib/i18n/messages'

import type { Tenant } from '../domain/tenant'

export function TenantHomePage({ tenant }: { tenant: Tenant }) {
  const t = createTranslator(tenant.defaultLocale)

  return (
    <section className="space-y-7">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Buenos días</PageHeaderTitle>
          <PageHeaderDescription>
            Esto es lo que está pasando hoy en {tenant.name}.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ['Reservas de hoy', '24', '+12% vs. ayer', CalendarCheck2, '#5aa6ff'],
            ['Mesas ocupadas', '18 / 32', '56% de capacidad', Users, '#ffb946'],
            ['Facturación del día', '1.284 €', '+8,4% vs. ayer', Euro, '#64c59a'],
            ['Próximo servicio', '20:30', 'Cena · 42 comensales', Clock3, '#d29cff'],
          ] as [string, string, string, LucideIcon, string][]
        ).map(([label, value, meta, Icon], index) => (
          <MetricCard
            description={meta}
            icon={<Icon />}
            key={String(label)}
            label={label}
            tone={index === 2 ? 'success' : index === 3 ? 'info' : 'default'}
            value={value}
          />
        ))}
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Actividad reciente</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-border/70 divide-y">
            {[
              ['19:42', 'Reserva confirmada', 'Mesa 14 · 4 personas', 'Hoy'],
              ['19:15', 'Nuevo pedido', 'Mesa 8 · Ensalada de temporada', 'Hoy'],
              ['18:50', 'Factura emitida', 'Ticket #1048 · 86,40 €', 'Hoy'],
            ].map(([time, title, desc, status]) => (
              <div key={time} className="flex items-center gap-4 px-5 py-4">
                <span className="text-muted-foreground w-12 text-xs">{time}</span>
                <span className="bg-primary size-2 rounded-full" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{title}</p>
                  <p className="text-muted-foreground truncate text-sm">{desc}</p>
                </div>
                <span className="text-muted-foreground hidden text-xs sm:block">{status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <p className="text-muted-foreground text-xs">
        {t('app.tagline')} · {tenant.timezone} · Estado: {tenant.status}
      </p>
    </section>
  )
}
