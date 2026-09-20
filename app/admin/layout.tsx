import type { Metadata } from 'next'
import './admin.css'

export const metadata: Metadata = {
  title: 'Administration — Wanzila',
  description: 'Pilotage et analytique de Wanzila.',
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children
}
