'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import bs58 from 'bs58';
import { create, mplCore } from '@metaplex-foundation/mpl-core';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { generateSigner } from '@metaplex-foundation/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { useWallet } from '@solana/wallet-adapter-react';
import type { AccessoryState, AvatarGeneratorConfig, AvatarRecord } from '@/lib/types';

const CANVAS_SIZE = 1080;
const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const HAT = '/accessories/hat.svg';
const SHADES = '/accessories/shades.svg';
const CHAIN = '/accessories/chain.svg';

type SourceFit = 'cover' | 'contain';
type SampleImage = {
  src: string;
  label: string;
  fit: SourceFit;
};

type BackgroundPreset = {
  id: string;
  label: string;
  swatch: string;
  stops: [number, string][];
  accent: string;
  grid: string;
};

type FramePreset = {
  id: string;
  label: string;
  stops: [number, string][];
};

const SAMPLE_IMAGES: SampleImage[] = [
  { src: '/master/clawd_mascot_hq_square_transparent.png', label: 'Clawd Prime', fit: 'contain' },
  { src: '/samples/clawd-mascot-square.png', label: 'Clawd Square', fit: 'contain' },
  { src: '/samples/clawd-character.png', label: 'Clawd Grab', fit: 'contain' },
  { src: '/samples/clawd-character-2.png', label: 'Clawd Alt', fit: 'contain' },
  { src: '/samples/clawd.svg', label: 'Classic Mark', fit: 'contain' },
];

const BACKGROUNDS: BackgroundPreset[] = [
  {
    id: 'eclipse',
    label: 'Eclipse',
    swatch: 'linear-gradient(135deg, #04050a, #273044 48%, #14f195)',
    stops: [
      [0, '#11131d'],
      [0.42, '#20283b'],
      [1, '#05060a'],
    ],
    accent: '#14f195',
    grid: 'rgba(255, 255, 255, 0.08)',
  },
  {
    id: 'prism',
    label: 'Prism',
    swatch: 'linear-gradient(135deg, #101116, #9945ff 45%, #14f195)',
    stops: [
      [0, '#15121f'],
      [0.5, '#2b1d48'],
      [1, '#071a18'],
    ],
    accent: '#9945ff',
    grid: 'rgba(20, 241, 149, 0.08)',
  },
  {
    id: 'signal',
    label: 'Signal',
    swatch: 'linear-gradient(135deg, #091416, #0f766e 52%, #d7b46a)',
    stops: [
      [0, '#08100f'],
      [0.48, '#123d3a'],
      [1, '#1c1710'],
    ],
    accent: '#d7b46a',
    grid: 'rgba(215, 180, 106, 0.09)',
  },
  {
    id: 'mono',
    label: 'Mono',
    swatch: 'linear-gradient(135deg, #111111, #3d4652 55%, #f4f0e8)',
    stops: [
      [0, '#111111'],
      [0.58, '#2b3138'],
      [1, '#f4f0e8'],
    ],
    accent: '#f4f0e8',
    grid: 'rgba(255, 255, 255, 0.08)',
  },
];

const FRAMES: FramePreset[] = [
  {
    id: 'solana',
    label: 'Solana',
    stops: [
      [0, '#9945ff'],
      [0.48, '#00c2ff'],
      [1, '#14f195'],
    ],
  },
  {
    id: 'gold',
    label: 'Gold',
    stops: [
      [0, '#fff2a8'],
      [0.5, '#d68a22'],
      [1, '#6b390c'],
    ],
  },
  {
    id: 'chrome',
    label: 'Chrome',
    stops: [
      [0, '#f7f7ff'],
      [0.5, '#737987'],
      [1, '#ffffff'],
    ],
  },
  {
    id: 'none',
    label: 'None',
    stops: [
      [0, 'transparent'],
      [1, 'transparent'],
    ],
  },
];

const DEFAULT_ACCESSORIES: AccessoryState = {
  hat: true,
  shades: true,
  chain: true,
};

