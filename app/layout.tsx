import type { Metadata } from 'next';
import './globals.css';
import '@solana/wallet-adapter-react-ui/styles.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://x402.wtf'),
  title: 'Clawd PFP Avatar Generator',
  description: 'Create Solana-themed PFPs, export for Twitter, and mint as Solana NFTs.',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'Clawd PFP Avatar Generator',
    description: 'Create Solana-themed PFPs, export for Twitter, and mint as Solana NFTs.',
    images: [{ url: '/master/clawd_mascot_hq_blueprint_grid_4k.png', width: 4096, height: 4096 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/master/clawd_mascot_hq_blueprint_grid_4k.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
