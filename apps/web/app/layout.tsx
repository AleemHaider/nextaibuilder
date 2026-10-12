import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Product Builder Academy',
    template: '%s | Product Builder Academy',
  },
  description: 'Learn to build products step-by-step with expert guidance and AI-powered feedback.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon.ico' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    url: 'https://nextaibuilder.com/',
    title: 'nextaibuilder — AI product cohorts that ship',
    description: 'Live and recorded cohorts to ship production AI products.',
    images: [{ url: 'https://nextaibuilder.com/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'nextaibuilder — AI product cohorts that ship',
    description: 'Live and recorded cohorts to ship production AI products.',
    images: ['https://nextaibuilder.com/og-image.png'],
  },
}

export const viewport: Viewport = {
  themeColor: '#0d1a3a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
