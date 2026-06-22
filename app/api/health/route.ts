import { getCloudflareR2Status } from '@/lib/cloudflare/r2';

export async function GET() {
  const r2 = getCloudflareR2Status();

  return Response.json(
    {
      ok: r2.configured,
      service: 'clawd-pfp-avatar-generator',
      realtime: 'sse-with-polling-fallback',
      cloudflare: {
        r2,
      },
    },
    {
      status: r2.configured ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    }
  );
}
