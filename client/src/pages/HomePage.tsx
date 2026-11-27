// Copyright (c) 2026. All rights reserved.

import React from 'react';
import {
  MessageSquareText,
  BookmarkCheck,
  Settings,
  History,
  ShieldCheck,
  Sparkles,
  Languages,
  ArrowRight,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../data/defaults';
import { useOpenTalk } from '../engine/ConversationContext';
import { AppRoute } from '../components/layout/AppShell';
import { ProviderStatusBadge } from '../components/common/ProviderStatusBadge';

interface HomePageProps {
  onNavigate: (route: AppRoute) => void;
  onOpenProModal: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate, onOpenProModal }) => {
  const { settings, updateSettings, history, templates } = useOpenTalk();

  return (
    <div className="space-y-5">
      {/* Hero & Primary CTA */}
      <section className="hc-card rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-900 dark:bg-sky-950 dark:text-sky-200">
            Face-to-Face Accessibility
          </span>
          <ProviderStatusBadge />
        </div>

        <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
          Clear, two-way conversations in real time.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
          OpenTalk turns spoken words into large, readable captions and speaks your typed or
          quick-reply responses aloud — with explicit microphone controls and privacy-first
          defaults.
        </p>

        {/* Language Selection + Start Conversation */}
        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label
              htmlFor="home-language-select"
              className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
            >
              <Languages className="h-4 w-4" aria-hidden="true" />
              <span>Conversation Language</span>
            </label>
            <select
              id="home-language-select"
              value={settings.language}
              onChange={(e) =>
                updateSettings((prev) => ({ ...prev, language: e.target.value }))
              }
              className="hc-surface min-h-[52px] w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 text-base font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeLabel} ({lang.code})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('conversation')}
            className="hc-accent-btn inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl bg-sky-600 px-6 py-3.5 text-base font-bold text-white shadow-sm transition hover:bg-sky-700"
          >
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
            <span>Start Conversation</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      {/* Quick Navigation Cards */}
      <section aria-label="Quick navigation" className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onNavigate('templates')}
          className="hc-card flex min-h-[88px] items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-400 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
              <BookmarkCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <div className="text-base font-bold">Quick-Reply Templates</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {templates.length} saved phrases ready to speak in one tap
              </div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="hc-card flex min-h-[88px] items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-sky-400 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Settings className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <div className="text-base font-bold">Display, Voice & Privacy</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Caption size, high contrast, TTS voice & ASR provider
              </div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        </button>
      </section>

      {/* Recent Activity (Opt-In Local History) */}
      <section className="hc-card rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <h2 className="text-base font-bold">Recent Activity</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs font-bold text-sky-600 hover:underline dark:text-sky-400"
          >
            Manage History
          </button>
        </div>

        {history.length === 0 ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <p>
              No saved conversations yet. For your privacy, OpenTalk does not automatically store
              transcripts unless you opt in under Settings or tap Save during a session.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
            {history.slice(0, 3).map((conv) => (
              <li key={conv.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {conv.messages[0]?.text ?? 'Conversation'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(conv.startedAt).toLocaleString()} · {conv.messages.length} messages ·{' '}
                    {conv.language}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold dark:border-slate-700"
                >
                  View
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pro Placeholder Strip */}
      <section className="hc-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 dark:border-sky-900 dark:bg-sky-950/40">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden="true" />
          <div>
            <div className="text-sm font-bold">OpenTalk Pro — Future Roadmap</div>
            <div className="text-xs text-slate-600 dark:text-slate-300">
              Preview planned multi-speaker diarization and offline model capabilities (no billing active).
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenProModal}
          className="min-h-[40px] rounded-xl border border-sky-400 px-3.5 py-2 text-xs font-bold text-sky-900 hover:bg-sky-100 dark:border-sky-700 dark:text-sky-200 dark:hover:bg-sky-900/50"
        >
          View Roadmap
        </button>
      </section>
    </div>
  );
};
