import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  FormFeedback,
  Input,
  useFormFeedback,
} from '@doscientos/ui'
import { Link, useParams } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'

import { closeSession, mergeSessions, moveSession, seatWalkIn } from '../application/table-service'
import type { ServiceBoard } from '../domain/service-board'
import { describeSession } from './service-labels'

/** Everything the host does with the tables already selected on the plan. */
export function ServiceActions({
  board,
  onDone,
  selectedTableIds,
  tenantId,
  venueId,
}: {
  board: ServiceBoard
  onDone: () => void
  selectedTableIds: readonly string[]
  tenantId: string
  venueId: string
}) {
  const feedback = useFormFeedback()
  const params = useParams({ strict: false })
  const [covers, setCovers] = useState(2)
  const [sessionId, setSessionId] = useState(board.sessions[0]?.id ?? '')
  const [mergeSourceId, setMergeSourceId] = useState(board.sessions[1]?.id ?? '')

  async function run(action: () => Promise<unknown>, message: string) {
    if (feedback.pending) return
    feedback.setPending()
    try {
      await action()
      onDone()
    } catch {
      feedback.setError(message)
    }
  }

  function walkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (selectedTableIds.length === 0) {
      feedback.setError('Selecciona al menos una mesa en la lista.')
      return
    }
    void run(
      () =>
        seatWalkIn({
          data: { covers, tableIds: [...selectedTableIds], tenantId, venueId },
        }),
      'Esas mesas están ocupadas o no dan para tantos comensales.',
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acciones de sala</CardTitle>
        <CardDescription>
          {selectedTableIds.length === 0
            ? 'Sin mesas seleccionadas.'
            : `${selectedTableIds.length} mesa(s) seleccionada(s).`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="grid gap-3" onSubmit={walkIn}>
          <Field>
            <FieldLabel htmlFor="walk-in-covers">Comensales sin reserva</FieldLabel>
            <Input
              id="walk-in-covers"
              min={1}
              onChange={(event) => setCovers(Number(event.target.value))}
              required
              type="number"
              value={covers}
            />
          </Field>
          <Button disabled={feedback.pending} type="submit">
            Sentar en las mesas seleccionadas
          </Button>
        </form>
        {board.sessions.length > 0 && (
          <div className="space-y-3 border-t pt-6">
            <Field>
              <FieldLabel htmlFor="session-id">Cuenta abierta</FieldLabel>
              <select
                id="session-id"
                onChange={(event) => setSessionId(event.target.value)}
                value={sessionId}
              >
                {board.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {describeSession(session, board.tables)}
                  </option>
                ))}
              </select>
            </Field>
            {sessionId && (
              <Link
                className="text-primary text-sm font-medium underline underline-offset-4"
                params={{
                  sessionId,
                  slug: params.slug ?? '',
                  venue: params.venue ?? '',
                }}
                to="/t/$slug/l/$venue/cuenta/$sessionId"
              >
                Ver cuenta de la sesión seleccionada
              </Link>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={feedback.pending || !sessionId || selectedTableIds.length === 0}
                onClick={() =>
                  void run(
                    () =>
                      moveSession({
                        data: {
                          sessionId,
                          tableIds: [...selectedTableIds],
                          tenantId,
                          venueId,
                        },
                      }),
                    'No se puede mover la cuenta a esas mesas.',
                  )
                }
                type="button"
              >
                Mover a la selección
              </Button>
              <Button
                disabled={feedback.pending || !sessionId}
                onClick={() =>
                  window.confirm('¿Cerrar esta cuenta y liberar sus mesas?')
                    ? void run(
                        () =>
                          closeSession({
                            data: { sessionId, tenantId, venueId },
                          }),
                        'No se ha podido cerrar. Si queda saldo pendiente, cobra la cuenta primero.',
                      )
                    : undefined
                }
                type="button"
              >
                Cerrar cuenta
              </Button>
            </div>
            {board.sessions.length > 1 && (
              <div className="space-y-2">
                <Field>
                  <FieldLabel htmlFor="merge-source">Unir con esta cuenta</FieldLabel>
                  <select
                    id="merge-source"
                    onChange={(event) => setMergeSourceId(event.target.value)}
                    value={mergeSourceId}
                  >
                    {board.sessions
                      .filter((session) => session.id !== sessionId)
                      .map((session) => (
                        <option key={session.id} value={session.id}>
                          {describeSession(session, board.tables)}
                        </option>
                      ))}
                  </select>
                </Field>
                <Button
                  disabled={feedback.pending || !sessionId || mergeSourceId === sessionId}
                  onClick={() =>
                    void run(
                      () =>
                        mergeSessions({
                          data: {
                            sourceSessionId: mergeSourceId,
                            targetSessionId: sessionId,
                            tenantId,
                            venueId,
                          },
                        }),
                      'No se han podido unir las cuentas.',
                    )
                  }
                  type="button"
                >
                  Unir cuentas
                </Button>
              </div>
            )}
          </div>
        )}
        <FormFeedback pendingLabel="Actualizando sala…" state={feedback.state} />
      </CardContent>
    </Card>
  )
}
