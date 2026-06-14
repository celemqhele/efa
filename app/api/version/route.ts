import { NextResponse } from 'next/server'

// Vercel sets these env vars on each deployment
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_RUNTIME ??
  String(Date.now())

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    buildId: BUILD_ID.slice(0, 12),
    deployTime: new Date().toISOString(),
  })
}
