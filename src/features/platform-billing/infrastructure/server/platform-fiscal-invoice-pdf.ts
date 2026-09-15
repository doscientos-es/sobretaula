import { createHash } from 'node:crypto'

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

type InvoiceLine = {
  description?: string
  quantity?: number
  subtotal_cents?: number
  vat_rate_bps?: number
}

export type PlatformFiscalInvoicePdfInput = {
  customerAddressLine: string
  customerCity: string
  customerName: string
  customerNif: string
  customerPostalCode: string
  issuedAt: string | null
  issuerAddressLine: string | null
  issuerCity: string | null
  issuerLegalName: string | null
  issuerNif: string | null
  issuerPostalCode: string | null
  lines: unknown
  paidAt: string | null
  paymentStatus: 'open' | 'paid' | 'failed' | 'void'
  periodEnd: string
  periodStart: string
  subtotalCents: number
  totalCents: number
  vatCents: number
  vatRateBps: number
  fullNumber: string | null
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 48
const DARK = rgb(0.12, 0.14, 0.18)
const MUTED = rgb(0.38, 0.41, 0.46)

function money(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} EUR`
}

function date(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value))
}

function clean(value: string | null | undefined, fallback = '—'): string {
  return (value?.replaceAll(/\s+/g, ' ').trim() || fallback).slice(0, 120)
}

function text(page: PDFPage, value: string, x: number, y: number, font: PDFFont, size = 10) {
  page.drawText(value, { color: DARK, font, size, x, y })
}

function labelValue(
  page: PDFPage,
  label: string,
  value: string,
  x: number,
  y: number,
  regular: PDFFont,
  bold: PDFFont,
) {
  text(page, label, x, y, regular, 9)
  text(page, value, x, y - 14, bold, 10)
}

function normalizeLines(value: unknown): InvoiceLine[] {
  if (!Array.isArray(value)) return []
  return value.filter((line): line is InvoiceLine => typeof line === 'object' && line !== null)
}

export async function buildPlatformFiscalInvoicePdf(
  input: PlatformFiscalInvoicePdfInput,
): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let y = PAGE_HEIGHT - MARGIN

  text(page, 'FACTURA DE SUSCRIPCION', MARGIN, y, bold, 18)
  text(page, 'SobreTaula', PAGE_WIDTH - MARGIN - 90, y, bold, 14)
  y -= 40
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, color: MUTED })
  y -= 30

  labelValue(
    page,
    'Numero',
    clean(input.fullNumber, 'Pendiente de numerar'),
    MARGIN,
    y,
    regular,
    bold,
  )
  labelValue(page, 'Fecha de emision', date(input.issuedAt), 220, y, regular, bold)
  labelValue(page, 'Periodo', `${input.periodStart} — ${input.periodEnd}`, 390, y, regular, bold)
  y -= 62

  text(page, 'EMISOR', MARGIN, y, bold, 9)
  text(page, clean(input.issuerLegalName), MARGIN, y - 17, regular, 10)
  text(page, `NIF: ${clean(input.issuerNif)}`, MARGIN, y - 32, regular, 9)
  text(page, clean(input.issuerAddressLine), MARGIN, y - 47, regular, 9)
  text(
    page,
    `${clean(input.issuerPostalCode)} ${clean(input.issuerCity)}`,
    MARGIN,
    y - 62,
    regular,
    9,
  )

  text(page, 'CLIENTE', 320, y, bold, 9)
  text(page, clean(input.customerName), 320, y - 17, regular, 10)
  text(page, `NIF: ${clean(input.customerNif)}`, 320, y - 32, regular, 9)
  text(page, clean(input.customerAddressLine), 320, y - 47, regular, 9)
  text(
    page,
    `${clean(input.customerPostalCode)} ${clean(input.customerCity)}`,
    320,
    y - 62,
    regular,
    9,
  )
  y -= 105

  text(page, 'CONCEPTO', MARGIN, y, bold, 9)
  text(page, 'UD.', 350, y, bold, 9)
  text(page, 'BASE', 410, y, bold, 9)
  text(page, 'IVA', 500, y, bold, 9)
  y -= 10
  page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, color: MUTED })
  y -= 22

  const lines = normalizeLines(input.lines)
  for (const line of lines.length
    ? lines
    : [{ description: 'Suscripcion SobreTaula', quantity: 1 }]) {
    text(page, clean(line.description, 'Suscripcion SobreTaula'), MARGIN, y, regular, 10)
    text(page, String(line.quantity ?? 1), 350, y, regular, 10)
    text(page, money(line.subtotal_cents ?? input.subtotalCents), 410, y, regular, 10)
    text(
      page,
      `${((line.vat_rate_bps ?? input.vatRateBps) / 100).toFixed(2)}%`,
      500,
      y,
      regular,
      10,
    )
    y -= 22
  }

  y -= 12
  page.drawLine({ start: { x: 350, y }, end: { x: PAGE_WIDTH - MARGIN, y }, color: MUTED })
  y -= 24
  labelValue(page, 'Base imponible', money(input.subtotalCents), 350, y, regular, bold)
  labelValue(
    page,
    `IVA ${input.vatRateBps / 100}%`,
    money(input.vatCents),
    350,
    y - 38,
    regular,
    bold,
  )
  labelValue(page, 'TOTAL', money(input.totalCents), 350, y - 76, regular, bold)

  y -= 145
  text(
    page,
    `Estado del pago: ${input.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}`,
    MARGIN,
    y,
    regular,
    9,
  )
  text(page, `Fecha de pago: ${date(input.paidAt)}`, MARGIN, y - 15, regular, 9)
  text(page, 'Documento generado por SobreTaula.', MARGIN, 42, regular, 8)
  text(page, 'Conserve esta factura como justificante del servicio.', MARGIN, 29, regular, 8)

  return document.save()
}

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}
