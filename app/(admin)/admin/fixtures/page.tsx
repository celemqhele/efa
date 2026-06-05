import { redirect } from 'next/navigation'

export default function AdminFixturesRedirect() {
  redirect('/admin/fixtures/manage')
}
