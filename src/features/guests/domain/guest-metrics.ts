export interface GuestReservationMetric {
  guestId: string
  id: string
}
export interface GuestSessionMetric {
  guestId: string
  id: string
  status: string
}
export interface GuestPaymentMetric {
  sessionId: string
  amountCents: number
}

export function calculateGuestMetrics(
  reservations: readonly GuestReservationMetric[],
  sessions: readonly GuestSessionMetric[],
  payments: readonly GuestPaymentMetric[],
) {
  const reservationCounts = new Map<string, number>()
  for (const reservation of reservations)
    reservationCounts.set(
      reservation.guestId,
      (reservationCounts.get(reservation.guestId) ?? 0) + 1,
    )
  const closedSessions = sessions.filter((session) => session.status === 'closed')
  const sessionGuests = new Map(closedSessions.map((session) => [session.id, session.guestId]))
  const visits = new Map<string, number>()
  for (const session of closedSessions)
    visits.set(session.guestId, (visits.get(session.guestId) ?? 0) + 1)
  const spendCents = new Map<string, number>()
  for (const payment of payments) {
    const guestId = sessionGuests.get(payment.sessionId)
    if (guestId) spendCents.set(guestId, (spendCents.get(guestId) ?? 0) + payment.amountCents)
  }
  return { reservationCounts, visits, spendCents }
}
