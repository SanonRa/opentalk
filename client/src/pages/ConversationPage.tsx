// Copyright (c) 2026. All rights reserved.

import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Globe, Settings, X } from 'lucide-react';
import { useOpenTalk } from '../engine/ConversationContext';
import { AppRoute } from '../components/layout/AppShell';
import { ProviderStatusBadge } from '../components/common/ProviderStatusBadge';
import { LiveCaptionPanel } from '../components/conversation/LiveCaptionPanel';
import { CaptionAppearancePopover } from '../components/conversation/CaptionAppearancePopover';
import { ConversationControls } from '../components/conversation/ConversationControls';
import { MessageFeed } from '../components/conversation/MessageFeed';
import { ResponseComposer } from '../components/conversation/ResponseComposer';

interface ConversationPageProps {
  onNavigate: (route: AppRoute) => void;
}

export const ConversationPage: React.FC<ConversationPageProps> = ({ onNavigate }) => {
  const {
    state,
    settings,
    updateSettings,
    dismissError,
    saveCurrentConversationToHistory,
  } = useOpenTalk();

  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const handleSave = () => {
    const saved = saveCurrentConversationToHistory();
    if (saved) {
      setSaveFeedback('Conversation saved locally on this device.');
      window.setTimeout(() => setSaveFeedback(null), 3500);
    }
  };

  const handleSwitchToBrowserFallback = () => {
    updateSettings((prev) => ({ ...prev, asrProviderMode: 'browser-fallback' }));
    dismissError();
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Top Compact Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <span>Language: {settings.language}</span>
          <span>·</span>
          <span>Status: {state.connectionState}</span>
        </div>
        <ProviderStatusBadge compact />
      </div>

      {/* Explicit Error / Unconfigured Provider Banner */}
      {state.lastError && (
        <div
          role="alert"
          className="hc-card rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-100"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
              <div className="space-y-2">
                <div className="font-bold">
                  {state.lastError.code === 'PROVIDER_UNCONFIGURED'
                    ? 'Cloud Speech Recognition Not Configured'
                    : 'Transcription Notice'}
                </div>
                <p className="leading-relaxed">{state.lastError.message}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {state.lastError.code === 'PROVIDER_UNCONFIGURED' && (
                    <button
                      type="button"
                      onClick={handleSwitchToBrowserFallback}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-600"
                    >
                      <Globe className="h-4 w-4" aria-hidden="true" />
                      <span>Use Browser Speech Fallback</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('settings')}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-rose-400 px-3.5 py-1.5 text-xs font-bold hover:bg-rose-100 dark:border-rose-700 dark:hover:bg-rose-900/50"
                  >
                    <Settings className="h-4 w-4" aria-hidden="true" />
                    <span>Open Settings</span>
                  </button>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissError}
              aria-label="Dismiss error banner"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-rose-200/60 dark:hover:bg-rose-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Save Confirmation Toast */}
      {saveFeedback && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-100"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{saveFeedback}</span>
        </div>
      )}

      {/* Centerpiece: Large Live Captions (+ Optional 180-degree Rotated Partner Panel) */}
      <LiveCaptionPanel />

      {/* Quick Inline Caption Appearance Popover */}
      <CaptionAppearancePopover
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
      />

      {/* Start / Pause / Resume / Stop & Utility Controls */}
      <ConversationControls
        appearanceOpen={appearanceOpen}
        onToggleAppearance={() => setAppearanceOpen((v) => !v)}
        onRequestSave={handleSave}
      />

      {/* Scrollable Conversation Transcript */}
      <MessageFeed />

      {/* Text Input + Send/TTS + Quick-Reply Chips */}
      <ResponseComposer />
    </div>
  );
};
