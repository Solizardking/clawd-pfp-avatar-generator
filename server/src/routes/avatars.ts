import { Router } from 'express';
import type { Request, Response } from 'express';
import { r2PublicUrl, r2Put } from '../lib/r2';
import { dbListAvatars, dbSaveAvatar } from '../lib/db';
import type { AccessoryState, AvatarRecord } from '../lib/db';

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

export const avatarsRouter = Router();

avatarsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const avatars = await dbListAvatars(60);
    res.json({ avatars });
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
      metadata_url: null,
      nft_mint: null,
      nft_signature: null,
    };

    await dbSaveAvatar(avatar);
    res.status(201).json({ avatar });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save avatar.';
    res.status(400).json({ error: message });
  }
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
