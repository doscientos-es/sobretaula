import { DEFAULT_LOCALE, type Locale } from './locale'

const es = {
  'app.name': 'SobreTaula',
  'app.tagline': 'Gestión de sala, reservas y facturación',
  'nav.floorPlan': 'Plano',
  'nav.reservations': 'Reservas',
  'nav.invoices': 'Facturas',
  'nav.settings': 'Ajustes',
  'error.title': 'No se ha podido cargar esta pantalla',
  'error.description': 'Reintenta la operación o vuelve al inicio.',
  'error.retry': 'Reintentar',
  'notFound.title': 'Página no encontrada',
  'notFound.description': 'La ruta solicitada no existe en esta aplicación.',
  'common.backHome': 'Volver al inicio',
  'tenant.pick.title': 'Selecciona un restaurante',
  'tenant.pick.description': 'Accede con la ruta de tu restaurante: /t/tu-restaurante',
  'tenant.notFound.title': 'Restaurante no encontrado',
  'tenant.notFound.description': 'Comprueba la dirección o pide acceso al propietario.',
  'invoices.title': 'Facturas',
  'invoices.empty': 'Todavía no hay facturas emitidas.',
  'invoices.env.test': 'Entorno de pruebas VERI*FACTU',
} as const

export type MessageKey = keyof typeof es

const ca: Record<MessageKey, string> = {
  'app.name': 'SobreTaula',
  'app.tagline': 'Gestió de sala, reserves i facturació',
  'nav.floorPlan': 'Plànol',
  'nav.reservations': 'Reserves',
  'nav.invoices': 'Factures',
  'nav.settings': 'Configuració',
  'error.title': 'No s’ha pogut carregar aquesta pantalla',
  'error.description': 'Torna-ho a provar o torna a l’inici.',
  'error.retry': 'Torna-ho a provar',
  'notFound.title': 'Pàgina no trobada',
  'notFound.description': 'La ruta sol·licitada no existeix en aquesta aplicació.',
  'common.backHome': 'Torna a l’inici',
  'tenant.pick.title': 'Tria un restaurant',
  'tenant.pick.description': 'Accedeix amb la ruta del teu restaurant: /t/el-teu-restaurant',
  'tenant.notFound.title': 'Restaurant no trobat',
  'tenant.notFound.description': 'Comprova l’adreça o demana accés al propietari.',
  'invoices.title': 'Factures',
  'invoices.empty': 'Encara no hi ha factures emeses.',
  'invoices.env.test': 'Entorn de proves VERI*FACTU',
}

const messages: Record<Locale, Record<MessageKey, string>> = { ca, es }

export function translate(locale: Locale, key: MessageKey): string {
  return messages[locale][key] ?? messages[DEFAULT_LOCALE][key]
}

export function createTranslator(locale: Locale): (key: MessageKey) => string {
  return (key) => translate(locale, key)
}
