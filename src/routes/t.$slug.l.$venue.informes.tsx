import { createFileRoute } from '@tanstack/react-router'
import { getSalesReport } from '@/features/reports'
import { SalesReportPage } from '@/features/reports/ui/sales-report-page'
import { ProductSalesSummary } from '@/features/reports/ui/product-sales-summary'
export const Route = createFileRoute('/t/$slug/l/$venue/informes')({ loader: ({ context }) => getSalesReport({ data: { tenantId: context.tenant.id, venueId: context.venue.id, from: new Date(Date.now() - 86400000).toISOString(), to: new Date().toISOString() } }), component: ReportRoute })
function ReportRoute() { const { tenant, venue } = Route.useRouteContext(); const report = Route.useLoaderData(); return <><SalesReportPage report={report} onRange={(from, to) => getSalesReport({ data: { tenantId: tenant.id, venueId: venue.id, from, to } })} /><ProductSalesSummary products={report.productSummary} /></> }
