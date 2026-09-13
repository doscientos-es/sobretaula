import { createFileRoute, notFound } from '@tanstack/react-router'

import { listRecommendationDecisions } from '@/features/ai-operations'
import { getVenueBenchmark, VenueBenchmarkCard } from '@/features/multi-venue'
import { getSalesReport } from '@/features/reports'
import { ProductSalesSummary } from '@/features/reports/ui/product-sales-summary'
import { ProfitCockpit } from '@/features/reports/ui/profit-cockpit'
import { SalesReportPage } from '@/features/reports/ui/sales-report-page'
import { loadVenueRouteContext } from '@/features/venues'
export const Route = createFileRoute('/t/$slug/l/$venue/informes')({
  loader: async ({ params }) => {
    const routeContext = await loadVenueRouteContext(params.slug, params.venue)
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
    <>
      <SalesReportPage
        report={report}
        onRange={(from, to) =>
          getSalesReport({ data: { tenantId: tenant.id, venueId: venue.id, from, to } })
        }
      />
      <ProfitCockpit
        report={report}
        tenantId={tenant.id}
        venueId={venue.id}
        recommendationHistory={recommendationHistory}
      />
      <ProductSalesSummary products={report.productSummary} />
      <VenueBenchmarkCard benchmark={benchmark} />
    </>
  )
}
