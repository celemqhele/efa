import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { signedUrlForPath } from '@/lib/submit-match'

export const dynamic = 'force-dynamic'

const SIGNED_URL_MARKER = '/storage/v1/object/sign/'

// Turn the stored Supabase signed URL back into bucket + object path so a fresh
// URL can be signed on every click. Stored links are signed for a year and
// eventually die; minting on demand keeps the short reminder link alive.
function splitSignedUrl(url: string): { bucket: string; path: string } | null {
  const markerAt = url.indexOf(SIGNED_URL_MARKER)
  if (markerAt === -1) return null
  const rest = url.slice(markerAt + SIGNED_URL_MARKER.length).split('?')[0]
  const slash = rest.indexOf('/')
  if (slash === -1) return null
  const bucket = rest.slice(0, slash)
  const path = decodeURIComponent(rest.slice(slash + 1))
  return bucket && path ? { bucket, path } : null
}

// Short public backdoor-proof link used in the WhatsApp reminder:
//   https://efa-fxyk.vercel.app/<matchCode>/backdoor?side=home
// It redirects to the report's screenshot. The match code is the secret (the
// old reminder exposed the full signed Storage URL anyway). `side` picks the
// report filed AGAINST that side, so mutual reports cannot show the wrong proof.
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params
  const code = (rawCode ?? '').trim().toUpperCase()
  const side = request.nextUrl.searchParams.get('side')
  if (!code) return new NextResponse('Not found', { status: 404 })

  const admin = await createAdminClient()
  const { data: codeRow } = await admin
    .from('match_codes')
    .select('fixture_id')
    .eq('code', code)
    .maybeSingle()
  if (!codeRow?.fixture_id) return new NextResponse('Not found', { status: 404 })

  let query = admin
    .from('backdoor_submissions')
    .select('screenshot_url, status, side_claimed, created_at')
    .eq('fixture_id', codeRow.fixture_id)
    .not('screenshot_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10)
  if (side === 'home' || side === 'away') query = query.eq('side_claimed', side)

  const { data: reports } = await query
  const report =
    (reports ?? []).find((r: any) => r.status === 'pending') ?? (reports ?? [])[0]
  if (!report?.screenshot_url) {
    return new NextResponse('Screenshot not found', { status: 404 })
  }

  let target = String(report.screenshot_url)
  const parts = splitSignedUrl(target)
  if (parts) {
    try {
      target = await signedUrlForPath(parts.bucket, parts.path)
    } catch {
      // Fall back to the stored URL: it is still valid for its own lifetime.
    }
  }

  return NextResponse.redirect(target, 302)
}
