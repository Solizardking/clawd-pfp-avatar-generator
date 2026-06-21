import { Router } from 'express';
import type { Request, Response } from 'express';
import { dbGetAvatar, dbUpdateAvatar } from '../lib/db';
import { r2PublicUrl, r2Put } from '../lib/r2';

export const metadataRouter = Router();

metadataRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { avatarId } = req.body as { avatarId?: string };
    if (!avatarId || typeof avatarId !== 'string') throw new Error('avatarId is required.');

    const avatar = await dbGetAvatar(avatarId);
    if (!avatar) throw new Error('Avatar not found.');

    const attributes = Object.entries(avatar.accessories || {})
      .filter(([, enabled]) => Boolean(enabled))
      .map(([trait]) => ({ trait_type: 'Accessory', value: trait }));

    const metadata = {
      name: `Clawd PFP #${avatar.id.slice(0, 6)}`,
      symbol: process.env.NFT_SYMBOL || 'CLAWD',
      description: 'A custom Solana-themed Clawd PFP generated with the Clawd PFP Avatar Generator.',
      image: avatar.image_url,
      external_url: process.env.APP_URL || 'https://x402.wtf',
      attributes,
      properties: {
        category: 'image',
        files: [{ uri: avatar.image_url, type: 'image/png' }],
      },
    };

    const metadataPath = `metadata/${avatar.id}.json`;
    await r2Put(metadataPath, JSON.stringify(metadata, null, 2), 'application/json');
    const metadataUrl = r2PublicUrl(metadataPath);

    const updated = await dbUpdateAvatar(avatar.id, { metadata_url: metadataUrl });
    res.json({ metadataUrl, metadata, avatar: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create metadata.';
    res.status(400).json({ error: message });
  }
});
