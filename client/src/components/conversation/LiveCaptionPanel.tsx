// Copyright (c) 2026. All rights reserved.

import React from 'react';
import { Volume2 } from 'lucide-react';
import { useOpenTalk } from '../../engine/ConversationContext';
import { CaptionSize } from '../../types/settings';

const CAPTION_SIZE_CLASSES: Record<CaptionSize, string> = {
  md: 'text-xl leading-snug sm:text-2xl',
  lg: 'text-2xl leading-snug sm:text-3xl',
  xl: 'text-3xl leading-snug sm:text-4xl',
  '2xl': 'text-4xl leading-tight sm:text-5xl',
};

/**
 * Primary live caption stage.
 * Displays real-time partial transcription (distinguished visually) alongside
 * the most recent finalized utterance. Supports 180-degree rotation for
 * across-the-table two-person communication.
 */
export const LiveCaptionPanel: React.FC = () => {
  const { state, settings } = useOpenTalk();

  const lastHearingMessage = [...state.messages]
    .reverse()
    .find((m) => m.role === 'hearing');

  const lastUserMessage = [...state.messages]
    .reverse()
    .find((m) => m.role === 'user');

  const customStyle: React.CSSProperties | undefined =
    settings.useCustomCaptionColors && !settings.highContrast
      ? {
          backgroundColor: settings.captionBgColor,
          color: settings.captionTextColor,
        }
      : undefined;

  const sizeClass = CAPTION_SIZE_CLASSES[settings.captionSize];

  return (
    <section aria-label="Live captions" className="space-y-3">
      {/* Rotated 180-degree opposite-facing display for the hearing conversation partner */}
      {state.isRotatedView && (
        <div
          className="hc-card rotate-180 rounded-2xl border-2 border-sky-500/70 bg-sky-950 p-4 text-white shadow-sm"
          aria-label="Rotated reply display facing the other person"
        >
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-sky-300">
            <span>Partner View (180° Flipped)</span>
            {state.isSpeakingTts && (
              <span className="inline-flex items-center gap-1 text-sky-200">
                <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                Speaking…
              </span>
            )}
          </div>
          <p className={`font-bold ${sizeClass}`}>
            {lastUserMessage?.text ?? 'Replies you type or tap will appear here facing the other person.'}
          </p>
        </div>
      )}

      {/* Primary Live Caption Display for the Deaf / Hard-of-Hearing User */}
      <div
        style={customStyle}
        aria-live="polite"
        aria-atomic="false"
        className={`hc-card min-h-[150px] rounded-2xl border p-5 shadow-sm transition-colors sm:min-h-[180px] ${
          settings.useCustomCaptionColors && !settings.highContrast
            ? 'border-slate-300 dark:border-slate-700'
            : 'border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white'
        }`}
      >
        <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider opacity-70">
          <span>Live Captions</span>
          <span>
            {state.phase === 'listening'
              ? state.vadSpeaking
                ? 'Speech detected'
                : 'Listening…'
              : state.phase === 'speaking_tts'
                ? 'Mic paused (Speaking)'
                : state.phase === 'paused'
                  ? 'Paused'
                  : 'Ready'}
          </span>
        </div>

        {state.livePartialCaption ? (
          <p className={`font-bold ${sizeClass}`}>
            <span>{state.livePartialCaption}</span>
            <span className="ml-1 inline-block h-6 w-1.5 animate-pulse bg-sky-500 align-middle" />
          </p>
        ) : lastHearingMessage ? (
          <p className={`font-bold ${sizeClass}`}>{lastHearingMessage.text}</p>
        ) : (
          <p className="text-lg font-medium opacity-65 sm:text-xl">
            {state.phase === 'listening'
              ? 'Waiting for someone to speak…'
              : 'Tap Start Listening to begin live captions, or type a reply below.'}
          </p>
        )}
      </div>
    </section>
  );
};
