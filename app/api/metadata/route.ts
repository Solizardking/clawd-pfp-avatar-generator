import { dbGetAvatar, dbUpdateAvatar } from '@/lib/cloudflare/db';
import { r2PublicUrl, r2Put } from '@/lib/cloudflare/r2';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { avatarId } = await request.json();
    if (!avatarId || typeof avatarId !== 'string') throw new Error('avatarId is required.');

    const avatar = await dbGetAvatar(avatarId);
    if (!avatar) throw new Error('Avatar not found.');

    const attributes = Object.entries(avatar.accessories || {})
      .filter(([, enabled]) => Boolean(enabled))
      .map(([trait]) => ({ trait_type: 'Accessory', value: trait }));

    if (avatar.config?.background) {
      attributes.push({ trait_type: 'Background', value: avatar.config.background });
    }
    if (avatar.config?.frame) {
      attributes.push({ trait_type: 'Frame', value: avatar.config.frame });
    }
    if (avatar.source_label) {
      attributes.push({ trait_type: 'Source', value: avatar.source_label });
    }

    const metadata = {
      name: `Clawd PFP #${avatar.id.slice(0, 6)}`,
      symbol: process.env.NEXT_PUBLIC_NFT_SYMBOL || 'CLAWD',
      description: 'A custom Solana-themed Clawd PFP generated with the Clawd PFP Avatar Generator.',
      image: avatar.image_url,
      external_url: process.env.NEXT_PUBLIC_APP_URL || 'https://x402.wtf',
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
    return Response.json({ metadataUrl, metadata, avatar: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create metadata.';
    return Response.json({ error: message }, { status: 400 });
  }
}
