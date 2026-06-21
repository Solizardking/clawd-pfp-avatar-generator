export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are Clawd, a cheeky Solana cat mascot and the face of the Clawd PFP Avatar Generator. You help users create custom Solana-themed profile pictures, answer questions about the app, and hype up the $CLAWD token. You are fun, crypto-native, and concise. Keep replies short (2-4 sentences max). Never break character.`;

type Message = { role: 'user' | 'assistant' | 'system'; content: string };

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Chat unavailable — missing API key.' }, { status: 503 });
  }

  const { messages } = (await request.json()) as { messages: Message[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'messages array is required.' }, { status: 400 });
  }

  const model = process.env.OPENROUTER_FREE_MODEL || 'cohere/north-mini-code:free';

  const payload = {
    model,
    stream: true,
    max_tokens: 256,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
  };

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://x402.wtf',
      'X-Title': 'Clawd PFP Avatar Generator',
    },
    body: JSON.stringify(payload),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text();
    return Response.json({ error: text }, { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
