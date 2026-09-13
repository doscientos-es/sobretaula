import { Tabs, TabsContent, TabsList, TabsPanels, TabsTrigger } from '@doscientos/ui'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { listRecommendationDecisions } from '@/features/ai-operations'
import { getVenueBenchmark, VenueBenchmarkCard } from '@/features/multi-venue'
import { getSalesReport } from '@/features/reports'
import { ProductSalesSummary } from '@/features/reports/ui/product-sales-summary'
import { ProfitCockpit } from '@/features/reports/ui/profit-cockpit'
import { SalesReportPage } from '@/features/reports/ui/sales-report-page'
import { loadVenueRouteContext } from '@/features/venues'
export const Route = createFileRoute('/t/$slug/l/$venue/informes')({
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    const benchmark = await getVenueBenchmark({
      data: {
        tenantId: tenant.id,
        from: new Date(Date.now() - 86400000).toISOString(),
        to: new Date().toISOString(),
      },
    })
    return {
      benchmark,
      recommendationHistory: await listRecommendationDecisions({
        data: { tenantId: tenant.id, venueId: venue.id },
      }),
      report: await getSalesReport({
        data: {
          tenantId: tenant.id,
          venueId: venue.id,
          from: new Date(Date.now() - 86400000).toISOString(),
          to: new Date().toISOString(),
        },
      }),
      tenant,
      venue,
    }
  },
  component: ReportRoute,
})
function ReportRoute() {
  const { report, benchmark, recommendationHistory, tenant, venue } = Route.useLoaderData()
  return (
    <Tabs className="space-y-4" defaultSelectedKey="ventas">
      <TabsList aria-label="Secciones de informes" className="max-w-full overflow-x-auto">
        <TabsTrigger id="ventas">Ventas</TabsTrigger>
        <TabsTrigger id="rentabilidad">Rentabilidad</TabsTrigger>
        <TabsTrigger id="productos">Productos</TabsTrigger>
        <TabsTrigger id="locales">Locales</TabsTrigger>
      </TabsList>
      <TabsPanels>
        <TabsContent id="ventas">
          <SalesReportPage
            report={report}
            onRange={(from, to) =>
              getSalesReport({ data: { tenantId: tenant.id, venueId: venue.id, from, to } })
            }
          />
        </TabsContent>
        <TabsContent id="rentabilidad">
          <ProfitCockpit
            report={report}
            tenantId={tenant.id}
            venueId={venue.id}
            recommendationHistory={recommendationHistory}
          />
        </TabsContent>
        <TabsContent id="productos">
          <ProductSalesSummary products={report.productSummary} />
        </TabsContent>
        <TabsContent id="locales">
          <VenueBenchmarkCard benchmark={benchmark} />
        </TabsContent>
      </TabsPanels>
    </Tabs>
  )
}
