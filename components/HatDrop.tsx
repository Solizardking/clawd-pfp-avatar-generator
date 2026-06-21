'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const HAT_SRC = '/accessories/hat.svg';
const CANVAS_SIZE = 1080;
const SHARE_TEXT = 'Make Solana AI Great Again 🐱⛓️ $CLAWD\n\nGet your hat 👇';
const SHARE_URL = 'https://clawd-pfp-avatar-generator.vercel.app';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function dataUrlFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function HatDrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [copying, setCopying] = useState(false);

  const render = useCallback(async (src: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = CANVAS_SIZE;
    canvas.height = CANVAS_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const photo = await loadImage(src);
    // Square-crop cover fill
    const scale = Math.max(CANVAS_SIZE / photo.width, CANVAS_SIZE / photo.height);
    const sw = CANVAS_SIZE / scale;
    const sh = CANVAS_SIZE / scale;
    const sx = (photo.width - sw) / 2;
    const sy = (photo.height - sh) / 2;
    ctx.drawImage(photo, sx, sy, sw, sh, 0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Hat overlay — positioned in the top ~30% of the image
    const hat = await loadImage(HAT_SRC);
    const hatW = CANVAS_SIZE * 0.72;
    const hatH = (hat.height / hat.width) * hatW;
    const hatX = (CANVAS_SIZE - hatW) / 2;
    const hatY = -hatH * 0.08; // slight bleed off top
    ctx.drawImage(hat, hatX, hatY, hatW, hatH);

    setRendered(true);
  }, []);

  useEffect(() => {
    if (imageSrc) render(imageSrc).catch(console.error);
  }, [imageSrc, render]);

  function pickFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setRendered(false);
    dataUrlFromFile(file).then(setImageSrc).catch(console.error);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  function getDataUrl(): string {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error('Canvas not ready');
    return canvas.toDataURL('image/png');
  }

  function download() {
    const dataUrl = getDataUrl();
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'make-solana-ai-great-again.png';
    a.click();
  }

  async function shareToX() {
    // Download image first so user can attach it
    download();
    // Small delay so the download starts before tab opens
    await new Promise((r) => setTimeout(r, 300));
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}`;
    window.open(tweetUrl, '_blank', 'noopener,noreferrer');
  }

  async function copyImage() {
    try {
      setCopying(true);
      const canvas = canvasRef.current!;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setTimeout(() => setCopying(false), 1400);
      }, 'image/png');
    } catch {
      setCopying(false);
    }
  }

  return (
    <section className="card hat-drop-card">
      <div className="hat-drop-header">
        <div>
          <h2>🧢 Hat Drop</h2>
          <p>Upload any photo — we slap the Make Solana AI Great Again hat on it. One click to share on X.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={HAT_SRC} alt="Hat" className="hat-preview-img" />
      </div>

      <div className="hat-drop-body">
        {/* Upload zone */}
        <div
          className={`hat-upload-zone${dragging ? ' drag-over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload image for hat"
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onFileChange}
          />
          {imageSrc ? (
            <div className="hat-upload-hint">Click or drop to swap image</div>
          ) : (
            <>
              <div className="hat-upload-icon">🖼️</div>
              <div className="hat-upload-title">Drop your photo here</div>
              <div className="small">Any image — PNG, JPG, WEBP</div>
            </>
          )}
        </div>

        {/* Canvas preview */}
        <div className="hat-canvas-wrap">
          <canvas
            ref={canvasRef}
            className={`hat-canvas${!imageSrc ? ' hat-canvas-empty' : ''}`}
            aria-label="Hat preview"
          />
          {!imageSrc && (
            <div className="hat-canvas-placeholder">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/master/clawd_mascot_hq_square_transparent.png" alt="Clawd demo" />
              <span>Your photo will appear here</span>
            </div>
          )}
        </div>
      </div>

      {rendered && (
        <div className="hat-actions">
          <button type="button" className="btn hat-share-btn" onClick={shareToX}>
            𝕏 Share on X
          </button>
          <button type="button" className="btn" onClick={download}>
            ↓ Download
          </button>
          <button type="button" className="btn" onClick={copyImage} disabled={copying}>
            {copying ? '✓ Copied!' : '⎘ Copy image'}
          </button>
        </div>
      )}
    </section>
  );
}
