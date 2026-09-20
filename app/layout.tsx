import type { Metadata, Viewport } from "next"
import Script from "next/script"
import "./globals.css"
import "./wanzila.css"

const UMAMI_WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || "f94a028b-83b4-4f9b-b922-c6924617cce2"

export const metadata: Metadata = {
  title: "Wanzila — Pharmacies à Brazzaville",
  description: "Recherchez une pharmacie à Brazzaville et affichez un itinéraire routier sur la carte.",
  keywords: "pharmacie, Brazzaville, itinéraire",
  authors: [{ name: "Wanzila" }],
  icons: { icon: "/brand-app-icon.png", apple: "/brand-app-icon.png" },
  robots: "index, follow",
  openGraph: {
    title: "Wanzila — Pharmacies à Brazzaville",
    description: "Recherchez une pharmacie et affichez un itinéraire routier.",
    type: "website",
    locale: "fr_FR",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="font-sans">
        <Script
          src="https://cloud.umami.is/script.js"
          data-website-id={UMAMI_WEBSITE_ID}
          data-domains="wanzila-app.onrender.com"
          data-exclude-search="true"
          data-do-not-track="true"
          strategy="afterInteractive"
        />
        {children}
      </body>
    </html>
  )
}

export const viewport: Viewport = { width: 'device-width', initialScale: 1 }
