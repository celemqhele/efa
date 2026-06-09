import PageWrapper from '@/components/ui/PageWrapper'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <PageWrapper>{children}</PageWrapper>
}

