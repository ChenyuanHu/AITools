import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Google AI Studio - Playground',
  description: 'Google AI Studio Web Console Clone',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}

