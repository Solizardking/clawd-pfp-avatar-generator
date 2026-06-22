import { r2Get, r2List, r2Put } from './r2';

export type AccessoryState = { hat: boolean; shades: boolean; chain: boolean };

export type AvatarGeneratorConfig = {
  background: string;
  frame: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
};

export type AvatarRecord = {
  id: string;
  created_at: string;
  image_url: string;
  storage_path: string;
  owner_wallet: string | null;
  accessories: AccessoryState;
  config?: AvatarGeneratorConfig;
  source_label?: string | null;
  metadata_url: string | null;
  nft_mint: string | null;
  nft_signature: string | null;
};

const PREFIX = 'records/';

export async function dbSaveAvatar(avatar: AvatarRecord): Promise<void> {
  await r2Put(`${PREFIX}${avatar.id}.json`, JSON.stringify(avatar), 'application/json');
}

export async function dbGetAvatar(id: string): Promise<AvatarRecord | null> {
  const raw = await r2Get(`${PREFIX}${id}.json`);
  return raw ? (JSON.parse(raw) as AvatarRecord) : null;
}

export async function dbUpdateAvatar(
  id: string,
  updates: Partial<AvatarRecord>
): Promise<AvatarRecord> {
  const existing = await dbGetAvatar(id);
  if (!existing) throw new Error('Avatar not found.');
  const updated = { ...existing, ...updates };
  await dbSaveAvatar(updated);
  return updated;
}

export async function dbListAvatars(limit = 60): Promise<AvatarRecord[]> {
  const files = await r2List(PREFIX, 1000);
  const sorted = files.sort(
    (a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0)
  );
  const top = sorted.slice(0, limit);
  const records = await Promise.all(
    top.map(async (f) => {
      const raw = await r2Get(f.key);
      return raw ? (JSON.parse(raw) as AvatarRecord) : null;
    })
  );
  return records.filter((r): r is AvatarRecord => r !== null);
}
