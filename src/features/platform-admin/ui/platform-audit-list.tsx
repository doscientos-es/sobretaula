import type { PlatformAuditEvent } from '../domain/platform-audit'
import { platformAuditActionLabel } from '../domain/platform-audit'

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

/** Renders immutable audit events in chronological order. */
export function PlatformAuditList({
  emptyDescription,
  events,
}: {
  emptyDescription: string
  events: readonly PlatformAuditEvent[]
}) {
  if (events.length === 0)
    return <p className="text-muted-foreground text-sm">{emptyDescription}</p>

  return (
    <ol className="divide-border/70 divide-y">
      {events.map((event) => (
        <li
          className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6"
          key={event.id}
        >
          <div>
            <p className="font-medium">{platformAuditActionLabel(event.action)}</p>
            <p className="text-muted-foreground mt-1">{event.summary}</p>
          </div>
          <p className="text-muted-foreground text-xs sm:text-right">
            {event.actor} · {event.target}
            <br />
            {dateTime.format(new Date(event.createdAt))}
          </p>
        </li>
      ))}
    </ol>
  )
}
