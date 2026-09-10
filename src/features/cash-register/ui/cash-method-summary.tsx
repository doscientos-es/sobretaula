import { Card, CardContent, CardHeader, CardTitle } from '@doscientos/ui'
export function CashMethodSummary({ salesByMethod }: { salesByMethod: Readonly<Record<string, number>> }) {
  const euro = (cents: number) => `${(cents / 100).toFixed(2)} €`
  return <Card><CardHeader><CardTitle>Cobros del turno por método</CardTitle></CardHeader><CardContent><dl className="grid gap-2 text-sm sm:grid-cols-2">{Object.entries(salesByMethod).map(([method, amount]) => <div className="flex justify-between" key={method}><dt>{method}</dt><dd>{euro(amount)}</dd></div>)}</dl></CardContent></Card>
}
