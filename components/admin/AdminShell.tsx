'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Settings,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import type { AdminSession } from '@/lib/admin-auth'

const primaryLinks = [
  { href: '/admin', label: 'Vue d’ensemble', icon: LayoutDashboard },
  { href: '/admin/analytics', label: 'Analytique', icon: BarChart3 },
]

const futureLinks = [
  { label: 'Gardes', icon: ClipboardList },
  { label: 'Pharmacies', icon: Building2 },
  { label: 'Contributions', icon: UsersRound },
  { label: 'Paramètres', icon: Settings },
]

export function AdminShell({ session, children }: { session: AdminSession; children: React.ReactNode }) {
  const pathname = usePathname()
  const [profileOpen, setProfileOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)

  const avatar = (className: string) => session.avatarUrl
    ? <img className={className} src={session.avatarUrl} alt={`Portrait de ${session.name}`} />
    : <span className={className}>{session.name.slice(0, 1).toUpperCase()}</span>

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin" aria-label="Wanzila, espace administrateur">
          <Image src="/brand-app-icon.png" width={54} height={54} alt="" priority />
          <span><strong>Wanzila</strong><small>Espace administrateur</small></span>
        </Link>

        <nav className="admin-navigation" aria-label="Navigation administrateur">
          <div className="admin-navigation__group">
            {primaryLinks.map(({ href, label, icon: Icon }) => {
              const active = href === '/admin' ? pathname === href : pathname.startsWith(href)
              return <Link key={href} href={href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}><Icon size={20} /><span>{label}</span></Link>
            })}
          </div>
          <div className="admin-navigation__group admin-navigation__future" aria-label="Fonctionnalités à venir">
            {futureLinks.map(({ label, icon: Icon }) => <button key={label} type="button" disabled><Icon size={20} /><span>{label}</span><small>Bientôt</small></button>)}
          </div>
        </nav>

        <div className="admin-sidebar__illustration" aria-hidden="true" />

        <details className="admin-account">
          <summary>
            {avatar('admin-account__avatar')}
            <span className="admin-account__identity"><strong>{session.name}</strong><small>{session.email}</small></span>
            <ChevronDown size={17} aria-hidden="true" />
          </summary>
          <div className="admin-account__menu">
            <button type="button" aria-label="Ouvrir mon profil" onClick={() => setProfileOpen(true)}><UserRound size={17} /> Mon compte</button>
            <button type="button" aria-label="Se déconnecter" onClick={() => setLogoutOpen(true)}><LogOut size={17} /> Se déconnecter</button>
          </div>
        </details>
      </aside>

      <main className="admin-main">{children}</main>

      {profileOpen ? (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setProfileOpen(false) }}>
          <section className="admin-profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-title">
            <button className="admin-profile-modal__close" type="button" onClick={() => setProfileOpen(false)} aria-label="Fermer"><X size={20} /></button>
            <header className="admin-profile-modal__header">
              {avatar('admin-profile-modal__avatar')}
              <div><h2 id="profile-title">Profil administrateur</h2><p>{session.name}</p></div>
            </header>
            <dl><div><dt>Adresse e-mail</dt><dd>{session.email}</dd></div><div><dt>Rôle</dt><dd>Administratrice</dd></div></dl>
          </section>
        </div>
      ) : null}

      {logoutOpen ? (
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setLogoutOpen(false) }}>
          <section className="admin-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="logout-title" aria-describedby="logout-description">
            <span className="admin-confirm-modal__icon"><LogOut size={22} /></span>
            <h2 id="logout-title">Se déconnecter ?</h2>
            <p id="logout-description">Vous devrez saisir à nouveau vos identifiants pour accéder au panneau administrateur.</p>
            <div className="admin-confirm-modal__actions">
              <button type="button" onClick={() => setLogoutOpen(false)}>Annuler</button>
              <form action="/api/admin/logout" method="post"><button type="submit">Se déconnecter</button></form>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
