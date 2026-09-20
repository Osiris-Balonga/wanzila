import { redirect } from 'next/navigation'
import { AdminShell } from '@/components/admin/AdminShell'
import { getAdminSession } from '@/lib/admin-auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return <AdminShell session={session}>{children}</AdminShell>
}
