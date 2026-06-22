import { dbListAvatars } from '@/lib/cloudflare/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REFRESH_MS = 2500;

function encodeSse(event: string, data: unknown) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function encodeComment(message: string) {
  return new TextEncoder().encode(`: ${message}\n\n`);
}

export async function GET(request: Request) {
  let timer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let inFlight = false;
      let lastPayload = '';

      const sendSnapshot = async () => {
        if (inFlight) return;
        inFlight = true;

        try {
          const avatars = await dbListAvatars(60);
          const payload = JSON.stringify({ avatars });

          if (payload !== lastPayload) {
            lastPayload = payload;
            controller.enqueue(encodeSse('snapshot', { avatars, source: 'cloudflare-r2' }));
          } else {
            controller.enqueue(encodeComment(`heartbeat ${Date.now()}`));
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Cloudflare gallery stream failed.';
          controller.enqueue(encodeSse('stream-error', { error: message }));
        } finally {
          inFlight = false;
        }
      };

      sendSnapshot();
      timer = setInterval(sendSnapshot, REFRESH_MS);

      request.signal.addEventListener('abort', () => {
        if (timer) clearInterval(timer);
        timer = null;
        controller.close();
      });
    },
    cancel() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
