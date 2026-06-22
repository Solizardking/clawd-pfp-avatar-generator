import AvatarStudio from '@/components/AvatarStudio';
import Gallery from '@/components/Gallery';
import WalletProviders from '@/components/WalletProviders';

const CLAWD_TOKEN = '8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump';

export default function Home() {
  return (
    <WalletProviders>
      <main className="page-shell">
        <div className="app-shell">
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
                <h1>Clawd PFP Studio</h1>
                <p className="subtitle">Generate, save, and mint polished Solana profile pictures.</p>
              </div>
            </div>
            <div className="topbar-right">
              <a
                className="token-pill"
                href={`https://phantom.com/tokens/solana/${CLAWD_TOKEN}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Buy $CLAWD on Phantom"
              >
                <span className="token-dot" />
                $CLAWD
              </a>
            </div>
          </header>

          <AvatarStudio />
          <Gallery />
        </div>
      </main>
    </WalletProviders>
  );
}
