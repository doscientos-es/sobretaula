import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@doscientos/ui'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Minus } from 'lucide-react'

import type { getVenueBenchmark } from '../application/benchmark'
export function VenueBenchmarkCard({
  benchmark,
}: {
  benchmark: Awaited<ReturnType<typeof getVenueBenchmark>>
}) {
  const euro = (value: number) => `${(value / 100).toFixed(2)} €`
  const marginTone = (value: number) =>
    value > 0 ? 'bg-success/5 text-success' : value < 0 ? 'bg-destructive/5 text-destructive' : ''
  return (
    <Card>
      <CardHeader className="px-4 py-3">
        <CardTitle>Comparativa de locales</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {benchmark.length ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 bg-muted/50 hover:bg-muted/50">
                  <TableHead>#</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Ventas</TableHead>
                  <TableHead>Margen</TableHead>
                  <TableHead>Merma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {benchmark.map((venue) => (
                  <TableRow className={marginTone(venue.contributionPercent)} key={venue.venueId}>
                    <TableCell>{venue.rank}</TableCell>
                    <TableCell className="font-medium">{venue.venueName}</TableCell>
                    <TableCell className="tabular-nums">{euro(venue.netSalesCents)}</TableCell>
                    <TableCell
                      className={`tabular-nums ${
                        venue.contributionPercent > 0
                          ? 'text-success'
                          : venue.contributionPercent < 0
                            ? 'text-destructive'
                            : 'text-muted-foreground'
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        {venue.contributionPercent > 0 ? (
                          <ArrowUpRight aria-hidden="true" className="size-4" />
                        ) : venue.contributionPercent < 0 ? (
                          <ArrowDownRight aria-hidden="true" className="size-4" />
                        ) : (
                          <Minus aria-hidden="true" className="size-4" />
                        )}
                        {venue.contributionPercent.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell
                      className={`tabular-nums ${venue.wastePercent > 0 ? 'text-warning' : 'text-success'}`}
                    >
                      <span className="flex items-center gap-1.5">
                        {venue.wastePercent > 0 ? (
                          <AlertTriangle aria-hidden="true" className="size-4" />
                        ) : (
                          <CheckCircle2 aria-hidden="true" className="size-4" />
                        )}
                        {venue.wastePercent.toFixed(1)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No hay datos suficientes para comparar locales.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
