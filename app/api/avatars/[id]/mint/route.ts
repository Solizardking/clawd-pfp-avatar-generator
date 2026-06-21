import { dbUpdateAvatar } from '@/lib/cloudflare/db';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { nftMint, nftSignature } = await request.json();

    if (!id) throw new Error('Avatar id is required.');
    if (!nftMint || typeof nftMint !== 'string') throw new Error('nftMint is required.');

    const avatar = await dbUpdateAvatar(id, {
      nft_mint: nftMint,
      nft_signature: typeof nftSignature === 'string' ? nftSignature : null,
    });

    return Response.json({ avatar });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to record mint.';
    return Response.json({ error: message }, { status: 400 });
  }
}
