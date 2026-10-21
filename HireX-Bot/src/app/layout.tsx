import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'First Mile',
  description:
    'Autonomous proof-of-work, apprenticeship and employment architecture for India\u2019s youth tech workforce.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/raleway-400.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen bg-canvas text-ink-primary antialiased">
        {children}
      </body>
    </html>
  );
}
