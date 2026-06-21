import { r2Put, r2PublicUrl } from '@/lib/cloudflare/r2';
import { dbListAvatars, dbSaveAvatar } from '@/lib/cloudflare/db';
import type { AccessoryState, AvatarRecord } from '@/lib/types';

export const runtime = 'nodejs';

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

export async function GET() {
  try {
    const avatars = await dbListAvatars(60);
    return Response.json({ avatars });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load avatars.';
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const imageData = String(body.imageData || '');
    const ownerWallet = body.ownerWallet ? String(body.ownerWallet) : null;
    const accessories = safeAccessories(body.accessories);

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
      owner_wallet: ownerWallet,
      accessories,
      metadata_url: null,
      nft_mint: null,
      nft_signature: null,
    };

    await dbSaveAvatar(avatar);
    return Response.json({ avatar }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save avatar.';
    return Response.json({ error: message }, { status: 400 });
  }
}
