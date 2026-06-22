import { r2Put, r2PublicUrl } from '@/lib/cloudflare/r2';
import { dbListAvatars, dbSaveAvatar } from '@/lib/cloudflare/db';
import type { AccessoryState, AvatarGeneratorConfig, AvatarRecord } from '@/lib/types';

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

export async function GET() {
  try {
    const avatars = await dbListAvatars(60);
    return Response.json(
      { avatars, source: 'cloudflare-r2' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
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
    const config = safeConfig(body.config);
    const sourceLabel =
      typeof body.sourceLabel === 'string' ? body.sourceLabel.trim().slice(0, 80) || null : null;

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
      config,
      source_label: sourceLabel,
      metadata_url: null,
      nft_mint: null,
      nft_signature: null,
    };

    await dbSaveAvatar(avatar);
    return Response.json(
      { avatar, source: 'cloudflare-r2' },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save avatar.';
    return Response.json({ error: message }, { status: 400 });
  }
}
