# Clawd PFP Studio

Next.js app for generating polished Clawd profile pictures, saving final PNGs to Cloudflare R2, showing a live gallery, and minting saved images as Metaplex Core NFTs.

## Features

- 1080px canvas-based PFP renderer
- Clawd source picker plus custom image upload
- Background, frame, trait, zoom, offset, and rotation controls
- Cloudflare R2 image storage and JSON record storage
- Realtime gallery over Server-Sent Events with polling fallback
- PNG download and Solana NFT mint flow

## Environment

Create `.env` or `.env.local` with:

```bash
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ACCESS_KEY_ID=
CLOUDFLARE_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET=clawd
CLOUDFLARE_R2_PUBLIC_URL=

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_NFT_SYMBOL=CLAWD
NEXT_PUBLIC_NFT_NAME_PREFIX=Clawd PFP
```

`CLOUDFLARE_R2_PUBLIC_URL` should point at the public R2 bucket/custom-domain base URL. Keep Cloudflare access keys server-only.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Verify Cloudflare

```bash
curl http://localhost:3000/api/health
```

The response reports whether the required R2 environment variables are present.

## Optional Express API

The `server/` app exposes the same `/avatars`, `/avatars/stream`, `/metadata`, and `/health` API surface for Render or another Node host.

```bash
cd server
npm install
npm run build
npm start
```

Set `NEXT_PUBLIC_API_URL` in the Next app when using the standalone API.
