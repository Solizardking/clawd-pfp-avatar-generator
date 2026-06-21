# Clawd PFP Avatar Generator

A full-stack Next.js app for a Solana-themed avatar/PFP generator:

- Upload any profile picture
- Add the Make Solana AI Great Again hat
- Add Solana Summer Shades
- Add a Clawd chain
- Save generated images to Supabase Storage
- Show a live realtime public gallery through Supabase Realtime
- Export PNG for Twitter/X profile use
- Mint the saved image as a Metaplex Core NFT on Solana

## 1. Install

```bash
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`.

## 2. Supabase setup

Create a Supabase project, then run `supabase/schema.sql` in the SQL editor.

In your Supabase dashboard, enable Realtime for the `avatars` table if it is not already enabled by the SQL script.

## 3. Run

```bash
pnpm dev
```

Open http://localhost:3000.

## 4. Production notes

- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Never expose it in the browser.
- Use a dedicated Solana RPC URL for production.
- Start on devnet, then switch `NEXT_PUBLIC_SOLANA_RPC_URL` to your mainnet RPC when ready.
- The overlay assets are SVG files in `public/accessories`. Replace them with cleaned PNG/WebP cutouts from your artwork whenever you want exact extraction-grade assets.
