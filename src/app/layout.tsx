import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Rockstary | Platinumlist Content Engine',
  description: 'Event & Attraction content processing pipeline for Platinumlist',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
