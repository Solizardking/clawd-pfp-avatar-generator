import { Router } from 'express';
import type { Request, Response } from 'express';
import { r2PublicUrl, r2Put } from '../lib/r2';
import { dbListAvatars, dbSaveAvatar } from '../lib/db';
import type { AccessoryState, AvatarGeneratorConfig, AvatarRecord } from '../lib/db';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function parsePngDataUrl(imageData: string): Buffer {
  const match = imageData.match(/^data:image\/(png|webp|jpeg);base64,(.+)$/);
  if (!match) throw new Error('Expected a base64 PNG, JPG, or WebP data URL.');
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > MAX_IMAGE_BYTES) throw new Error('Image is larger than 10MB.');
  return buffer;
}

function safeAccessories(input: unknown): AccessoryState {
  const value = input as Partial<AccessoryState> | undefined;
  return {
    hat: Boolean(value?.hat),
    shades: Boolean(value?.shades),
    chain: Boolean(value?.chain),
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function safeConfig(input: unknown): AvatarGeneratorConfig | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = input as Partial<AvatarGeneratorConfig>;

  return {
    background: typeof value.background === 'string' ? value.background.slice(0, 40) : 'eclipse',
    frame: typeof value.frame === 'string' ? value.frame.slice(0, 40) : 'solana',
    scale: clampNumber(value.scale, 1, 0.5, 2),
    offsetX: clampNumber(value.offsetX, 0, -540, 540),
    offsetY: clampNumber(value.offsetY, 0, -540, 540),
    rotation: clampNumber(value.rotation, 0, -30, 30),
  };
}

export const avatarsRouter = Router();

avatarsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const avatars = await dbListAvatars(60);
    res.set('Cache-Control', 'no-store').json({ avatars, source: 'cloudflare-r2' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load avatars.';
    res.status(500).json({ error: message });
  }
});

avatarsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { imageData, ownerWallet, accessories: accessoriesRaw } = req.body as {
      imageData?: string;
      ownerWallet?: string;
      accessories?: unknown;
      config?: unknown;
      sourceLabel?: string;
    };

    if (!imageData) throw new Error('imageData is required.');

    const buffer = parsePngDataUrl(imageData);
    const id = crypto.randomUUID();
    const storagePath = `generated/${id}.png`;

    await r2Put(storagePath, buffer, 'image/png');
    const imageUrl = r2PublicUrl(storagePath);

    const avatar: AvatarRecord = {
      id,
      created_at: new Date().toISOString(),
      image_url: imageUrl,
      storage_path: storagePath,
      owner_wallet: ownerWallet ? String(ownerWallet) : null,
      accessories: safeAccessories(accessoriesRaw),
      config: safeConfig(req.body.config),
      source_label:
        typeof req.body.sourceLabel === 'string'
          ? req.body.sourceLabel.trim().slice(0, 80) || null
          : null,
      metadata_url: null,
      nft_mint: null,
      nft_signature: null,
    };

    await dbSaveAvatar(avatar);
    res.status(201).set('Cache-Control', 'no-store').json({ avatar, source: 'cloudflare-r2' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save avatar.';
    res.status(400).json({ error: message });
  }
});

avatarsRouter.get('/stream', async (req: Request, res: Response) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  let inFlight = false;
  let lastPayload = '';

  const sendSnapshot = async () => {
    if (inFlight) return;
    inFlight = true;

    try {
      const avatars = await dbListAvatars(60);
      const payload = JSON.stringify({ avatars });
      if (payload !== lastPayload) {
        lastPayload = payload;
        res.write(`event: snapshot\ndata: ${JSON.stringify({ avatars, source: 'cloudflare-r2' })}\n\n`);
      } else {
        res.write(`: heartbeat ${Date.now()}\n\n`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cloudflare gallery stream failed.';
      res.write(`event: stream-error\ndata: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      inFlight = false;
    }
  };

  await sendSnapshot();
  const timer = setInterval(sendSnapshot, 2500);

  req.on('close', () => {
    clearInterval(timer);
    res.end();
  });
});

avatarsRouter.post('/:id/mint', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nftMint, nftSignature } = req.body as { nftMint?: string; nftSignature?: string };

    if (!id) throw new Error('Avatar id is required.');
    if (!nftMint || typeof nftMint !== 'string') throw new Error('nftMint is required.');

    const { dbUpdateAvatar } = await import('../lib/db');
    const avatar = await dbUpdateAvatar(id, {
      nft_mint: nftMint,
      nft_signature: typeof nftSignature === 'string' ? nftSignature : null,
    });

    res.json({ avatar });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record mint.';
    res.status(400).json({ error: message });
  }
});
