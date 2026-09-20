'use client'

import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'

export function LoginForm({ hasError }: { hasError: boolean }) {
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  return (
    <form className="admin-login-form" action="/api/admin/login" method="post" onSubmit={() => setPending(true)}>
      {hasError ? <div className="admin-login-error" role="alert">L’adresse e-mail ou le mot de passe est incorrect.</div> : null}
      <label><span>Adresse e-mail</span><span className="admin-login-input"><Mail size={20} /><input name="email" type="email" autoComplete="email" defaultValue="grace.mavoungou@wanzila.cg" required /></span></label>
      <label><span>Mot de passe</span><span className="admin-login-input"><LockKeyhole size={20} /><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Votre mot de passe" required /><button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff size={21} /> : <Eye size={21} />}</button></span></label>
      <div className="admin-login-options"><label><input type="checkbox" name="remember" defaultChecked /> <span>Se souvenir de moi</span></label><span>Accès réservé</span></div>
      <button className="admin-login-submit" type="submit" disabled={pending}>{pending ? 'Connexion…' : 'Se connecter'}</button>
    </form>
  )
}
