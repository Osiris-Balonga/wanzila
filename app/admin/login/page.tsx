import Image from 'next/image'
import { ShieldCheck } from 'lucide-react'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/admin/LoginForm'
import { getAdminSession } from '@/lib/admin-auth'

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdminSession()) redirect('/admin')
  const params = await searchParams
  return (
    <main className="admin-login">
      <section className="admin-login-brand">
        <div className="admin-login-brand__logo"><Image src="/brand-app-icon.png" width={72} height={72} alt="" priority /><span><strong>Wanzila</strong><small>Espace administrateur</small></span></div>
        <h1>Des informations fiables sur les pharmacies de Brazzaville.</h1>
        <div className="admin-login-brand__scene" aria-hidden="true" />
        <p>Des pharmaciens plus proches,<br />une ville en meilleure santé.</p>
      </section>
      <section className="admin-login-access">
        <div className="admin-login-card">
          <h2>Connexion</h2>
          <p>Accédez au tableau de bord administrateur.</p>
          <LoginForm hasError={params.error === 'credentials'} />
          <div className="admin-login-reserved"><span /><ShieldCheck size={21} /><span /></div>
          <small>Accès réservé à l’équipe Wanzila</small>
        </div>
      </section>
    </main>
  )
}
