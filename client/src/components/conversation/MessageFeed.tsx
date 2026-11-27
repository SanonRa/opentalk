// Copyright (c) 2026. All rights reserved.

import React, { useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { useOpenTalk } from '../../engine/ConversationContext';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const MessageFeed: React.FC = () => {
  const { state, speakMessageAloud } = useOpenTalk();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state.messages.length]);

  return (
    <section
      aria-label="Conversation transcript"
      className="hc-card flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      style={{ maxHeight: '38vh', minHeight: '160px' }}
    >
      <div className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span>Conversation Log</span>
        <span>{state.messages.length} messages</span>
      </div>

      {state.messages.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Spoken captions and your typed or quick-reply responses will appear here.
        </p>
      ) : (
        <ol className="space-y-3">
          {state.messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <li
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-base leading-relaxed shadow-sm ${
                    isUser
                      ? 'bg-sky-600 text-white'
                      : 'hc-surface border border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between gap-4 text-[11px] font-semibold opacity-80">
                    <span>{isUser ? 'You' : 'Speaker'}</span>
                    <span>{formatTime(msg.timestamp)}</span>
                  </div>
                  <p className="whitespace-pre-wrap break-words font-medium">{msg.text}</p>
                  {isUser && (
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => speakMessageAloud(msg.text)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/25"
                        aria-label={`Speak "${msg.text}" aloud again`}
                      >
                        <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Speak again</span>
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div ref={bottomRef} />
    </section>
  );
};
