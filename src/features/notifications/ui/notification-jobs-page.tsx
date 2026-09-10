import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
} from '@doscientos/ui'
import { useEffect, useState } from 'react'

import {
  getNotificationJobs,
  requeueNotificationJob,
  type NotificationJobSummary,
} from '../application/notification-jobs'

const labels: Record<string, string> = {
  pending: 'Pendiente',
  processing: 'Procesando',
  sent: 'Enviado',
  failed: 'Fallido',
  cancelled: 'Cancelado',
}
export function NotificationJobsPage({ tenantId }: { tenantId: string }) {
  const [jobs, setJobs] = useState<NotificationJobSummary[]>([])
  useEffect(() => {
    void getNotificationJobs({ data: { tenantId } }).then(setJobs)
  }, [tenantId])
  return (
    <section className="space-y-6">
      <PageHeader>
        <PageHeaderTitle>Comunicaciones</PageHeaderTitle>
        <PageHeaderDescription>
          Estado de confirmaciones y recordatorios. El contenido del mensaje nunca se muestra aquí.
        </PageHeaderDescription>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Cola reciente</CardTitle>
          <CardDescription>{jobs.length} trabajos</CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length ? (
            <ul className="divide-border divide-y">
              {jobs.map((job) => (
                <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={job.id}>
                  <div>
                    <p className="font-medium">
                      {job.type} · {job.channel}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Programado {new Date(job.scheduledFor).toLocaleString()} · {job.attempts}{' '}
                      intentos
                    </p>
                    {job.lastError ? (
                      <p className="text-destructive text-xs">{job.lastError}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-muted rounded-full px-2 py-1 text-xs">
                      {labels[job.status] ?? job.status}
                    </span>
                    {job.status === 'failed' ? (
                      <button
                        className="text-primary text-xs underline"
                        onClick={() =>
                          void requeueNotificationJob({ data: { tenantId, jobId: job.id } }).then(
                            () => void getNotificationJobs({ data: { tenantId } }).then(setJobs),
                          )
                        }
                        type="button"
                      >
                        Reintentar
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No hay trabajos de comunicación.</p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
