import {
  AutocompleteCombobox,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@doscientos/ui'
import { useState } from 'react'

import {
  setPlatformModule,
  setTenantModuleOverride,
  type PlatformModule,
} from '../application/module-management'

type Tenant = { id: string; name: string; slug: string }

export function PlatformModulesPage({
  initialModules,
  tenants,
}: {
  initialModules: PlatformModule[]
  tenants: Tenant[]
}) {
  const [modules, setModules] = useState(initialModules)
  const [selectedTenant, setSelectedTenant] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState<string | null>(null)

  async function saveModule(module: PlatformModule) {
    if (saving) return
    setSaving(module.code)
    setMessage('')
    try {
      await setPlatformModule({
        data: {
          code: module.code,
          description: module.description,
          isActive: module.isActive,
          monthlyPriceCents: module.monthlyPriceCents,
          name: module.name,
        },
      })
      setMessage(`Módulo ${module.name} guardado.`)
    } catch {
      setMessage('No se pudo guardar el módulo. Comprueba la conexión e inténtalo de nuevo.')
    } finally {
      setSaving(null)
    }
  }

  async function toggleTenantModule(module: PlatformModule, enabled: boolean) {
    if (!selectedTenant || saving) return
    setSaving(`${selectedTenant}:${module.code}`)
    setMessage('')
    try {
      await setTenantModuleOverride({
        data: { enabled, moduleCode: module.code, tenantId: selectedTenant },
      })
      setMessage(`${module.name} ${enabled ? 'activado' : 'desactivado'} para el tenant.`)
    } catch {
      setMessage('No se pudo cambiar el módulo del tenant.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <main className="st-platform-page space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Módulos y precios</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Gestiona el catálogo comercial y concede excepciones a restaurantes concretos.
        </p>
      </header>
      {message && (
        <output aria-live="polite" className="bg-muted block rounded-lg px-3 py-2 text-sm">
          {message}
        </output>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Catálogo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {modules.map((module) => (
            <div
              className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              key={module.code}
            >
              <div>
                <p className="font-medium">{module.name}</p>
                <p className="text-muted-foreground text-sm">{module.description}</p>
                <code className="text-muted-foreground text-xs">{module.code}</code>
              </div>
              <Input
                aria-label={`Precio de ${module.name} en céntimos`}
                className="w-32"
                min="0"
                onChange={(event) =>
                  setModules((current) =>
                    current.map((item) =>
                      item.code === module.code
                        ? { ...item, monthlyPriceCents: Number(event.target.value) || 0 }
                        : item,
                    ),
                  )
                }
                type="number"
                value={module.monthlyPriceCents}
              />
              <div className="flex gap-2">
                <Button
                  disabled={saving !== null}
                  onClick={() => void saveModule(module)}
                  size="sm"
                >
                  {saving === module.code ? 'Guardando…' : 'Guardar'}
                </Button>
                <Button
                  disabled={saving !== null}
                  onClick={() =>
                    setModules((current) =>
                      current.map((item) =>
                        item.code === module.code ? { ...item, isActive: !item.isActive } : item,
                      ),
                    )
                  }
                  size="sm"
                  variant="outline"
                >
                  {module.isActive ? 'Activo' : 'Inactivo'}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Activación por tenant</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AutocompleteCombobox
            aria-label="Tenant"
            emptyState="No hay tenants que coincidan."
            getItemKey={(tenant) => tenant.id}
            getItemLabel={(tenant) => `${tenant.name} · ${tenant.slug}`}
            items={tenants}
            onSelectionChange={(key) => setSelectedTenant(key ? String(key) : '')}
            placeholder="Buscar tenant…"
            selectedKey={selectedTenant || null}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {modules
              .filter((module) => module.isAddon)
              .map((module) => (
                <div
                  className="border-border flex items-center justify-between rounded-lg border p-3"
                  key={module.code}
                >
                  <span className="text-sm font-medium">{module.name}</span>
                  <div className="flex gap-2">
                    <Button
                      disabled={!selectedTenant || saving !== null}
                      onClick={() => void toggleTenantModule(module, true)}
                      size="sm"
                    >
                      {saving === `${selectedTenant}:${module.code}` ? 'Actualizando…' : 'Activar'}
                    </Button>
                    <Button
                      disabled={!selectedTenant || saving !== null}
                      onClick={() => void toggleTenantModule(module, false)}
                      size="sm"
                      variant="outline"
                    >
                      {saving === `${selectedTenant}:${module.code}`
                        ? 'Actualizando…'
                        : 'Desactivar'}
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
