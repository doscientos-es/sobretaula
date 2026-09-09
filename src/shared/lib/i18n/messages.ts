import { DEFAULT_LOCALE, type Locale } from './locale'

const es = {
  'app.name': 'SobreTaula',
  'app.tagline': 'Gestión de sala, reservas y facturación',
  'nav.floorPlan': 'Plano',
  'nav.service': 'Servicio',
  'nav.reservations': 'Reservas',
  'nav.menu': 'Carta',
  'nav.invoices': 'Facturas',
  'nav.billing': 'Facturación',
  'nav.settings': 'Ajustes',
  'error.title': 'No se ha podido cargar esta pantalla',
  'error.description': 'Reintenta la operación o vuelve al inicio.',
  'error.reassurance': 'Tus datos siguen guardados y no se ha realizado ningún cambio.',
  'error.retry': 'Reintentar',
  'error.help.title': 'Mientras tanto, puedes probar esto',
  'error.help.connection': 'Comprueba que tu conexión a internet funciona.',
  'error.help.retry': 'Espera unos segundos y vuelve a intentarlo.',
  'error.help.support': 'Si continúa ocurriendo, ponte en contacto con tu equipo.',
  'notFound.title': 'Página no encontrada',
  'notFound.description': 'La ruta solicitada no existe en esta aplicación.',
  'common.backHome': 'Volver al inicio',
  'tenant.pick.title': 'Selecciona un restaurante',
  'tenant.pick.description': 'Accede con la ruta de tu restaurante: /t/tu-restaurante',
  'tenant.notFound.title': 'Restaurante no encontrado',
  'tenant.notFound.description': 'Comprueba la dirección o pide acceso al propietario.',
  'venue.section': 'Locales',
  'venue.empty': 'Todavía no hay locales dados de alta.',
  'venue.pick.title': 'Selecciona un local',
  'venue.pick.description': 'Elige el local con el que quieres trabajar.',
  'venue.notFound.title': 'Local no encontrado',
  'venue.notFound.description': 'Este local no existe o no tienes acceso a él.',
  'venue.create.title': 'Añadir local',
  'venue.create.submit': 'Crear local',
  'invoices.title': 'Facturas',
  'invoices.empty': 'Todavía no hay facturas emitidas.',
  'invoices.env.test': 'Entorno de pruebas VERI*FACTU',
} as const

export type MessageKey = keyof typeof es

const ca: Record<MessageKey, string> = {
  'app.name': 'SobreTaula',
  'app.tagline': 'Gestió de sala, reserves i facturació',
  'nav.floorPlan': 'Plànol',
  'nav.service': 'Servei',
  'nav.reservations': 'Reserves',
  'nav.menu': 'Carta',
  'nav.invoices': 'Factures',
  'nav.billing': 'Facturació',
  'nav.settings': 'Configuració',
  'error.title': 'No s’ha pogut carregar aquesta pantalla',
  'error.description': 'Torna-ho a provar o torna a l’inici.',
  'error.reassurance': 'Les teves dades continuen desades i no s’ha fet cap canvi.',
  'error.retry': 'Torna-ho a provar',
  'error.help.title': 'Mentrestant, pots provar això',
  'error.help.connection': 'Comprova que la connexió a internet funciona.',
  'error.help.retry': 'Espera uns segons i torna-ho a provar.',
  'error.help.support': 'Si continua passant, posa’t en contacte amb el teu equip.',
  'notFound.title': 'Pàgina no trobada',
  'notFound.description': 'La ruta sol·licitada no existeix en aquesta aplicació.',
  'common.backHome': 'Torna a l’inici',
  'tenant.pick.title': 'Tria un restaurant',
  'tenant.pick.description': 'Accedeix amb la ruta del teu restaurant: /t/el-teu-restaurant',
  'tenant.notFound.title': 'Restaurant no trobat',
  'tenant.notFound.description': 'Comprova l’adreça o demana accés al propietari.',
  'venue.section': 'Locals',
  'venue.empty': 'Encara no hi ha locals donats d’alta.',
  'venue.pick.title': 'Tria un local',
  'venue.pick.description': 'Tria el local amb què vols treballar.',
  'venue.notFound.title': 'Local no trobat',
  'venue.notFound.description': 'Aquest local no existeix o no hi tens accés.',
  'venue.create.title': 'Afegir local',
  'venue.create.submit': 'Crea el local',
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
