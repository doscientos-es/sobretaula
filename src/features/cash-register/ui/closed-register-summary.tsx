import { Card, CardContent, CardHeader, CardTitle } from '@doscientos/ui'
export function ClosedRegisterSummary({ history }: { history: readonly { id: unknown; closed_at: unknown; counted_cash_cents: unknown; sales_by_method?: unknown }[] }) {
  const euro = (cents: number) => `${(cents / 100).toFixed(2)} €`
  return <Card><CardHeader><CardTitle>Histórico de cierres</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">{history.map((entry) => <div className="rounded border p-3" key={String(entry.id)}><div className="flex justify-between"><span>{new Date(String(entry.closed_at)).toLocaleString('es-ES')}</span><strong>{euro(Number(entry.counted_cash_cents ?? 0))} contado</strong></div><div className="text-muted-foreground mt-1 flex flex-wrap gap-3">{Object.entries((entry.sales_by_method as Record<string, number> | null) ?? {}).map(([method, amount]) => <span key={method}>{method}: {euro(Number(amount))}</span>)}</div></div>)}</CardContent></Card>
}
