// Copyright (c) 2026. All rights reserved.

import React, { useState } from 'react';
import { Trash2, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { useOpenTalk } from '../engine/ConversationContext';

export const HistoryPage: React.FC = () => {
  const { history, settings, updateSettings, deleteHistoryItem, clearAllHistory } =
    useOpenTalk();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Saved Conversations</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Stored locally on this device only when you choose to save. No raw audio is ever kept.
          </p>
        </div>
        {history.length > 0 && (
          <button
            type="button"
            onClick={clearAllHistory}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-400 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            <span>Delete All</span>
          </button>
        )}
      </div>

      {/* Explicit Consent Toggle Card */}
      <div className="hc-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <div>
            <div className="text-sm font-bold">Opt-In Local History</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {settings.privacy.allowHistorySaving
                ? 'Enabled — you can also turn on auto-save on Stop in Settings.'
                : 'Disabled by default — conversations are not saved unless you tap Save.'}
            </div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.privacy.allowHistorySaving}
          onClick={() =>
            updateSettings((prev) => ({
              ...prev,
              privacy: {
                ...prev.privacy,
                allowHistorySaving: !prev.privacy.allowHistorySaving,
                autoSaveOnEnd: !prev.privacy.allowHistorySaving
                  ? prev.privacy.autoSaveOnEnd
                  : false,
              },
            }))
          }
          className={`min-h-[40px] min-w-[70px] rounded-xl px-4 text-xs font-bold ${
            settings.privacy.allowHistorySaving
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
          }`}
        >
          {settings.privacy.allowHistorySaving ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="hc-card rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No conversations saved on this device.
        </div>
      ) : (
        <ul className="space-y-3">
          {history.map((conv) => {
            const expanded = expandedId === conv.id;
            return (
              <li
                key={conv.id}
                className="hc-card rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : conv.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {expanded ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-slate-400" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate text-base font-bold">
                        {conv.messages[0]?.text ?? 'Saved Conversation'}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {new Date(conv.startedAt).toLocaleString()} · {conv.messages.length}{' '}
                        messages · {conv.language}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteHistoryItem(conv.id)}
                    aria-label="Delete saved conversation"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-rose-600 hover:bg-rose-50 dark:border-slate-700 dark:text-rose-400 dark:hover:bg-rose-950"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {expanded && (
                  <ol className="mt-4 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    {conv.messages.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm dark:bg-slate-950"
                      >
                        <div className="mb-0.5 flex justify-between text-[11px] font-bold text-slate-500">
                          <span>{m.role === 'user' ? 'You' : 'Speaker'}</span>
                          <span>
                            {new Date(m.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p>{m.text}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
