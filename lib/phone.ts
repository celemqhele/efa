export const DEFAULT_COUNTRY_CODE = '27'

export const COUNTRY_CODES: Array<{ code: string; label: string }> = [
  { code: '27', label: '+27 South Africa' },
  { code: '44', label: '+44 United Kingdom' },
  { code: '1', label: '+1 US/Canada' },
  { code: '233', label: '+233 Ghana' },
  { code: '234', label: '+234 Nigeria' },
  { code: '264', label: '+264 Namibia' },
  { code: '353', label: '+353 Ireland' },
  { code: '31', label: '+31 Netherlands' },
  { code: '49', label: '+49 Germany' },
  { code: '389', label: '+389 North Macedonia' },
]

export function normalizePhoneDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '')
}

// Digits safe to use in a wa.me link. Local SA numbers (10 digits starting with
// 0) get the SA country code prepended, and a trunk 0 after a country code
// ("270674008857") is dropped, so the link always works.
export function waDigits(phone: string | null | undefined): string {
  const digits = normalizePhoneDigits(phone)
  if (digits.startsWith('0') && digits.length === 10) {
    return `27${digits.slice(1)}`
  }
  const codes = COUNTRY_CODES.map((c) => c.code).sort((a, b) => b.length - a.length)
  for (const code of codes) {
    if (digits.startsWith(code) && digits.length > code.length && digits[code.length] === '0') {
      return digits.slice(0, code.length) + digits.slice(code.length + 1)
    }
  }
  return digits
}

// Splits a stored phone ("+27 79 811 5750", "27788707749", "0674008857") into
// country code + local part for the profile/admin phone inputs.
export function parsePhoneParts(
  phone: string | null | undefined
): { countryCode: string; local: string } {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return { countryCode: DEFAULT_COUNTRY_CODE, local: '' }

  const match = COUNTRY_CODES.map((c) => c.code)
    .filter((code) => digits.startsWith(code) && digits.length > code.length)
    .sort((a, b) => b.length - a.length)[0]

  if (match) {
    let local = digits.slice(match.length)
    if (local.startsWith('0')) local = local.slice(1)
    return { countryCode: match, local }
  }

  // Local SA number stored without a country code, e.g. 0674008857
  if (digits.startsWith('0') && digits.length === 10) {
    return { countryCode: DEFAULT_COUNTRY_CODE, local: digits.slice(1) }
  }

  return { countryCode: DEFAULT_COUNTRY_CODE, local: digits }
}

// Combines a selected country code + local input into a stored phone (digits
// only, e.g. "27798115750"). A leading trunk 0 on the local part is stripped.
export function toStoredPhone(countryCode: string, local: string): string {
  let digits = normalizePhoneDigits(local)
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (countryCode && digits) return `${countryCode}${digits}`
  return digits
}

// Canonical digits-only international form used to compare stored vs draft
// numbers ("270674008857" and "27674008857" both resolve to "27674008857").
export function canonicalPhone(phone: string | null | undefined): string {
  const { countryCode, local } = parsePhoneParts(phone)
  return toStoredPhone(countryCode, local)
}

// Total international digit-length ranges (country code included) per code,
// used to reject truncated/mistyped numbers before they are stored. A full SA
// mobile is exactly 27 + 9 = 11 digits; shortening it breaks WhatsApp identity
// matching (e.g. "2766558283" from "27665582832").
const PHONE_DIGIT_LENGTHS: Record<string, { min: number; max: number }> = {
  '27': { min: 11, max: 11 },
  '44': { min: 11, max: 12 },
  '1': { min: 11, max: 11 },
  '233': { min: 12, max: 12 },
  '234': { min: 13, max: 13 },
  '264': { min: 12, max: 12 },
  '353': { min: 10, max: 11 },
  '31': { min: 11, max: 11 },
  '49': { min: 8, max: 13 },
  '389': { min: 11, max: 11 },
}

export function phoneDigitLengthBounds(countryCode: string): { min: number; max: number } {
  return PHONE_DIGIT_LENGTHS[countryCode] ?? { min: 7, max: 15 }
}

// Max digits allowed in the local-part input for a selected country code
// (total range minus the country-code digits), so a truncated SA number can't
// be typed below the expected length in the first place.
export function phoneLocalMaxLength(countryCode: string): number {
  const { max } = phoneDigitLengthBounds(countryCode)
  return Math.max(1, max - countryCode.length)
}

// Accepts only digits-only international numbers that match a known country
// code's length range. Unknown prefixes fall back to a sane 7-15 window so
// the check never rejects a legitimate number it doesn't understand.
export function isValidStoredPhone(phone: string | null | undefined): boolean {
  const digits = normalizePhoneDigits(phone)
  if (!digits) return true
  const match = Object.keys(PHONE_DIGIT_LENGTHS)
    .sort((a, b) => b.length - a.length)
    .find((code) => digits.startsWith(code) && digits.length > code.length)
  if (!match) return digits.length >= 7 && digits.length <= 15
  const { min, max } = PHONE_DIGIT_LENGTHS[match]
  return digits.length >= min && digits.length <= max
}