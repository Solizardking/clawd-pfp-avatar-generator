export type AccessoryState = {
  hat: boolean;
  shades: boolean;
  chain: boolean;
};

export type AvatarRecord = {
  id: string;
  created_at: string;
  image_url: string;
  storage_path: string;
  owner_wallet: string | null;
  accessories: AccessoryState;
  metadata_url: string | null;
  nft_mint: string | null;
  nft_signature: string | null;
};

export type ApiError = {
  error: string;
};
