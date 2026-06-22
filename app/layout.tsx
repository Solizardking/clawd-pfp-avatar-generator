import type { Metadata } from 'next';
import '@solana/wallet-adapter-react-ui/styles.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://x402.wtf'),
  title: 'Clawd PFP Studio',
  description: 'Generate Cloudflare-backed Solana PFPs, export PNGs, and mint Metaplex Core NFTs.',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'Clawd PFP Studio',
    description: 'Generate Cloudflare-backed Solana PFPs, export PNGs, and mint Metaplex Core NFTs.',
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
