// Copyright (c) 2026. All rights reserved.

import React, { useState } from 'react';
import { Send, Volume2, VolumeX } from 'lucide-react';
import { useOpenTalk } from '../../engine/ConversationContext';

export const ResponseComposer: React.FC = () => {
  const { state, settings, templates, sendResponse, stopSpeakingTts } = useOpenTalk();
  const [draft, setDraft] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendResponse(trimmed, { fromTemplate: false, speak: settings.tts.enabled });
    setDraft('');
  };

  return (
    <section
      aria-label="Reply and text-to-speech controls"
      className="hc-card space-y-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      {/* Quick-Reply Strip */}
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span>Quick Replies (tap to speak immediately)</span>
          {state.isSpeakingTts && (
            <button
              type="button"
              onClick={stopSpeakingTts}
              className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white"
            >
              <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Stop Voice</span>
            </button>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {templates.slice(0, 8).map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => sendResponse(tpl.text, { fromTemplate: true, speak: true })}
              className="hc-surface inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-900 transition hover:border-sky-500 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Volume2 className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>{tpl.text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Text Input + Send / Speak */}
      <form onSubmit={handleSubmit} className="flex items-stretch gap-2">
        <label htmlFor="opentalk-reply-input" className="sr-only">
          Type your response
        </label>
        <input
          id="opentalk-reply-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a reply to display and speak aloud…"
          className="hc-surface min-h-[52px] flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 text-base text-slate-900 placeholder:text-slate-500 focus:border-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="hc-accent-btn inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {settings.tts.enabled ? (
            <Volume2 className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Send className="h-5 w-5" aria-hidden="true" />
          )}
          <span>{settings.tts.enabled ? 'Speak' : 'Send'}</span>
        </button>
      </form>
    </section>
  );
};
