import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormFeedback,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useFormFeedback,
} from '@doscientos/ui'

import type { Locale } from '@/shared/lib/i18n/locale'
import { formatMoney } from '@/shared/lib/money/money'

import { removeOrderItem } from '../application/account'
import { lineGrossCents, type AccountLine } from '../domain/account'

/** Lines already charged to the table, with removal while nothing is paid. */
export function AccountLines({
  canRemove,
  lines,
  locale,
  onDone,
  sessionId,
  tenantId,
  venueId,
}: {
  canRemove: boolean
  lines: readonly AccountLine[]
  locale: Locale
  onDone: () => void
  sessionId: string
  tenantId: string
  venueId: string
}) {
  const feedback = useFormFeedback()

  async function remove(orderItemId: string) {
    if (feedback.pending) return
    feedback.setPending()
    try {
      await removeOrderItem({ data: { orderItemId, sessionId, tenantId, venueId } })
      onDone()
    } catch {
      feedback.setError('No se ha podido quitar la línea. Si ya hay cobros, la cuenta queda fija.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumiciones</CardTitle>
        <CardDescription>
          Precios congelados en el momento de apuntar cada línea.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no se ha apuntado nada.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ud.</TableHead>
                <TableHead>Plato</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>{line.quantity}</TableCell>
                  <TableCell>
                    <span className="whitespace-normal">{line.name}</span>
                    {line.notes && (
                      <span className="text-muted-foreground block text-xs whitespace-normal">
                        {line.notes}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="block text-right tabular-nums">
                      {formatMoney(line.unitPriceCents, locale)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block text-right tabular-nums">
                      {formatMoney(lineGrossCents(line), locale)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {canRemove && (
                      <Button
                        disabled={feedback.pending}
                        onClick={() => void remove(line.id)}
                        size="sm"
                        type="button"
                        variant="ghost"
                      >
                        Quitar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <FormFeedback pendingLabel="Quitando línea…" state={feedback.state} />
      </CardContent>
    </Card>
  )
}
