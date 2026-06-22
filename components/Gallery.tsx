'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarRecord } from '@/lib/types';

const POLL_MS = 5000;
const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type SyncMode = 'connecting' | 'streaming' | 'polling' | 'offline';

function mergeAvatars(current: AvatarRecord[], next: AvatarRecord[]) {
  const byId = new Map<string, AvatarRecord>();
  [...next, ...current].forEach((avatar) => byId.set(avatar.id, avatar));

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function formatShortTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Gallery() {
  const [avatars, setAvatars] = useState<AvatarRecord[]>([]);
  const [mode, setMode] = useState<SyncMode>('connecting');
  const [status, setStatus] = useState('Connecting to Cloudflare');
  const mountedRef = useRef(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyAvatars = useCallback((next: AvatarRecord[]) => {
    setAvatars((current) => mergeAvatars(current, next));
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const res = await fetch(`${API}/avatars`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load gallery.');
      if (!mountedRef.current) return;
      applyAvatars(json.avatars || []);
      setMode('polling');
      setStatus(isRefresh ? 'Synced from Cloudflare' : 'Cloudflare live fallback');
    } catch (err) {
      if (!mountedRef.current) return;
      setMode('offline');
      setStatus(err instanceof Error ? err.message : 'Gallery offline');
    }
  }, [applyAvatars]);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    load();
    pollRef.current = setInterval(() => load(true), POLL_MS);
  }, [load]);

  useEffect(() => {
    mountedRef.current = true;

    function onLocalAvatar(event: Event) {
      const detail = (event as CustomEvent<{ avatar?: AvatarRecord }>).detail;
      if (detail?.avatar) {
        applyAvatars([detail.avatar]);
        setStatus('Saved locally and syncing');
      }
    }

    window.addEventListener('clawd:avatar-created', onLocalAvatar);

    const channel =
      'BroadcastChannel' in window ? new BroadcastChannel('clawd-avatar-gallery') : null;
    channel?.addEventListener('message', (event: MessageEvent<{ type?: string; avatar?: AvatarRecord }>) => {
      if (event.data?.type === 'avatar-created' && event.data.avatar) {
        applyAvatars([event.data.avatar]);
        setStatus('Received from another tab');
      }
    });

    let stream: EventSource | null = null;

    if (typeof EventSource !== 'undefined' && API === '/api') {
      stream = new EventSource(`${API}/avatars/stream`);
      stream.addEventListener('open', () => {
        if (!mountedRef.current) return;
        setMode('streaming');
        setStatus('Streaming from Cloudflare');
      });
      stream.addEventListener('snapshot', (event) => {
        if (!mountedRef.current) return;
        const payload = JSON.parse((event as MessageEvent<string>).data) as { avatars?: AvatarRecord[] };
        applyAvatars(payload.avatars || []);
        setMode('streaming');
        setStatus('Streaming from Cloudflare');
      });
      stream.addEventListener('stream-error', (event) => {
        if (!mountedRef.current) return;
        const payload = JSON.parse((event as MessageEvent<string>).data) as { error?: string };
        setStatus(payload.error || 'Stream reconnecting');
        startPolling();
      });
      stream.onerror = () => {
        if (!mountedRef.current) return;
        setStatus('Stream reconnecting');
        startPolling();
      };
    } else {
      startPolling();
    }

    return () => {
      mountedRef.current = false;
      window.removeEventListener('clawd:avatar-created', onLocalAvatar);
      channel?.close();
      stream?.close();
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [applyAvatars, startPolling]);

  return (
    <section className="gallery-panel">
      <div className="gallery-head">
        <div>
          <p className="eyebrow">Cloudflare Gallery</p>
          <h2>Live generated PFPs</h2>
        </div>
        <span className={`status ${mode}`}>{status}</span>
      </div>

      {avatars.length === 0 ? (
        <div className="empty-gallery">
          <strong>No saved avatars yet.</strong>
          <span>Generate one above and it will appear here as soon as R2 confirms the record.</span>
        </div>
      ) : (
        <div className="gallery-grid">
          {avatars.map((avatar) => (
            <a
              className="gallery-item"
              key={avatar.id}
              href={avatar.image_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={avatar.image_url} alt="Generated Clawd PFP" loading="lazy" />
              <div className="gallery-meta">
                <span>{avatar.source_label || 'Clawd PFP'}</span>
                <span>{formatShortTime(avatar.created_at)}</span>
              </div>
              <div className="gallery-tags">
                <span>{avatar.config?.background || 'r2'}</span>
                <span>{avatar.nft_mint ? 'NFT' : 'PNG'}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
