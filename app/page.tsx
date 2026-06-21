import AvatarStudio from '@/components/AvatarStudio';
import Gallery from '@/components/Gallery';
import WalletProviders from '@/components/WalletProviders';

export default function Home() {
  return (
    <WalletProviders>
      <main className="page-shell">
        <div className="hero">
          <header className="topbar">
            <div className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/master/clawd_mascot_hq_square_transparent.png"
                alt="Clawd"
                width={52}
                height={52}
                className="brand-logo"
              />
              <div>
                <h1>PFP Avatar Generator</h1>
                <p className="subtitle">Create. Customize. Own your identity on <span>Solana.</span></p>
              </div>
            </div>
            <div className="wallet-wrap" id="wallet-button-slot" />
          </header>

          <AvatarStudio />
          <Gallery />
        </div>
      </main>
    </WalletProviders>
  );
}
