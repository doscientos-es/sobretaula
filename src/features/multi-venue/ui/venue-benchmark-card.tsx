import { Card, CardContent, CardHeader, CardTitle } from '@doscientos/ui'

import type { getVenueBenchmark } from '../application/benchmark'
export function VenueBenchmarkCard({
  benchmark,
}: {
  benchmark: Awaited<ReturnType<typeof getVenueBenchmark>>
}) {
  const euro = (value: number) => `${(value / 100).toFixed(2)} €`
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparativa de locales</CardTitle>
      </CardHeader>
      <CardContent>
        {benchmark.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-2">#</th>
                  <th className="p-2">Local</th>
                  <th className="p-2">Ventas</th>
                  <th className="p-2">Margen</th>
                  <th className="p-2">Merma</th>
                </tr>
              </thead>
              <tbody>
                {benchmark.map((venue) => (
                  <tr className="border-b" key={venue.venueId}>
                    <td className="p-2">{venue.rank}</td>
                    <td className="p-2 font-medium">{venue.venueName}</td>
                    <td className="p-2">{euro(venue.netSalesCents)}</td>
                    <td className="p-2">{venue.contributionPercent.toFixed(1)}%</td>
                    <td className="p-2">{venue.wastePercent.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
