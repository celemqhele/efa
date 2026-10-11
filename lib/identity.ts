import { createAdminClient } from '@/lib/supabase/server'
import { normalizePhoneDigits } from '@/lib/phone'

export type Identity = {
  role: 'admin' | 'user'
  isAdmin: boolean
  username: string | null
  userId: string | null
  phone: string | null
  isManager: boolean
}

const EMERGENCY_ADMIN_PHONES = ['27678721810', '27732509506', '27734776081']

export async function resolveIdentityByPhone(phone: string | null | undefined): Promise<Identity> {
  const digits = normalizePhoneDigits(phone)
  if (!digits) {
    return { role: 'user', isAdmin: false, username: null, userId: null, phone: null, isManager: false }
  }

  const supabase = await createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, role, phone')
    .eq('phone', digits)
    .maybeSingle()

  if (profile) {
    const isAdmin = (profile.role === 'admin') || EMERGENCY_ADMIN_PHONES.includes(digits)
    const { data: teams } = await supabase
      .from('teams')
      .select('id')
      .eq('manager_id', profile.id)
      .limit(1)
    return {
      role: isAdmin ? 'admin' : 'user',
      isAdmin,
      username: profile.username,
      userId: profile.id,
      phone: digits,
      isManager: !!teams?.length,
    }
  }

  const isAdmin = EMERGENCY_ADMIN_PHONES.includes(digits)
  return {
    role: isAdmin ? 'admin' : 'user',
    isAdmin,
    username: null,
    userId: null,
    phone: digits,
    isManager: false,
  }
}
