import type { Metadata } from 'next'
import { ogMeta } from '@/lib/og'
import Shell from './_shell'

export const metadata: Metadata = ogMeta({
  title: 'Sign in',
  description: 'Sign in to the EFA to check fixtures, submit results, and manage your club.',
  path: '/login',
  withImage: false,
})

export default function LoginPage() {
  return <Shell data={{}} />
}
