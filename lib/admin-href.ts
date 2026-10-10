export const ADMIN_MIRROR_PREFIXES = [
  '/fixtures',
  '/results',
  '/teams',
  '/managers',
  '/standings',
  '/premiership',
  '/rules',
] as const

function isAdminPath(href: string): boolean {
  return href === '/admin' || href.startsWith('/admin/') || href.startsWith('/admin?') || href.startsWith('/admin#')
}

export function toAdminHref(href: string, isAdmin: boolean): string {
  if (!isAdmin || !href.startsWith('/')) return href
  if (isAdminPath(href)) return href

  const path = href.split(/[?#]/)[0]
  const shouldMirror = ADMIN_MIRROR_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  )

  return shouldMirror ? `/admin${href}` : href
}
