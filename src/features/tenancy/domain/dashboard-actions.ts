interface TenantDashboardActionBase {
  id: string
  venueId: string
}

export type TenantDashboardAction =
  | (TenantDashboardActionBase & {
      kind: 'open_session'
      openedAt: string
    })
  | (TenantDashboardActionBase & {
      kind: 'pending_reservation'
      partySize: number
      startsAt: string
    })

interface PendingReservation {
  id: string
  partySize: number
  startsAt: string
  venueId: string
}

interface OpenSession {
  id: string
  openedAt: string
  venueId: string
}

/** Prioritizes reservations awaiting confirmation before active table sessions. */
export function getDashboardActions({
  openSessions,
  pendingReservations,
}: {
  openSessions: readonly OpenSession[]
  pendingReservations: readonly PendingReservation[]
}): TenantDashboardAction[] {
  return [
    ...pendingReservations.map((reservation) => ({
      id: reservation.id,
      kind: 'pending_reservation' as const,
      partySize: reservation.partySize,
      startsAt: reservation.startsAt,
      venueId: reservation.venueId,
    })),
    ...openSessions.map((session) => ({
      id: session.id,
      kind: 'open_session' as const,
      openedAt: session.openedAt,
      venueId: session.venueId,
    })),
  ].slice(0, 3)
}
