import { Button } from '@doscientos/ui'
import { Link } from '@tanstack/react-router'
import { CalendarCheck2, CircleAlert, MapPin } from 'lucide-react'
import { useState } from 'react'

import { cancelPublicReservation, type PublicReservation } from '../application/public-reservations'

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short' }).format(
    new Date(value),
  )
}

export function PublicReservationManagementPage({
  reservation,
  token,
}: {
  reservation: PublicReservation
  token: string
}) {
  const [current, setCurrent] = useState(reservation)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const cancelled = current.status === 'cancelled'

  async function cancel() {
    if (!window.confirm('¿Seguro que quieres cancelar esta reserva?')) return
    setBusy(true)
    setError('')
    try {
      const result = await cancelPublicReservation({ data: { token } })
      if (!result.cancelled) {
        setError('Esta reserva ya no se puede cancelar.')
        return
      }
      setCurrent({ ...current, status: 'cancelled' })
    } catch {
      setError('No hemos podido cancelar la reserva. Inténtalo de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-[#fbfaf8] p-6">
      <section
        aria-labelledby="manage-title"
        className="relative z-10 w-full max-w-xl rounded-3xl border border-[#292d34]/10 bg-white p-[clamp(2rem,7vw,5rem)] text-center shadow-[0_1.5rem_4rem_rgb(66_48_35_/_12%)]"
      >
        <span
          aria-hidden="true"
          className={`mx-auto grid size-16 place-items-center rounded-full text-white ${cancelled ? 'bg-destructive' : 'bg-success'}`}
        >
          {cancelled ? <CircleAlert className="size-7" /> : <CalendarCheck2 className="size-7" />}
        </span>
        <p className="mt-5 text-xs font-bold tracking-[0.14em] text-[#c34d3e] uppercase">
          {cancelled ? 'Reserva cancelada' : 'Tu reserva'}
        </p>
        <h1
          className="mt-3 text-4xl font-[650] tracking-[-0.075em] text-[#292d34]"
          id="manage-title"
        >
          {current.tenantName}
        </h1>
        <p className="mt-5 text-[#60656d]">
          <MapPin aria-hidden="true" className="mr-1 inline size-4" />
          {current.venueName}
        </p>
        <p className="mt-2 text-[#60656d]">
          {formatDateTime(current.startsAt)} · {current.partySize}{' '}
          {current.partySize === 1 ? 'persona' : 'personas'}
        </p>
        {error && (
          <p aria-live="assertive" className="text-destructive mt-4">
            {error}
          </p>
        )}
        {!cancelled && (
          <Button className="mt-6" disabled={busy} onPress={() => void cancel()} variant="outline">
            Cancelar reserva
          </Button>
        )}
        {cancelled && (
          <p className="mt-6 text-xs leading-5 text-[#737983]">
            La mesa ha quedado disponible para el restaurante.
          </p>
        )}
        <Link
          className="text-primary mt-6 inline-flex text-sm font-semibold underline underline-offset-4"
          to="/"
        >
          Volver al inicio
        </Link>
      </section>
    </main>
  )
}
