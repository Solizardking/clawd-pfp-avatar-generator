'use client';

import { useEffect, useRef, useState } from 'react';
import type { AvatarRecord } from '@/lib/types';

const POLL_MS = 8000;
const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function Gallery() {
  const [avatars, setAvatars] = useState<AvatarRecord[]>([]);
  const [status, setStatus] = useState('Loading gallery…');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    async function load(isRefresh = false) {
      try {
        const res = await fetch(`${API}/avatars`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not load gallery.');
        if (mountedRef.current) {
          setAvatars(json.avatars || []);
          if (isRefresh) {
            setStatus('Updated');
            setTimeout(() => { if (mountedRef.current) setStatus('Live'); }, 1200);
          } else {
            setStatus('Live');
          }
        }
      } catch (err) {
        if (mountedRef.current) setStatus(err instanceof Error ? err.message : 'Gallery offline');
      }
    }

    load();
    const interval = setInterval(() => load(true), POLL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <section className="card gallery-card">
      <div className="gallery-head">
        <div>
          <h2>Realtime Gallery</h2>
          <p>Every saved avatar appears here instantly for everyone viewing the app.</p>
        </div>
        <span className="status">● {status}</span>
      </div>

      {avatars.length === 0 ? (
        <p className="notice">No avatars yet. Make the first Clawd PFP.</p>
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
                <span>
                  {new Date(avatar.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span>{avatar.nft_mint ? 'NFT' : 'PFP'}</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
