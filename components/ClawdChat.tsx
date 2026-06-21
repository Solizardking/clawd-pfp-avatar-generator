'use client';

import { useEffect, useRef, useState } from 'react';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function ClawdChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: "Yo! I'm Clawd 🐱 — your Solana PFP guide. What's good?" },
  ]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const userMsg: Msg = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'Chat offline.' }));
        setMessages((m) => {
          const updated = [...m];
          updated[updated.length - 1] = { role: 'assistant', content: err.error || 'Chat offline.' };
          return updated;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              setMessages((m) => {
                const updated = [...m];
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: (updated[updated.length - 1]?.content ?? '') + delta,
                };
                return updated;
              });
            }
          } catch {
            // skip malformed chunk
          }
        }
      }
    } catch {
      setMessages((m) => {
        const updated = [...m];
        updated[updated.length - 1] = { role: 'assistant', content: 'Network error. Try again.' };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="chat-root">
      {open && (
        <div className="chat-window">
          <div className="chat-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/master/clawd_mascot_hq_square_transparent.png" alt="Clawd" className="chat-avatar" />
            <div>
              <div className="chat-name">Clawd</div>
              <div className="chat-status">● Online</div>
            </div>
            <button type="button" className="chat-close" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
          </div>

          <div className="chat-body">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                {msg.content || (msg.role === 'assistant' && streaming ? <span className="typing-dots"><span /><span /><span /></span> : null)}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="chat-input-row">
            <input
              type="text"
              className="chat-input"
              placeholder="Ask Clawd anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={streaming}
              maxLength={500}
            />
            <button type="button" className="chat-send" onClick={send} disabled={streaming || !input.trim()}>
              {streaming ? '…' : '↑'}
            </button>
          </div>
        </div>
      )}

      <button type="button" className="chat-fab" onClick={() => setOpen((v) => !v)} aria-label="Chat with Clawd">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/master/clawd_mascot_hq_square_transparent.png" alt="Clawd" />
        {!open && <span className="chat-fab-badge" />}
      </button>
    </div>
  );
}
