import type { Metadata } from 'next'
import Shell from './_shell'

export const revalidate = false

export const metadata: Metadata = {
  title: 'Rules',
  description: 'EFA league rules and regulations — the official rulebook for competitive eFootball.',
  openGraph: { title: 'Rules | EFA', description: 'EFA league rules and regulations — the official rulebook for competitive eFootball.' },
}

export default function RulesPage() {
  return <Shell />
}
