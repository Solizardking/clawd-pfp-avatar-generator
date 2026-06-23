'use client';

import { useCallback, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const CLAWD_TOKEN = '8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump';
const SHARE_URL = 'https://makesolanaaigreatagain.x402.wtf';

const SUGGESTIONS = [
  'A cyberpunk Solana cat in neon Tokyo rain',
  'Clawd as a medieval knight holding a glowing SOL coin',
  'A Solana cat astronaut floating in deep space, earth behind',
  'Clawd surfing a tsunami of green candles on the moon',
  'A pixel art Solana cat with purple laser eyes, Phantom wallet HUD',
];

export default function GrokImageGen() {
  const { publicKey } = useWallet();
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    if (!publicKey || !prompt.trim()) return;
    setLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          walletAddress: publicKey.toBase58(),
        }),
      });
      const json = (await res.json()) as { image?: string; error?: string };
      if (!res.ok) throw new Error(json.error || 'Generation failed.');
      setImageUrl(json.image ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setLoading(false);
    }
  }, [publicKey, prompt]);

  const download = useCallback(() => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `clawd-grok-${Date.now()}.jpg`;
    a.click();
  }, [imageUrl]);

  const shareToX = useCallback(() => {
    if (!imageUrl) return;
    download();
    const text = encodeURIComponent(
      'Generated with Grok AI + $CLAWD 🐱⚡\n\nMake Solana AI Great Again'
    );
    const url = encodeURIComponent(SHARE_URL);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      '_blank',
      'noopener,noreferrer'
    );
  }, [imageUrl, download]);

  if (!publicKey) {
    return (
      <section className="grok-panel grok-locked">
        <div className="grok-lock-inner">
          <div className="grok-lock-icon">⚡</div>
          <h2>Grok AI Image Generation</h2>
          <p>
            Connect your wallet to access Grok-powered image generation — exclusive to{' '}
            <strong>$CLAWD holders</strong>.
          </p>
          <WalletMultiButton />
        </div>
      </section>
    );
  }

  return (
    <section className="grok-panel">
      <div className="grok-head">
        <div>
          <p className="eyebrow">$CLAWD Holders Only</p>
          <h2>Grok AI Image Generation</h2>
        </div>
        <span className="grok-badge">⚡ Powered by Grok Imagine</span>
      </div>

      <div className="grok-body">
        <div className="grok-input-area">
          <label className="grok-label" htmlFor="grok-prompt">
            Describe your image
          </label>
          <textarea
            id="grok-prompt"
            className="grok-textarea"
            placeholder="A cyberpunk Solana cat in neon Tokyo rain…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            maxLength={1000}
          />
          <div className="grok-suggestions">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="grok-suggestion" onClick={() => setPrompt(s)}>
                {s}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-grok-generate"
            onClick={generate}
            disabled={loading || !prompt.trim()}
          >
            {loading ? 'Generating…' : '⚡ Generate with Grok'}
          </button>
        </div>

        {error && (
          <div className="grok-error">
            <span>{error}</span>
            {error.includes('$CLAWD') && (
              <a
                href={`https://phantom.com/tokens/solana/${CLAWD_TOKEN}`}
                target="_blank"
                rel="noopener noreferrer"
                className="grok-buy-link"
              >
                Get $CLAWD →
              </a>
            )}
          </div>
        )}

        {loading && (
          <div className="grok-loading">
            <div className="grok-spinner" />
            <p>Grok is painting your vision…</p>
          </div>
        )}

        {imageUrl && !loading && (
          <div className="grok-result">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Grok generated" className="grok-image" />
            <div className="grok-result-actions">
              <button type="button" className="btn-grok-action" onClick={download}>
                Download
              </button>
              <button
                type="button"
                className="btn-grok-action btn-grok-share"
                onClick={shareToX}
              >
                Share to X
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
