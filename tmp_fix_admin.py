import sys

path = r'C:\Users\mqhel\efa\app\api\webhook\route.ts'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    s = f.read()

needle = """const ADMIN_PHONES = ['+27678721810', '+27732509506', '+27734776081']
function isAdminPhone(phone: string): boolean {
  const norm = phone.replace(/\D/g, '')
  return ADMIN_PHONES.some(p => p.replace(/\D/g, '') === norm)
}"""

repl = """import { resolveIdentityByPhone } from '@/lib/identity'

async function isAdminPhone(phone: string): Promise<boolean> {
  const id = await resolveIdentityByPhone(phone)
  return id.isAdmin
}"""

if needle not in s:
    sys.exit('not_found')
s2 = s.replace(needle, repl)
with open(path, 'w', encoding='utf-8') as f:
    f.write(s2)
sys.exit('ok')
