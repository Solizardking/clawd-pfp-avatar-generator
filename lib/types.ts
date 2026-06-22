export type AccessoryState = {
  hat: boolean;
  shades: boolean;
  chain: boolean;
};

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

export type ApiError = {
  error: string;
};
