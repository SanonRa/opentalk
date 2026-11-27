// Copyright (c) 2026. All rights reserved.

import React from 'react';
import {
  Mic,
  Pause,
  Play,
  Square,
  RotateCw,
  Type,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react';
import { useOpenTalk } from '../../engine/ConversationContext';

interface ConversationControlsProps {
  appearanceOpen: boolean;
  onToggleAppearance: () => void;
  onRequestSave: () => void;
}

export const ConversationControls: React.FC<ConversationControlsProps> = ({
  appearanceOpen,
  onToggleAppearance,
  onRequestSave,
}) => {
  const {
    state,
    startListening,
    pauseListening,
    resumeListening,
    stopListening,
    reconnectListening,
    clearSession,
    toggleRotatedView,
  } = useOpenTalk();

  const isListening = state.phase === 'listening' || state.phase === 'speaking_tts';
  const isPaused = state.phase === 'paused';
  const isStartingOrReconnecting =
    state.phase === 'starting' || state.phase === 'reconnecting';
  const isActive = isListening || isPaused || isStartingOrReconnecting;

  return (
    <div className="space-y-2.5">
      {/* Primary Session Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {!isActive && (
          <button
            type="button"
            onClick={() => void startListening()}
            className="hc-accent-btn flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-sky-700"
          >
            <Mic className="h-5 w-5" aria-hidden="true" />
            <span>Start Listening</span>
          </button>
        )}

        {isListening && (
          <button
            type="button"
            onClick={pauseListening}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-base font-bold text-slate-950 shadow-sm transition hover:bg-amber-600"
          >
            <Pause className="h-5 w-5" aria-hidden="true" />
            <span>Pause</span>
          </button>
        )}

        {isPaused && (
          <button
            type="button"
            onClick={resumeListening}
            className="hc-accent-btn flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Play className="h-5 w-5" aria-hidden="true" />
            <span>Resume</span>
          </button>
        )}

        {isStartingOrReconnecting && (
          <button
            type="button"
            disabled
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-300 px-5 py-3 text-base font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <RefreshCw className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>Connecting…</span>
          </button>
        )}

        {isActive && (
          <button
            type="button"
            onClick={() => void stopListening()}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 py-3 text-base font-bold text-white shadow-sm transition hover:bg-rose-700"
          >
            <Square className="h-5 w-5" aria-hidden="true" />
            <span>Stop</span>
          </button>
        )}

        {state.phase === 'error' && state.lastError?.recoverable && (
          <button
            type="button"
            onClick={() => void reconnectListening()}
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-sky-600 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900 dark:bg-sky-950 dark:text-sky-100"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Reconnect</span>
          </button>
        )}
      </div>

      {/* Secondary Utility Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleRotatedView}
          aria-pressed={state.isRotatedView}
          className={`hc-card inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
            state.isRotatedView
              ? 'border-sky-600 bg-sky-600 text-white'
              : 'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          <span>180° Two-Person View</span>
        </button>

        <button
          type="button"
          onClick={onToggleAppearance}
          aria-expanded={appearanceOpen}
          className={`hc-card inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition ${
            appearanceOpen
              ? 'border-sky-600 bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100'
              : 'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          <Type className="h-4 w-4" aria-hidden="true" />
          <span>Caption Style</span>
        </button>

        {state.messages.length > 0 && (
          <>
            <button
              type="button"
              onClick={onRequestSave}
              className="hc-card inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>Save</span>
            </button>

            <button
              type="button"
              onClick={() => void clearSession()}
              className="hc-card inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-rose-950 dark:hover:text-rose-200"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Clear</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
