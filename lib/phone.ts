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
  let digits = normalizePhoneDigits(phone)
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