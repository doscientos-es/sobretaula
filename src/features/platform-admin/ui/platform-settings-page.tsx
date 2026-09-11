import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
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
import { useState, type FormEvent } from 'react'

import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import {
  savePlatformFiscalSettings,
  type PlatformFiscalSettings,
} from '../application/platform-settings'

export function PlatformSettingsPage({ settings }: { settings: PlatformFiscalSettings | null }) {
  const feedback = useFormFeedback()
  const reload = useLoaderReload()
  const [issuanceEnabled, setIssuanceEnabled] = useState(settings?.issuanceEnabled ?? false)

  function stringValue(values: FormData, name: string) {
    const value = values.get(name)
    return typeof value === 'string' ? value : ''
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (feedback.pending) return
    const values = new FormData(event.currentTarget)
    const environment = values.get('environment')
    if (environment !== 'test' && environment !== 'prod') {
      feedback.setError('Selecciona un entorno fiscal válido.')
      return
    }
    feedback.setPending()
    void savePlatformFiscalSettings({
      data: {
        addressLine: stringValue(values, 'addressLine'),
        city: stringValue(values, 'city'),
        countryCode: stringValue(values, 'countryCode'),
        environment,
        issuanceEnabled,
        issuerNif: stringValue(values, 'issuerNif'),
        legalName: stringValue(values, 'legalName'),
        postalCode: stringValue(values, 'postalCode'),
        seriesCode: stringValue(values, 'seriesCode'),
      },
    })
      .then(() => {
        feedback.setSuccess('Ajustes fiscales guardados.')
        reload()
      })
      .catch(() => feedback.setError('No se han podido guardar los ajustes fiscales.'))
  }

  return (
    <main className="st-platform-page space-y-6">
      <PageHeader className="border-border/70 border-b pb-6">
        <div>
          <PageHeaderTitle>Ajustes fiscales</PageHeaderTitle>
          <PageHeaderDescription>
            Datos que SobreTaula utiliza para emitir las facturas SaaS a los restaurantes.
          </PageHeaderDescription>
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Identidad de emisión</CardTitle>
          <CardDescription>
            Activa la emisión únicamente cuando los datos fiscales hayan sido comprobados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={save}>
            <Field>
              <FieldLabel htmlFor="platform-legal-name">Razón social</FieldLabel>
              <Input
                defaultValue={settings?.legalName}
                id="platform-legal-name"
                name="legalName"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-nif">NIF</FieldLabel>
              <Input
                defaultValue={settings?.issuerNif}
                id="platform-nif"
                maxLength={9}
                name="issuerNif"
                required
              />
            </Field>
            <Field className="md:col-span-2">
              <FieldLabel htmlFor="platform-address">Dirección</FieldLabel>
              <Input
                defaultValue={settings?.addressLine}
                id="platform-address"
                name="addressLine"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-city">Ciudad</FieldLabel>
              <Input defaultValue={settings?.city} id="platform-city" name="city" required />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="platform-postal-code">Código postal</FieldLabel>
                <Input
                  defaultValue={settings?.postalCode}
                  id="platform-postal-code"
                  name="postalCode"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="platform-country">País</FieldLabel>
                <Input
                  defaultValue={settings?.countryCode ?? 'ES'}
                  id="platform-country"
                  maxLength={2}
                  name="countryCode"
                  required
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="platform-series">Serie</FieldLabel>
              <Input
                defaultValue={settings?.seriesCode ?? 'ST'}
                id="platform-series"
                maxLength={12}
                name="seriesCode"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="platform-environment">Entorno Veri*factu</FieldLabel>
              <Select
                className="w-full"
                defaultSelectedKey={settings?.environment ?? 'test'}
                id="platform-environment"
                name="environment"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectList>
                    <SelectItem id="test">Pruebas</SelectItem>
                    <SelectItem id="prod">Producción</SelectItem>
                  </SelectList>
                </SelectContent>
              </Select>
            </Field>
            <div className="border-border/70 bg-surface-subtle flex items-center justify-between gap-4 rounded-xl border p-4 md:col-span-2">
              <div>
                <Checkbox
                  id="platform-issuance-enabled"
                  isSelected={issuanceEnabled}
                  onChange={setIssuanceEnabled}
                >
                  Emisión automática
                </Checkbox>
                <span className="text-muted-foreground mt-1 block text-sm">
                  Permite crear facturas fiscales SaaS para los cierres de ciclo.
                </span>
              </div>
            </div>
            <div className="md:col-span-2">
              <FormFeedback pendingLabel="Guardando ajustes…" state={feedback.state} />
              <Button className="mt-4" disabled={feedback.pending} type="submit">
                Guardar ajustes fiscales
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
