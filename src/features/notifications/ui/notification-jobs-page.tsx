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
import { useCallback, useState } from 'react'

import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator, formatMessage } from '@/shared/lib/i18n/messages'
import { useAsyncEffect } from '@/shared/lib/react/use-async-effect'

import {
  getNotificationJobs,
  requeueNotificationJob,
  type NotificationJobSummary,
} from '../application/notification-jobs'

export function NotificationJobsPage({ tenantId }: { tenantId: string }) {
  const locale = useLocale('es')
  const t = createTranslator(locale)
  const [jobs, setJobs] = useState<NotificationJobSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const result = await getNotificationJobs({
        data: { tenantId, page, pageSize: 25 },
      })
      setJobs(result.items)
      setHasMore(result.hasMore)
      setTotal(result.total)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [page, tenantId])

  useAsyncEffect(loadJobs, [loadJobs])

  async function retry(jobId: string) {
    if (retryingJobId) return
    setRetryingJobId(jobId)
    setSuccess('')
    try {
      const requeued = await requeueNotificationJob({
        data: { tenantId, jobId },
      })
      if (!requeued) throw new Error('notification_job_not_requeued')
      setSuccess(t('communications.jobs.retrySuccess'))
      await loadJobs()
    } catch {
      setLoadError(true)
    } finally {
      setRetryingJobId(null)
    }
  }

  function labelForStatus(status: string) {
    switch (status) {
      case 'pending':
        return t('communications.jobs.status.pending')
      case 'processing':
        return t('communications.jobs.status.processing')
      case 'sent':
        return t('communications.jobs.status.sent')
      case 'failed':
        return t('communications.jobs.status.failed')
      case 'cancelled':
        return t('communications.jobs.status.cancelled')
      default:
        return status
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader>
        <PageHeaderTitle>{t('communications.jobs.title')}</PageHeaderTitle>
        <PageHeaderDescription>{t('communications.jobs.description')}</PageHeaderDescription>
      </PageHeader>
      <Card aria-busy={loading || Boolean(retryingJobId)}>
        <CardHeader>
          <CardTitle>{t('communications.jobs.queue')}</CardTitle>
          <CardDescription>
            {loading
              ? t('communications.jobs.loading')
              : formatMessage(locale, 'communications.jobs.count', {
                  count: total,
                })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <div className="space-y-3">
              <p aria-live="assertive" className="text-destructive text-sm">
                {t('communications.jobs.loadError')}
              </p>
              <button
                className="text-primary focus-visible:outline-ring text-sm font-medium underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                disabled={loading}
                onClick={() => void loadJobs()}
                type="button"
              >
                {t('communications.jobs.retry')}
              </button>
            </div>
          ) : loading ? (
            <output aria-live="polite" className="text-muted-foreground block text-sm">
              {t('communications.jobs.loading')}
            </output>
          ) : jobs.length ? (
            <ul className="divide-border divide-y">
              {jobs.map((job) => (
                <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={job.id}>
                  <div>
                    <p className="font-medium">
                      {job.type} · {job.channel}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {formatMessage(locale, 'communications.jobs.scheduled', {
                        date: new Date(job.scheduledFor).toLocaleString(
                          locale === 'ca' ? 'ca-ES' : 'es-ES',
                        ),
                      })}{' '}
                      ·{' '}
                      {formatMessage(locale, 'communications.jobs.attempts', {
                        count: job.attempts,
                      })}
                    </p>
                    {job.lastError ? (
                      <p className="text-destructive text-xs">{job.lastError}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-muted rounded-full px-2 py-1 text-xs">
                      {labelForStatus(job.status)}
                    </span>
                    {job.status === 'failed' ? (
                      <button
                        className="text-primary focus-visible:outline-ring text-xs font-medium underline underline-offset-4 transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
                        disabled={Boolean(retryingJobId)}
                        onClick={() => void retry(job.id)}
                        type="button"
                      >
                        {retryingJobId === job.id
                          ? t('communications.jobs.retrying')
                          : t('communications.jobs.retry')}
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{t('communications.jobs.empty')}</p>
          )}
          {!loading && !loadError ? (
            <div className="mt-4 flex items-center justify-between">
              <button
                className="text-primary text-sm underline disabled:opacity-50"
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
                type="button"
              >
                Anterior
              </button>
              <span className="text-muted-foreground text-sm">Página {page}</span>
              <button
                className="text-primary text-sm underline disabled:opacity-50"
                disabled={!hasMore}
                onClick={() => setPage((current) => current + 1)}
                type="button"
              >
                Siguiente
              </button>
            </div>
          ) : null}
          {success ? (
            <output aria-live="polite" className="text-success mt-4 block text-sm font-medium">
              {success}
            </output>
          ) : null}
        </CardContent>
      </Card>
    </section>
  )
}
