import PageWrapper from '@/components/ui/PageWrapper'

export const dynamic = 'force-dynamic'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PageWrapper>{children}</PageWrapper>
}

