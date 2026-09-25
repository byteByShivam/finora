import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Finora — Personal Finance Management',
  description: 'Production-quality personal finance management system with auditable decimal-safe ledger.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col font-sans bg-[#f8fafc] text-slate-900 selection:bg-emerald-100 selection:text-emerald-900">
        {children}
      </body>
    </html>
  );
}
