'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import bs58 from 'bs58';
import { create, mplCore } from '@metaplex-foundation/mpl-core';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { generateSigner } from '@metaplex-foundation/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { useWallet } from '@solana/wallet-adapter-react';
import type { AccessoryState, AvatarRecord } from '@/lib/types';

const CANVAS_SIZE = 1080;
const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const HAT = '/accessories/hat.svg';
const SHADES = '/accessories/shades.svg';
const CHAIN = '/accessories/chain.svg';

const SAMPLE_IMAGES = [
  { src: '/samples/clawd-mascot-4k.png', label: 'Clawd HQ' },
  { src: '/samples/clawd-mascot-square.png', label: 'Clawd Square' },
  { src: '/samples/clawd-character.png', label: 'Clawd Grab' },
  { src: '/samples/clawd-character-2.png', label: 'Clawd Alt' },
  { src: '/samples/clawd.svg', label: 'Classic' },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function dataUrlFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AvatarStudio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const wallet = useWallet();

  const [profileSrc, setProfileSrc] = useState(SAMPLE_IMAGES[0].src);
  const [accessories, setAccessories] = useState<AccessoryState>({ hat: true, shades: true, chain: true });
  const [saving, setSaving] = useState(false);
  const [minting, setMinting] = useState(false);
  const [message, setMessage] = useState('Choose a Clawd character or upload your own PFP, swap traits, then save to the gallery.');
  const [error, setError] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarRecord | null>(null);

  const sampleImages = useMemo(() => SAMPLE_IMAGES, []);

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const gradient = ctx.createRadialGradient(540, 300, 40, 540, 540, 760);
    gradient.addColorStop(0, '#231251');
    gradient.addColorStop(0.55, '#070616');
    gradient.addColorStop(1, '#02030a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const image = await loadImage(profileSrc);

    ctx.save();
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 24, 0, Math.PI * 2);
    ctx.clip();
    drawCover(ctx, image, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.globalCompositeOperation = 'source-over';

    if (accessories.hat) {
      const hat = await loadImage(HAT);
      ctx.drawImage(hat, 177, -4, 726, 312);
    }
    if (accessories.shades) {
      const shades = await loadImage(SHADES);
      ctx.drawImage(shades, 118, 290, 844, 284);
    }
    if (accessories.chain) {
      const chain = await loadImage(CHAIN);
      ctx.drawImage(chain, 234, 662, 612, 368);
    }

    const ring = ctx.createLinearGradient(80, 80, 1000, 1000);
    ring.addColorStop(0, '#9945ff');
    ring.addColorStop(0.5, '#14f195');
    ring.addColorStop(1, '#9945ff');
    ctx.strokeStyle = ring;
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }, [accessories, profileSrc]);

  useEffect(() => {
    renderCanvas().catch((err) => {
      console.error(err);
      setError('Could not render this image. Try another upload.');
    });
  }, [renderCanvas]);

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload a PNG, JPG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Max upload is 10MB.');
      return;
    }
    setError('');
    setSelectedAvatar(null);
    dataUrlFromFile(file).then((src) => setProfileSrc(src)).catch(() => setError('Could not read file.'));
  }

  function toggleAccessory(key: keyof AccessoryState) {
    setAccessories((current) => ({ ...current, [key]: !current[key] }));
    setSelectedAvatar(null);
  }

  function getCanvasDataUrl() {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas is not ready.');
    return canvas.toDataURL('image/png');
  }

  async function saveAvatar() {
    setSaving(true);
    setError('');
    try {
      await renderCanvas();
      const imageData = getCanvasDataUrl();
      const res = await fetch(`${API}/avatars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData,
          accessories,
          ownerWallet: wallet.publicKey?.toBase58() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save avatar.');
      setSelectedAvatar(json.avatar);
      setMessage('Saved to the gallery. Now export or mint it.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save avatar.');
    } finally {
      setSaving(false);
    }
  }

  async function exportForTwitter() {
    await renderCanvas();
    const dataUrl = getCanvasDataUrl();
    downloadDataUrl(dataUrl, 'clawd-solana-pfp.png');
    window.open('https://x.com/settings/profile', '_blank', 'noopener,noreferrer');
  }

  async function mintAsNft() {
    setError('');
    setMinting(true);
    try {
      if (!wallet.connected || !wallet.publicKey || !wallet.wallet?.adapter) {
        throw new Error('Connect your Solana wallet before minting.');
      }

      const avatar = selectedAvatar;
      if (!avatar) {
        await saveAvatar();
        throw new Error('Avatar saved. Click Mint again to sign the NFT transaction.');
      }

      const metadataRes = await fetch(`${API}/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarId: avatar.id }),
      });
      const metadataJson = await metadataRes.json();
      if (!metadataRes.ok) throw new Error(metadataJson.error || 'Could not create NFT metadata.');

      const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com';
      const namePrefix = process.env.NEXT_PUBLIC_NFT_NAME_PREFIX || 'Clawd PFP';

      const umi = createUmi(rpc)
        .use(mplCore())
        .use(walletAdapterIdentity(wallet.wallet.adapter));

      const asset = generateSigner(umi);
      const result = await create(umi, {
        asset,
        name: `${namePrefix} #${avatar.id.slice(0, 6)}`,
        uri: metadataJson.metadataUrl,
      }).sendAndConfirm(umi);

      const signature = bs58.encode(result.signature);
      const mintAddress = asset.publicKey.toString();

      await fetch(`${API}/avatars/${avatar.id}/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nftMint: mintAddress, nftSignature: signature }),
      });

      setSelectedAvatar({ ...avatar, nft_mint: mintAddress, nft_signature: signature, metadata_url: metadataJson.metadataUrl });
      setMessage(`Minted as a Solana Core NFT: ${mintAddress}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mint failed.');
    } finally {
      setMinting(false);
    }
  }

  return (
    <section className="app-grid">
      <div className="card studio">
        <aside className="sidebar" aria-label="Generator navigation">
          <div className="nav-pill active"><span className="nav-emoji">☺</span>Generator</div>
          <div className="nav-pill"><span className="nav-emoji">🧢</span>Accessories</div>
          <div className="nav-pill"><span className="nav-emoji">⛓</span>Chains</div>
          <div className="nav-pill"><span className="nav-emoji">▵</span>Backgrounds</div>
          <div className="nav-pill"><span className="nav-emoji">✦</span>Creations</div>
        </aside>

        <div className="studio-main">
          <div className="studio-layout">
            {/* Left: character picker + upload */}
            <div>
              <div className="step-row"><span className="step-number">1</span> Choose a character</div>
              <div className="samples">
                <div className="small">Clawd characters</div>
                <div className="sample-list">
                  {sampleImages.map(({ src, label }) => (
                    <button
                      key={src}
                      type="button"
                      className={`sample-button${profileSrc === src ? ' active' : ''}`}
                      title={label}
                      onClick={() => { setProfileSrc(src); setSelectedAvatar(null); }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={label} />
                      <span className="sample-label">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="step-row" style={{ marginTop: '1rem' }}>
                <span className="step-number">or</span> Upload your own
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={onFileChange}
              />
              <button type="button" className="upload-box" onClick={() => fileInputRef.current?.click()}>
                <span>
                  <div className="upload-icon">☁️</div>
                  <div className="upload-title">Upload any<br />profile picture</div>
                  <div className="small">PNG, JPG or WEBP · max 10MB</div>
                </span>
              </button>
            </div>

            {/* Center: canvas preview */}
            <div className="preview-wrap">
              <div className="canvas-shell">
                <canvas ref={canvasRef} aria-label="Live avatar preview" />
              </div>
              <span className="live-dot">Live Preview</span>
            </div>

            {/* Right: trait toggles */}
            <div>
              <div className="step-row"><span className="step-number">2</span> Swap traits</div>
              <div className="accessory-list">
                <AccessoryCard
                  image={HAT}
                  title="Make Solana AI Great Again Hat"
                  on={accessories.hat}
                  onClick={() => toggleAccessory('hat')}
                />
                <AccessoryCard
                  image={SHADES}
                  title="Solana Summer Shades"
                  on={accessories.shades}
                  onClick={() => toggleAccessory('shades')}
                />
                <AccessoryCard
                  image={CHAIN}
                  title="Clawd Chain"
                  on={accessories.chain}
                  onClick={() => toggleAccessory('chain')}
                />
              </div>
            </div>
          </div>

          <div className="actions">
            <button type="button" className="btn primary" onClick={saveAvatar} disabled={saving}>
              {saving ? 'Saving…' : 'Save to Gallery'}
            </button>
            <button type="button" className="btn" onClick={exportForTwitter}>Export for Twitter</button>
            <button type="button" className="btn purple" onClick={mintAsNft} disabled={minting}>
              {minting ? 'Minting…' : 'Mint as Solana NFT'}
            </button>
          </div>

          {error ? <p className="notice error">{error}</p> : <p className="notice">{message}</p>}
          {selectedAvatar?.nft_mint && <p className="notice">NFT mint: {selectedAvatar.nft_mint}</p>}
        </div>
      </div>

      <aside className="card mascot-card">
        <h2>Clawd drip, on-chain.</h2>
        <p>
          Pick a Clawd character or upload your own PFP, remix it with the hat, Solana summer
          shades, and the Clawd chain, then export for Twitter/X or mint as a Solana NFT.
        </p>
        <div className="mascot-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/samples/clawd-character-2.png" alt="Clawd mascot" width="520" height="520" />
        </div>
      </aside>
    </section>
  );
}

function AccessoryCard({
  image,
  title,
  on,
  onClick,
}: {
  image: string;
  title: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <div className="accessory-card">
      <div className="accessory-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" />
      </div>
      <strong>{title}</strong>
      <button type="button" className={`switch ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
        <span />
      </button>
    </div>
  );
}
