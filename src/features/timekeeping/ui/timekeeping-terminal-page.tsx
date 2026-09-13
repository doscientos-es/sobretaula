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
  PageHeader,
  PageHeaderDescription,
  PageHeaderTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
  useFormFeedback,
} from '@doscientos/ui'
import { useState } from 'react'

import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { createTranslator } from '@/shared/lib/i18n/messages'

import { recordTerminalTimeEvent } from '../application/timekeeping'
import type { TimeEventType } from '../domain/timekeeping'

const actions: TimeEventType[] = ['clock_in', 'break_start', 'break_end', 'clock_out']

function terminalStorageKey(tenantId: string, venueId: string): string {
  return `sobretaula:timekeeping-terminal:${tenantId}:${venueId}`
}

function getTerminalId(tenantId: string, venueId: string): string {
  const key = terminalStorageKey(tenantId, venueId)
  const fallback = `web-${crypto.randomUUID()}`
  try {
    const saved = window.localStorage.getItem(key)
    if (saved) return saved
    window.localStorage.setItem(key, fallback)
  } catch {
    // El límite adicional por empleado se mantiene aunque el navegador bloquee storage.
  }
  return fallback
}

function terminalError(error: unknown, t: ReturnType<typeof createTranslator>): string {
  if (error instanceof Response) {
    if (error.status === 401) return t('timekeeping.terminal.invalidPin')
    if (error.status === 409) return t('timekeeping.terminal.invalidAction')
    if (error.status === 429) return t('timekeeping.terminal.locked')
  }
  return t('timekeeping.terminal.clockError')
}

/** Shared, authenticated venue terminal. The employee PIN is never retained in browser storage. */
export function TimekeepingTerminalPage({
  staff,
  tenantId,
  venueId,
}: {
  staff: readonly { displayName: string; role: string; userId: string }[]
  tenantId: string
  venueId: string
}) {
  const locale = useLocale('es')
  const t = createTranslator(locale)
  const feedback = useFormFeedback()
  const [employeeId, setEmployeeId] = useState(staff[0]?.userId ?? '')
  const [pin, setPin] = useState('')

  async function clock(eventType: TimeEventType) {
    if (!employeeId || !pin) {
      feedback.setError(t('timekeeping.terminal.missingCredentials'))
      return
    }
    feedback.setPending()
    try {
      const terminalId = getTerminalId(tenantId, venueId)
      await recordTerminalTimeEvent({
        data: { employeeId, eventType, pin, tenantId, terminalId, venueId },
      })
      setPin('')
      feedback.setSuccess(t('timekeeping.terminal.clockSuccess'))
    } catch (error) {
      feedback.setError(terminalError(error, t))
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader>
        <div>
          <PageHeaderTitle>{t('timekeeping.terminal.title')}</PageHeaderTitle>
          <PageHeaderDescription>{t('timekeeping.terminal.description')}</PageHeaderDescription>
        </div>
      </PageHeader>
      <Card aria-busy={feedback.pending} className="max-w-xl">
        <CardHeader>
          <CardTitle>{t('timekeeping.terminal.cardTitle')}</CardTitle>
          <CardDescription>{t('timekeeping.terminal.cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <FieldLabel htmlFor="terminal-employee">
              {t('timekeeping.terminal.employee')}
            </FieldLabel>
            <Select
              isDisabled={feedback.pending}
              id="terminal-employee"
              className="w-full"
              onSelectionChange={(key) => setEmployeeId(String(key))}
              selectedKey={employeeId}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectList>
                  {staff.map((member) => (
                    <SelectItem id={member.userId} key={member.userId}>
                      {member.displayName} · {member.role}
                    </SelectItem>
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="terminal-pin">{t('timekeeping.terminal.pin')}</FieldLabel>
            <Input
              autoComplete="off"
              id="terminal-pin"
              inputMode="numeric"
              maxLength={8}
              disabled={feedback.pending}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
              pattern="[0-9]{4,8}"
              type="password"
              value={pin}
            />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            {actions.map((action) => (
              <Button
                disabled={feedback.pending || staff.length === 0}
                key={action}
                onClick={() => void clock(action)}
                type="button"
                variant={action === 'clock_out' ? 'outline' : 'default'}
              >
                {feedback.pending
                  ? t('timekeeping.terminal.clocking')
                  : t(`timekeeping.action.${action}`)}
              </Button>
            ))}
          </div>
          {staff.length === 0 && (
            <p className="text-muted-foreground text-sm">{t('timekeeping.terminal.noStaff')}</p>
          )}
          <FormFeedback pendingLabel={t('timekeeping.terminal.clocking')} state={feedback.state} />
        </CardContent>
      </Card>
    </section>
  )
}
