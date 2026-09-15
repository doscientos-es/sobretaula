const DNI_CONTROL_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE'
const CIF_CONTROL_LETTERS = 'JABCDEFGHI'

/** Removes presentation-only characters before storing a Spanish tax identifier. */
export function normalizeSpanishTaxId(rawTaxId: string): string {
  return rawTaxId.trim().toUpperCase().replaceAll(/[\s-]/g, '')
}

function hasValidDniControl(digits: string, control: string): boolean {
  return DNI_CONTROL_LETTERS[Number(digits) % DNI_CONTROL_LETTERS.length] === control
}

function isValidCif(taxId: string): boolean {
  const match = /^([ABCDEFGHJNPQRSUVW])(\d{7})([A-Z0-9])$/.exec(taxId)
  if (!match) return false

  const [, kind = '', body = '', control = ''] = match
  const sum = body.split('').reduce((total, digit, index) => {
    const value = Number(digit)
    if (index % 2 === 1) return total + value
    const doubled = value * 2
    return total + Math.floor(doubled / 10) + (doubled % 10)
  }, 0)
  const controlDigit = (10 - (sum % 10)) % 10
  const controlLetter = CIF_CONTROL_LETTERS[controlDigit]

  if ('ABEH'.includes(kind)) return control === String(controlDigit)
  if ('NPQRSW'.includes(kind)) return control === controlLetter
  return control === String(controlDigit) || control === controlLetter
}

/**
 * Validates the structure and check character of Spanish DNI/NIF, NIE and CIF.
 * It does not query AEAT and therefore cannot establish whether an entity exists.
 */
export function isValidSpanishTaxId(rawTaxId: string): boolean {
  const taxId = normalizeSpanishTaxId(rawTaxId)
  if (/^\d{8}[A-Z]$/.test(taxId)) return hasValidDniControl(taxId.slice(0, 8), taxId.charAt(8))

  if (/^[XYZ]\d{7}[A-Z]$/.test(taxId)) {
    const prefix = taxId.charAt(0) === 'X' ? '0' : taxId.charAt(0) === 'Y' ? '1' : '2'
    return hasValidDniControl(`${prefix}${taxId.slice(1, 8)}`, taxId.charAt(8))
  }

  return isValidCif(taxId)
}
