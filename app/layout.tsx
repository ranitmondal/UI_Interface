import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Playwright Test Runner',
  description: 'A dashboard for running and managing Playwright tests',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  )
}
