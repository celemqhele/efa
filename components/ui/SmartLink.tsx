'use client'

import NextLink from 'next/link'
import { usePathname } from 'next/navigation'
import { forwardRef } from 'react'
import type { ComponentProps } from 'react'
import { toAdminHref } from '@/lib/admin-href'

type LinkProps = ComponentProps<typeof NextLink>

/**
 * Drop-in replacement for `next/link`. When the current pathname is under
 * `/admin`, internal links to public routes that have an admin mirror get
 * rewritten to their `/admin` equivalent so admin navigation is preserved
 * (see `lib/admin-href.ts`). Behaves exactly like `next/link` everywhere else.
 */
const SmartLink = forwardRef<HTMLAnchorElement, LinkProps>(function SmartLink(
  { href, ...rest },
  ref
) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin') ?? false

  let resolved: LinkProps['href'] = href
  if (typeof href === 'string') {
    resolved = toAdminHref(href, isAdmin)
  } else if (href && typeof href === 'object' && typeof href.pathname === 'string') {
    resolved = { ...href, pathname: toAdminHref(href.pathname, isAdmin) }
  }

  return <NextLink ref={ref} href={resolved} {...rest} />
})

export default SmartLink
