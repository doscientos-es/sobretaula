import { Tabs, TabsContent, TabsList, TabsPanels, TabsTrigger } from '@doscientos/ui'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { recommendationHistoryQuery } from '@/features/ai-operations'
import { venueBenchmarkQuery, VenueBenchmarkCard } from '@/features/multi-venue'
import { getSalesReport, salesReportQuery } from '@/features/reports'
import { ProductSalesSummary } from '@/features/reports/ui/product-sales-summary'
import { ProfitCockpit } from '@/features/reports/ui/profit-cockpit'
import { SalesReportPage } from '@/features/reports/ui/sales-report-page'
import { getZonedWeekBounds } from '@/shared/lib/date/zoned-time'
export const Route = createFileRoute('/t/$slug/l/$venue/informes')({
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
  component: ReportRoute,
  ...tenantRouteState,
})
const tenantRoute = getRouteApi('/t/$slug')
function ReportRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const { venue } = Route.useLoaderData()
  const [period] = useState(() => {
    const bounds = getZonedWeekBounds(new Date(), tenant.timezone)
    return { from: bounds.dayStartIso, to: bounds.dayEndIso }
  })
  const [selectedSection, setSelectedSection] = useState('ventas')
  const { from, to } = period
  const report = useQuery({
    ...salesReportQuery({ tenantId: tenant.id, venueId: venue.id, from, to }),
    enabled: ['ventas', 'rentabilidad', 'productos'].includes(selectedSection),
  })
  const benchmark = useQuery({
    ...venueBenchmarkQuery({ tenantId: tenant.id, from, to }),
    enabled: selectedSection === 'locales',
  })
  const recommendationHistory = useQuery({
    ...recommendationHistoryQuery({ tenantId: tenant.id, venueId: venue.id }),
    enabled: selectedSection === 'rentabilidad',
  })
  return (
    <Tabs
      className="space-y-4"
      onSelectionChange={(key) => setSelectedSection(String(key))}
      selectedKey={selectedSection}
    >
      <TabsList aria-label="Secciones de informes" className="max-w-full overflow-x-auto">
        <TabsTrigger id="ventas">Ventas</TabsTrigger>
        <TabsTrigger id="rentabilidad">Rentabilidad</TabsTrigger>
        <TabsTrigger id="productos">Productos</TabsTrigger>
        <TabsTrigger id="locales">Locales</TabsTrigger>
      </TabsList>
      <TabsPanels>
        <TabsContent id="ventas">
          {report.data ? (
            <SalesReportPage
              initialPeriod={period}
              report={report.data}
              timeZone={tenant.timezone}
              onRange={(from, to) =>
                getSalesReport({ data: { tenantId: tenant.id, venueId: venue.id, from, to } })
              }
            />
          ) : (
            <ReportBlockState isError={report.isError} label="el informe de ventas" />
          )}
        </TabsContent>
        <TabsContent id="rentabilidad">
          {report.data ? (
            <ProfitCockpit
              report={report.data}
              tenantId={tenant.id}
              venueId={venue.id}
              recommendationHistory={recommendationHistory.data ?? []}
            />
          ) : (
            <ReportBlockState isError={report.isError} label="la rentabilidad" />
          )}
        </TabsContent>
        <TabsContent id="productos">
          {report.data ? (
            <ProductSalesSummary products={report.data.productSummary} />
          ) : (
            <ReportBlockState isError={report.isError} label="los productos vendidos" />
          )}
        </TabsContent>
        <TabsContent id="locales">
          {benchmark.data ? (
            <VenueBenchmarkCard benchmark={benchmark.data} />
          ) : (
            <ReportBlockState isError={benchmark.isError} label="la comparativa de locales" />
          )}
        </TabsContent>
      </TabsPanels>
    </Tabs>
  )
}

function ReportBlockState({ isError, label }: { isError: boolean; label: string }) {
  return (
    <div
      aria-live="polite"
      className="border-border/70 bg-card text-muted-foreground rounded-xl border p-6 text-sm"
    >
      {isError ? `No se ha podido cargar ${label}.` : `Cargando ${label}…`}
    </div>
  )
}
