import type { Metadata } from 'next'
import { ogMeta } from '@/lib/og'
import Shell from './_shell'

export const metadata: Metadata = ogMeta({
  title: 'Register',
  description: 'Join the EFA — claim a club, enter a competition, and start your manager career.',
  path: '/register',
  withImage: false,
})

export default function RegisterPage() {
  return <Shell data={{}} />
}
