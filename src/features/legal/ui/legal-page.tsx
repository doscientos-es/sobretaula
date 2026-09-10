import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import type { LegalIdentity } from '../application/legal-profiles'

type LegalDocument =
  | 'booking-privacy'
  | 'booking-terms'
  | 'cookies'
  | 'platform-privacy'
  | 'saas-terms'

const updatedAt = '10 de septiembre de 2026'

function Identity({ identity }: { identity: LegalIdentity | null }) {
  if (!identity) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        Esta información legal aún no está configurada. No publiques ni actives la contratación
        hasta completar la identidad y el correo de contacto en los ajustes de plataforma.
      </p>
    )
  }
  return (
    <ul>
      <li>{identity.legalName}</li>
      <li>NIF: {identity.taxId}</li>
      <li>{identity.address}</li>
      <li>
        Contacto: <a href={`mailto:${identity.email}`}>{identity.email}</a>
      </li>
    </ul>
  )
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function LegalPage({
  document,
  identity,
  restaurantName,
}: {
  document: LegalDocument
  identity: LegalIdentity | null
  restaurantName?: string
}) {
  const isRestaurant = document.startsWith('booking-')
  const title = {
    'booking-privacy': 'Privacidad de las reservas',
    'booking-terms': 'Condiciones de reserva',
    cookies: 'Política de cookies',
    'platform-privacy': 'Política de privacidad de SobreTaula',
    'saas-terms': 'Condiciones del servicio SobreTaula',
  }[document]
  const subject = restaurantName ?? 'SobreTaula'

  return (
    <main className="min-h-svh bg-[#fbfaf8] px-5 py-10 text-[#292d34] sm:px-8">
      <article className="mx-auto max-w-3xl rounded-3xl border border-[#292d34]/10 bg-white p-6 shadow-sm sm:p-10">
        <Link
          className="text-sm font-semibold underline underline-offset-4"
          to={isRestaurant ? '/login' : '/'}
        >
          SobreTaula
        </Link>
        <p className="mt-8 text-xs font-bold tracking-[0.14em] text-[#c34d3e] uppercase">
          Información legal
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em]">{title}</h1>
        <p className="mt-3 text-sm text-[#60656d]">Última actualización: {updatedAt}</p>

        <div className="st-legal-content mt-9 space-y-8">
          {document === 'booking-privacy' && (
            <>
              <Section title="1. Responsable">
                <p>
                  {subject} es responsable del tratamiento de los datos que facilitas al hacer o
                  gestionar una reserva. SobreTaula actúa como proveedor tecnológico encargado de
                  tratar esos datos por cuenta del restaurante.
                </p>
                <Identity identity={identity} />
              </Section>
              <Section title="2. Datos, finalidad y base jurídica">
                <p>
                  Tratamos nombre, teléfono, correo electrónico si lo aportas, número de personas,
                  fecha, hora y comunicaciones sobre la reserva. Lo hacemos para celebrar y ejecutar
                  la reserva y atender solicitudes relacionadas. No uses este formulario para enviar
                  alergias, datos de salud u otra información sensible.
                </p>
              </Section>
              <Section title="3. Destinatarios y conservación">
                <p>
                  Accede el personal autorizado del restaurante y los proveedores necesarios para
                  alojar y operar el servicio, sujetos a obligaciones de confidencialidad. Los datos
                  se conservan durante la relación y después solo durante los plazos legales o para
                  atender responsabilidades.
                </p>
              </Section>
              <Section title="4. Tus derechos">
                <p>
                  Puedes solicitar acceso, rectificación, supresión, oposición, limitación o
                  portabilidad escribiendo al contacto indicado. También puedes reclamar ante la
                  Agencia Española de Protección de Datos.
                </p>
              </Section>
            </>
          )}
          {document === 'booking-terms' && (
            <>
              <Section title="1. Quién presta el servicio">
                <p>
                  La reserva se realiza directamente con {subject}; SobreTaula solo facilita la
                  herramienta de reserva.
                </p>
                <Identity identity={identity} />
              </Section>
              <Section title="2. Reserva y cambios">
                <p>
                  La reserva queda confirmada cuando recibes la confirmación en pantalla o por el
                  canal indicado por el restaurante. Puedes consultar, modificar o cancelar desde el
                  enlace seguro recibido, dentro de las condiciones específicas comunicadas para la
                  reserva.
                </p>
              </Section>
              <Section title="3. Precio, depósitos y cancelación">
                <p>
                  La reserva ordinaria no tiene coste. Si un grupo exige depósito o hay una política
                  de cancelación/no presentación, el restaurante mostrará antes del pago el importe,
                  impuestos, fecha límite, condiciones de cargo y de devolución; no se realiza
                  ningún cobro sin esa aceptación previa. Las reservas de comida para fecha u hora
                  concreta no están sujetas al derecho general de desistimiento, sin perjuicio de la
                  política ofrecida por el restaurante.
                </p>
              </Section>
            </>
          )}
          {document === 'cookies' && (
            <>
              <Section title="1. Qué usamos">
                <p>
                  SobreTaula usa únicamente almacenamiento técnico imprescindible para mantener la
                  sesión y proteger formularios. No instala cookies analíticas, publicitarias ni de
                  perfilado sin consentimiento previo.
                </p>
              </Section>
              <Section title="2. Cómo gestionar tu elección">
                <p>
                  Las cookies técnicas no requieren consentimiento porque son necesarias para el
                  servicio. Si en el futuro se añaden cookies opcionales, podrás aceptarlas,
                  rechazarlas o configurarlas con la misma facilidad antes de instalarlas.
                </p>
              </Section>
            </>
          )}
          {document === 'platform-privacy' && (
            <>
              <Section title="1. Responsable">
                <Identity identity={identity} />
              </Section>
              <Section title="2. Tratamientos">
                <p>
                  Tratamos los datos de las personas usuarias de la cuenta para crearla, prestar el
                  servicio, gestionar soporte, seguridad, facturación y cumplimiento de obligaciones
                  legales. Los datos de comensales se tratan por cuenta de cada restaurante conforme
                  al acuerdo de encargo de tratamiento.
                </p>
              </Section>
              <Section title="3. Derechos">
                <p>
                  Puedes ejercer acceso, rectificación, supresión, oposición, limitación y
                  portabilidad mediante el correo indicado, y reclamar ante la AEPD.
                </p>
              </Section>
            </>
          )}
          {document === 'saas-terms' && (
            <>
              <Section title="1. Servicio y contrato">
                <p>
                  SobreTaula proporciona un servicio SaaS para la gestión operativa de restaurantes.
                  El cliente profesional es responsable de sus usuarios, de la licitud de los datos
                  que incorpora y de sus obligaciones frente a comensales, trabajadores y Hacienda.
                </p>
                <Identity identity={identity} />
              </Section>
              <Section title="2. Datos y seguridad">
                <p>
                  Las partes suscribirán el acuerdo de encargo de tratamiento antes de usar datos de
                  clientes. SobreTaula aplicará medidas técnicas y organizativas adecuadas; el
                  cliente debe mantener sus credenciales confidenciales y asignar permisos mínimos.
                </p>
              </Section>
              <Section title="3. Facturación, pagos y disponibilidad">
                <p>
                  El precio, impuestos, periodicidad, renovaciones y cancelación se mostrarán en la
                  oferta o pedido aplicable. Los pagos con tarjeta se procesan mediante proveedores
                  especializados; SobreTaula no almacena PAN ni CVV. La disponibilidad puede
                  depender de proveedores externos y las obligaciones fiscales del cliente no se
                  sustituyen por el software.
                </p>
              </Section>
            </>
          )}
        </div>
      </article>
    </main>
  )
}
