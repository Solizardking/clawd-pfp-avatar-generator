export const runtime = 'nodejs';

const CLAWD_MINT = '8cHzQHUS2s2h8TzCmfqPKYiM4dSt4roa3n7MyRLApump';

async function hasClawd(walletAddress: string): Promise<boolean> {
  const rpc =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const res = await fetch(rpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [walletAddress, { mint: CLAWD_MINT }, { encoding: 'jsonParsed' }],
    }),
  });
  const json = (await res.json()) as {
    result?: {
      value?: Array<{
        account: { data: { parsed: { info: { tokenAmount: { uiAmount: number } } } } };
      }>;
    };
  };
  return (json.result?.value ?? []).some(
    (acc) => acc.account.data.parsed.info.tokenAmount.uiAmount > 0
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Image generation unavailable.' }, { status: 503 });
  }

  const body = (await request.json()) as { prompt?: string; walletAddress?: string };
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 1000) : '';
  const walletAddress = typeof body.walletAddress === 'string' ? body.walletAddress : '';

  if (!prompt) {
    return Response.json({ error: 'Prompt is required.' }, { status: 400 });
  }
  if (!walletAddress) {
    return Response.json({ error: 'Wallet not connected.' }, { status: 401 });
  }

  const holds = await hasClawd(walletAddress);
  if (!holds) {
    return Response.json(
      { error: 'You need $CLAWD tokens to use Grok image generation.' },
      { status: 403 }
    );
  }

  const upstream = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-imagine-image-quality',
      prompt,
      response_format: 'b64_json',
    }),
  });

  if (!upstream.ok) {
    const err = (await upstream.json().catch(() => ({}))) as { error?: { message?: string } };
    return Response.json(
      { error: err.error?.message || 'Image generation failed.' },
      { status: upstream.status }
    );
  }

  const data = (await upstream.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return Response.json({ error: 'No image returned.' }, { status: 502 });

  return Response.json({ image: `data:image/jpeg;base64,${b64}` });
}
