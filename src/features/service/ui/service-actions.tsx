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
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  createCloseSessionOperation,
  createMergeSessionsOperation,
  createMoveSessionOperation,
  createSeatWalkInOperation,
  createServiceOfflineStore,
  enqueueServiceOperation,
} from '../application/service-offline-operations'
import {
  closeSession,
  cleanTables,
  mergeSessions,
  moveSession,
  seatWalkIn,
  updateSessionNote,
  updateTableBlock,
  updateAreaStaff,
} from '../application/table-service'
import {
  inspectServiceTableGroupPreset,
  sessionElapsedMinutes,
  sessionPacingState,
  suggestTableCombination,
  type ServiceBoard,
} from '../domain/service-board'
import { describeSession } from './service-labels'

/** Everything the host does with the tables already selected on the plan. */
export function ServiceActions({
  board,
  onDone,
  selectedTableIds,
  onSuggest,
  areaOpen = true,
  isOnline = true,
  tenantId,
  venueId,
  now,
}: {
  board: ServiceBoard
  onDone: () => void
  selectedTableIds: readonly string[]
  onSuggest: (tableIds: readonly string[]) => void
  areaOpen?: boolean
  isOnline?: boolean
  tenantId: string
  venueId: string
  now?: Date
}) {
  const feedback = useFormFeedback()
  const offlineStore = useMemo(
    () => createServiceOfflineStore(tenantId, venueId),
    [tenantId, venueId],
  )
  const params = useParams({ strict: false })
  const [covers, setCovers] = useState(2)
  const [sessionId, setSessionId] = useState(board.sessions[0]?.id ?? '')
  const [mergeSourceId, setMergeSourceId] = useState(board.sessions[1]?.id ?? '')
  const selectedSession = board.sessions.find((session) => session.id === sessionId)
  const pacingNow = now ?? new Date()
  const [internalNote, setInternalNote] = useState(selectedSession?.internalNote ?? '')
  const [blockReason, setBlockReason] = useState('')
  const selectedTables = board.tables.filter((table) => selectedTableIds.includes(table.id))
  const selectedBlocked =
    selectedTables.length > 0 && selectedTables.every((table) => table.status === 'blocked')
  const selectedCleaning =
    selectedTables.length > 0 && selectedTables.every((table) => table.status === 'cleaning')
  const selectedAreaId = selectedTables.length > 0 ? selectedTables[0]?.areaId : undefined
  const selectedAreaConsistent = selectedTables.every((table) => table.areaId === selectedAreaId)
  const [assignedStaff, setAssignedStaff] = useState<string[]>(
    selectedAreaId ? [...(board.areaStaffAssignments?.[selectedAreaId] ?? [])] : [],
  )
  useEffect(() => {
    setAssignedStaff(
      selectedAreaId ? [...(board.areaStaffAssignments?.[selectedAreaId] ?? [])] : [],
    )
  }, [board.areaStaffAssignments, selectedAreaId])
  const selectedCapacity = selectedTables.reduce((total, table) => total + table.maxSeats, 0)
  const selectedMinimum = selectedTables.reduce((total, table) => total + table.minSeats, 0)
  const suggestedIds =
    selectedTableIds.length === 0 ? suggestTableCombination(board.tables, covers) : undefined
  const suggestedCodes = suggestedIds
    ?.map((id) => board.tables.find((table) => table.id === id)?.code)
    .filter(Boolean)

  async function run(action: () => Promise<unknown>, message: string) {
    if (feedback.pending) return
    if (!isOnline) {
      feedback.setError('Sin conexión: recupera la red antes de modificar la sala.')
      return
    }
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
    if (!isOnline) {
      enqueueServiceOperation(
        offlineStore,
        createSeatWalkInOperation({
          covers,
          tableIds: [...selectedTableIds],
          tenantId,
          venueId,
        }),
      )
      feedback.setSuccess('Walk-in guardado. Se sentará automáticamente al recuperar la conexión.')
      return
    }
    void run(
      () => seatWalkIn({ data: { covers, tableIds: [...selectedTableIds], tenantId, venueId } }),
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
        {selectedTableIds.length > 0 && (
          <p className="text-muted-foreground text-xs">
            Capacidad combinada: {selectedMinimum}–{selectedCapacity} comensales
          </p>
        )}
        {selectedCleaning && (
          <Button
            disabled={feedback.pending || !isOnline}
            onClick={() =>
              void run(
                () => cleanTables({ data: { tableIds: [...selectedTableIds], tenantId, venueId } }),
                'No se han podido marcar las mesas como limpias.',
              )
            }
            type="button"
          >
            Marcar como limpias
          </Button>
        )}
        {selectedAreaId && selectedAreaConsistent && (board.staff?.length ?? 0) > 0 && (
          <form
            className="grid gap-2 border-t pt-6"
            onSubmit={(event) => {
              event.preventDefault()
              void run(
                () =>
                  updateAreaStaff({
                    data: { areaId: selectedAreaId, tenantId, userIds: assignedStaff, venueId },
                  }),
                'No se ha podido guardar el equipo de la sección.',
              )
            }}
          >
            <Field>
              <FieldLabel htmlFor="area-staff">Equipo de esta sección</FieldLabel>
              <select
                id="area-staff"
                multiple
                onChange={(event) =>
                  setAssignedStaff([...event.target.selectedOptions].map((option) => option.value))
                }
                value={assignedStaff}
              >
                {board.staff?.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Button disabled={feedback.pending || !isOnline} type="submit" variant="outline">
              Guardar equipo de la sección
            </Button>
          </form>
        )}
        {suggestedCodes && suggestedCodes.length > 0 && (
          <div className="space-y-2">
            <p className="text-primary text-xs">
              Sugerencia para {covers} comensales: mesas {suggestedCodes.join(', ')}. Selecciónalas
              en el plano o en la lista.
            </p>
            <Button onClick={() => onSuggest(suggestedIds ?? [])} type="button" variant="outline">
              Seleccionar sugerencia
            </Button>
          </div>
        )}
        {(board.tableGroupPresets?.length ?? 0) > 0 && (
          <div className="border-border grid gap-2 border-t pt-4">
            <p className="text-muted-foreground text-xs">
              Combinaciones guardadas · solo se pueden aplicar si las mesas siguen libres.
            </p>
            {board.tableGroupPresets?.map((preset) => {
              const preflight = inspectServiceTableGroupPreset(preset, board.tables)
              const preflightLabel =
                preflight.reason === 'available'
                  ? 'Disponible'
                  : preflight.reason === 'missing_tables'
                    ? 'Faltan mesas del preset'
                    : preflight.reason === 'occupied'
                      ? 'Hay mesas ocupadas'
                      : 'Supera la capacidad máxima'
              return (
                <div className="grid gap-1" key={preset.id}>
                  <Button
                    aria-label={`${preset.name}: ${preflightLabel}`}
                    disabled={preflight.reason !== 'available'}
                    onClick={() => onSuggest(preset.tableIds)}
                    type="button"
                    variant="outline"
                  >
                    {preset.name} · {preflight.capacity} pax
                  </Button>
                  {preflight.reason !== 'available' ? (
                    <p className="text-muted-foreground text-xs">{preflightLabel}</p>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
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
          <Button
            disabled={
              feedback.pending ||
              !areaOpen ||
              selectedTableIds.length === 0 ||
              covers > selectedCapacity
            }
            type="submit"
          >
            Sentar en las mesas seleccionadas
          </Button>
          {!areaOpen && (
            <p className="text-destructive text-xs">La zona está cerrada temporalmente.</p>
          )}
          {selectedTableIds.length > 1 && covers > selectedCapacity && (
            <p className="text-destructive text-xs" role="alert">
              El grupo supera la capacidad combinada de las mesas seleccionadas.
            </p>
          )}
        </form>
        {selectedTableIds.length > 0 && (
          <form
            className="grid gap-2 border-t pt-6"
            onSubmit={(event) => {
              event.preventDefault()
              void run(
                () =>
                  updateTableBlock({
                    data: {
                      blockReason: selectedBlocked ? null : blockReason.trim(),
                      isBlocked: !selectedBlocked,
                      tableIds: [...selectedTableIds],
                      tenantId,
                      venueId,
                    },
                  }),
                'No se ha podido actualizar el bloqueo de las mesas.',
              )
            }}
          >
            {!selectedBlocked && (
              <Field>
                <FieldLabel htmlFor="table-block-reason">Motivo del bloqueo</FieldLabel>
                <Input
                  id="table-block-reason"
                  maxLength={300}
                  onChange={(event) => setBlockReason(event.target.value)}
                  placeholder="Mantenimiento, avería o reserva interna"
                  required
                  value={blockReason}
                />
              </Field>
            )}
            <Button
              disabled={feedback.pending || !isOnline || (!selectedBlocked && !blockReason.trim())}
              type="submit"
              variant="outline"
            >
              {selectedBlocked ? 'Reabrir mesas' : 'Bloquear mesas'}
            </Button>
          </form>
        )}
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
              <output className="text-muted-foreground text-xs">
                {selectedSession
                  ? `En mesa desde hace ${sessionElapsedMinutes(selectedSession, pacingNow)} min${sessionPacingState(selectedSession, pacingNow) === 'attention' ? ' · revisar pacing' : ''}`
                  : 'Sesión activa'}
              </output>
            )}
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
            {sessionId && (
              <form
                className="grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void run(
                    () =>
                      updateSessionNote({
                        data: {
                          internalNote: internalNote.trim() || null,
                          sessionId,
                          tenantId,
                          venueId,
                        },
                      }),
                    'No se ha podido guardar la nota de la mesa.',
                  )
                }}
              >
                <Field>
                  <FieldLabel htmlFor="session-note">Nota interna de sala</FieldLabel>
                  <Input
                    id="session-note"
                    maxLength={500}
                    onChange={(event) => setInternalNote(event.target.value)}
                    placeholder="Alergia, handover o detalle para el equipo"
                    value={internalNote}
                  />
                </Field>
                <Button disabled={feedback.pending || !isOnline} type="submit" variant="outline">
                  Guardar nota
                </Button>
              </form>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={feedback.pending || !sessionId || selectedTableIds.length === 0}
                onClick={() =>
                  !isOnline
                    ? (enqueueServiceOperation(
                        offlineStore,
                        createMoveSessionOperation({
                          sessionId,
                          tableIds: [...selectedTableIds],
                          tenantId,
                          venueId,
                        }),
                      ),
                      feedback.setSuccess('Movimiento guardado para cuando vuelva la conexión.'))
                    : void run(
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
                    ? !isOnline
                      ? (enqueueServiceOperation(
                          offlineStore,
                          createCloseSessionOperation({ sessionId, tenantId, venueId }),
                        ),
                        feedback.setSuccess('Cierre guardado para cuando vuelva la conexión.'))
                      : void run(
                          () => closeSession({ data: { sessionId, tenantId, venueId } }),
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
                    !isOnline
                      ? (enqueueServiceOperation(
                          offlineStore,
                          createMergeSessionsOperation({
                            sourceSessionId: mergeSourceId,
                            targetSessionId: sessionId,
                            tenantId,
                            venueId,
                          }),
                        ),
                        feedback.setSuccess('Unión guardada para cuando vuelva la conexión.'))
                      : void run(
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
