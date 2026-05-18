import PageWrapper from '@/components/ui/PageWrapper'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

  return (
    <PageWrapper>
      <div className="mb-4 flex items-center gap-2">
        <div className="px-2 py-0.5 bg-[#c9a84c]/20 border border-[#c9a84c]/30 rounded text-xs font-bold text-[#c9a84c] uppercase tracking-widest">
          Admin Panel
        </div>
      </div>
      {children}
    </PageWrapper>
  )
}