const DEFAULT_CONFIG: AvatarGeneratorConfig = {
  background: 'eclipse',
  frame: 'solana',
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

const ACCESSORY_CARDS: {
  key: keyof AccessoryState;
  image: string;
  title: string;
  detail: string;
}[] = [
  { key: 'hat', image: HAT, title: 'Campaign Hat', detail: 'Top crown layer' },
  { key: 'shades', image: SHADES, title: 'Summer Shades', detail: 'Eye line overlay' },
  { key: 'chain', image: CHAIN, title: 'Clawd Chain', detail: 'Lower foreground' },
];

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${src}`));
    image.src = src;
  });

  imageCache.set(src, promise);
  return promise;
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

function presetById<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) || items[0];
}

function drawBackground(ctx: CanvasRenderingContext2D, preset: BackgroundPreset) {
  const gradient = ctx.createRadialGradient(320, 210, 80, 540, 560, 780);
  preset.stops.forEach(([stop, color]) => gradient.addColorStop(stop, color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = preset.grid;
  ctx.lineWidth = 2;
  for (let x = -CANVAS_SIZE; x < CANVAS_SIZE * 2; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + CANVAS_SIZE, CANVAS_SIZE);
    ctx.stroke();
  }
  ctx.restore();

  const flare = ctx.createRadialGradient(760, 260, 10, 760, 260, 460);
  flare.addColorStop(0, `${preset.accent}55`);
  flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = flare;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

function drawSourceImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  fit: SourceFit,
  config: AvatarGeneratorConfig
) {
  const targetSize = fit === 'contain' ? CANVAS_SIZE * 0.84 : CANVAS_SIZE * 1.04;
  const imageScale =
    fit === 'contain'
      ? Math.min(targetSize / image.width, targetSize / image.height)
      : Math.max(targetSize / image.width, targetSize / image.height);
  const width = image.width * imageScale;
  const height = image.height * imageScale;

  ctx.save();
  ctx.translate(CANVAS_SIZE / 2 + config.offsetX, CANVAS_SIZE / 2 + config.offsetY);
  ctx.rotate((config.rotation * Math.PI) / 180);
  ctx.scale(config.scale, config.scale);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawFrame(ctx: CanvasRenderingContext2D, preset: FramePreset) {
  if (preset.id === 'none') return;

  const ring = ctx.createLinearGradient(96, 92, 985, 1000);
  preset.stops.forEach(([stop, color]) => ring.addColorStop(stop, color));

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.38)';
  ctx.shadowBlur = 38;
  ctx.strokeStyle = ring;
  ctx.lineWidth = 30;
  ctx.beginPath();
  ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 55, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawFinish(ctx: CanvasRenderingContext2D) {
  const vignette = ctx.createRadialGradient(540, 420, 280, 540, 540, 620);
  vignette.addColorStop(0, 'rgba(255, 255, 255, 0)');
  vignette.addColorStop(0.72, 'rgba(0, 0, 0, 0.06)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AvatarStudio() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const renderIdRef = useRef(0);
  const wallet = useWallet();

  const [source, setSource] = useState<SampleImage>(SAMPLE_IMAGES[0]);
  const [accessories, setAccessories] = useState<AccessoryState>(DEFAULT_ACCESSORIES);
  const [config, setConfig] = useState<AvatarGeneratorConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [minting, setMinting] = useState(false);
  const [lastRenderedAt, setLastRenderedAt] = useState<Date | null>(null);
  const [message, setMessage] = useState('Live preview is ready. Save when the PFP matches the drop.');
  const [error, setError] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarRecord | null>(null);

  const background = useMemo(() => presetById(BACKGROUNDS, config.background), [config.background]);
  const frame = useMemo(() => presetById(FRAMES, config.frame), [config.frame]);
  const activeTraitCount = Object.values(accessories).filter(Boolean).length;

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderId = renderIdRef.current + 1;
    renderIdRef.current = renderId;

    const enabledAccessoryImages = await Promise.all(
      ACCESSORY_CARDS.filter((item) => accessories[item.key]).map(async (item) => ({
        key: item.key,
        image: await loadImage(item.image),
      }))
    );
    const image = await loadImage(source.src);

    if (renderId !== renderIdRef.current) return;

    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    drawBackground(ctx, background);

    ctx.save();
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 58, 0, Math.PI * 2);
    ctx.clip();
    drawSourceImage(ctx, image, source.fit, config);

    enabledAccessoryImages.forEach(({ key, image: accessory }) => {
      if (key === 'hat') ctx.drawImage(accessory, 177, -8, 726, 312);
      if (key === 'shades') ctx.drawImage(accessory, 118, 290, 844, 284);
      if (key === 'chain') ctx.drawImage(accessory, 234, 660, 612, 368);
    });

    drawFinish(ctx);
    ctx.restore();
    drawFrame(ctx, frame);

    setLastRenderedAt(new Date());
  }, [accessories, background, config, frame, source]);

  useEffect(() => {
    renderCanvas().catch((err) => {
      console.error(err);
      setError('Could not render this image. Try another source file.');
    });
  }, [renderCanvas]);

  function updateConfig(updates: Partial<AvatarGeneratorConfig>) {
    setConfig((current) => ({ ...current, ...updates }));
    setSelectedAvatar(null);
  }

  function setSample(next: SampleImage) {
    setSource(next);
    setConfig((current) => ({ ...current, scale: 1, offsetX: 0, offsetY: 0, rotation: 0 }));
    setSelectedAvatar(null);
    setError('');
  }

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
    dataUrlFromFile(file)
      .then((src) => setSource({ src, label: file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Upload', fit: 'cover' }))
      .catch(() => setError('Could not read file.'));
  }

  function toggleAccessory(key: keyof AccessoryState) {
    setAccessories((current) => ({ ...current, [key]: !current[key] }));
    setSelectedAvatar(null);
  }

  function randomize() {
    const sample = SAMPLE_IMAGES[Math.floor(Math.random() * SAMPLE_IMAGES.length)];
    const bg = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];
    const ring = FRAMES[Math.floor(Math.random() * (FRAMES.length - 1))];
    setSource(sample);
    setAccessories({
      hat: Math.random() > 0.18,
      shades: Math.random() > 0.25,
      chain: Math.random() > 0.35,
    });
    setConfig({
      background: bg.id,
      frame: ring.id,
      scale: Number((0.94 + Math.random() * 0.18).toFixed(2)),
      offsetX: Math.round((Math.random() - 0.5) * 60),
      offsetY: Math.round((Math.random() - 0.5) * 54),
      rotation: Math.round((Math.random() - 0.5) * 4),
    });
    setSelectedAvatar(null);
    setMessage('Generated a fresh combination. Tune the crop or save it to Cloudflare.');
  }

  function resetCrop() {
    updateConfig({ scale: 1, offsetX: 0, offsetY: 0, rotation: 0 });
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
          config,
          sourceLabel: source.label,
          ownerWallet: wallet.publicKey?.toBase58() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save avatar.');
      const avatar = json.avatar as AvatarRecord;
      setSelectedAvatar(avatar);
      setMessage('Saved to Cloudflare R2 and pushed into the live gallery.');
      window.dispatchEvent(new CustomEvent('clawd:avatar-created', { detail: { avatar } }));
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('clawd-avatar-gallery');
        channel.postMessage({ type: 'avatar-created', avatar });
        channel.close();
      }
      return avatar;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save avatar.');
      return null;
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

      let avatar = selectedAvatar;
      if (!avatar) {
        avatar = await saveAvatar();
        if (!avatar) throw new Error('Avatar could not be saved before minting.');
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

      const updatedAvatar = {
        ...avatar,
        nft_mint: mintAddress,
        nft_signature: signature,
        metadata_url: metadataJson.metadataUrl,
      };
      setSelectedAvatar(updatedAvatar);
      setMessage(`Minted as a Solana Core NFT: ${mintAddress}`);
      window.dispatchEvent(new CustomEvent('clawd:avatar-created', { detail: { avatar: updatedAvatar } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mint failed.');
    } finally {
      setMinting(false);
    }
  }

  return (
    <section className="studio-shell">
      <div className="studio-panel generator-panel">
        <div className="studio-toolbar">
          <div>
            <p className="eyebrow">Cloudflare PFP Studio</p>
            <h2>Generate a production-ready Clawd avatar.</h2>
          </div>
          <div className="toolbar-actions">
            <button type="button" className="icon-button" onClick={randomize} title="Generate random Clawd PFP">
              <span aria-hidden="true">↻</span>
            </button>
            <button type="button" className="icon-button" onClick={resetCrop} title="Reset crop">
              <span aria-hidden="true">⌖</span>
            </button>
          </div>
        </div>

        <div className="generator-layout">
          <div className="control-column">
            <ControlGroup title="Source">
              <div className="sample-grid">
                {SAMPLE_IMAGES.map((item) => (
                  <button
                    key={item.src}
                    type="button"
                    className={`sample-tile${source.src === item.src ? ' active' : ''}`}
                    onClick={() => setSample(item)}
                    title={item.label}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.src} alt={item.label} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={onFileChange}
              />
              <button type="button" className="upload-control" onClick={() => fileInputRef.current?.click()}>
                Upload PNG, JPG, or WebP
              </button>
            </ControlGroup>

            <ControlGroup title="Background">
              <div className="swatch-grid">
                {BACKGROUNDS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`swatch-button${config.background === item.id ? ' active' : ''}`}
                    onClick={() => updateConfig({ background: item.id })}
                    title={item.label}
                  >
                    <span className="swatch" style={{ background: item.swatch }} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </ControlGroup>

            <ControlGroup title="Frame">
              <div className="segmented-control">
                {FRAMES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={config.frame === item.id ? 'active' : ''}
                    onClick={() => updateConfig({ frame: item.id })}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </ControlGroup>
          </div>

          <div className="preview-column">
            <div className="preview-header">
              <div>
                <p className="eyebrow">Realtime Canvas</p>
                <strong>{source.label}</strong>
              </div>
              <span className="live-badge">Live</span>
            </div>

            <div className="canvas-stage">
              <div className="canvas-shell">
                <canvas ref={canvasRef} aria-label="Live avatar preview" />
              </div>
            </div>

            <div className="preview-stats">
              <span>{activeTraitCount}/3 traits</span>
              <span>{background.label}</span>
              <span>{frame.label} frame</span>
              <span>{lastRenderedAt ? formatTime(lastRenderedAt) : 'Rendering'}</span>
            </div>

            <div className="actions">
              <button type="button" className="btn primary" onClick={saveAvatar} disabled={saving}>
                {saving ? 'Saving...' : 'Save to Cloudflare'}
              </button>
              <button type="button" className="btn" onClick={exportForTwitter}>Download PFP</button>
              <button type="button" className="btn accent" onClick={mintAsNft} disabled={minting}>
                {minting ? 'Minting...' : 'Mint NFT'}
              </button>
            </div>

            {error ? <p className="notice error">{error}</p> : <p className="notice">{message}</p>}
            {selectedAvatar?.nft_mint && <p className="notice">NFT mint: {selectedAvatar.nft_mint}</p>}
          </div>

          <div className="control-column">
            <ControlGroup title="Traits">
              <div className="accessory-list">
                {ACCESSORY_CARDS.map((item) => (
                  <AccessoryCard
                    key={item.key}
                    image={item.image}
                    title={item.title}
                    detail={item.detail}
                    on={accessories[item.key]}
                    onClick={() => toggleAccessory(item.key)}
                  />
                ))}
              </div>
            </ControlGroup>

            <ControlGroup title="Crop">
              <RangeControl
                label="Zoom"
                value={config.scale}
                min={0.82}
                max={1.34}
                step={0.01}
                display={`${Math.round(config.scale * 100)}%`}
                onChange={(scale) => updateConfig({ scale })}
              />
              <RangeControl
                label="Horizontal"
                value={config.offsetX}
                min={-180}
                max={180}
                step={1}
                display={`${config.offsetX}px`}
                onChange={(offsetX) => updateConfig({ offsetX })}
              />
              <RangeControl
                label="Vertical"
                value={config.offsetY}
                min={-180}
                max={180}
                step={1}
                display={`${config.offsetY}px`}
                onChange={(offsetY) => updateConfig({ offsetY })}
              />
              <RangeControl
                label="Rotate"
                value={config.rotation}
                min={-8}
                max={8}
                step={0.5}
                display={`${config.rotation}°`}
                onChange={(rotation) => updateConfig({ rotation })}
              />
            </ControlGroup>
          </div>
        </div>
      </div>

      <aside className="studio-panel proof-panel">
        <div>
          <p className="eyebrow">Output Pipeline</p>
          <h2>Canvas to R2, metadata, and gallery.</h2>
          <p>
            The generator renders a 1080px PNG locally, uploads the final artifact to Cloudflare
            R2, stores a JSON record beside it, and broadcasts the new record into the live gallery.
          </p>
        </div>
        <div className="pipeline-list">
          <PipelineItem label="Render" value="1080px PNG" />
          <PipelineItem label="Storage" value="Cloudflare R2" />
          <PipelineItem label="Gallery" value="SSE + fallback poll" />
          <PipelineItem label="Minting" value="Metaplex Core" />
        </div>
        <div className="proof-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/samples/clawd-character-2.png" alt="Clawd mascot" width="520" height="520" />
        </div>
      </aside>
    </section>
  );
}

function ControlGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="control-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function AccessoryCard({
  image,
  title,
  detail,
  on,
  onClick,
}: {
  image: string;
  title: string;
  detail: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`accessory-card${on ? ' active' : ''}`} aria-pressed={on} onClick={onClick}>
      <span className="accessory-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <span className={`switch ${on ? 'on' : ''}`} aria-hidden="true">
        <span />
      </span>
    </button>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-control">
      <span>
        <strong>{label}</strong>
        <small>{display}</small>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function PipelineItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="pipeline-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
