import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import SesionGuard from '@/components/auth/SesionGuard'
import TituloVentana from '@/components/ui/TituloVentana'
import './globals.css'

const nunito = Nunito({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: 'Alzamientos Banco de Chile — 33° Notaría de Santiago',
  description: 'Sistema de gestión notarial — Alzamientos Banco de Chile',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`${nunito.variable} font-sans antialiased`}>
        <TituloVentana />
        <SesionGuard>{children}</SesionGuard>
        <Analytics />
      </body>
    </html>
  )
}
