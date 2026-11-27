// Copyright (c) 2026. All rights reserved.

import React from 'react';
import { Mic, MicOff, PauseCircle, RefreshCw, Volume2, AlertTriangle } from 'lucide-react';
import { useOpenTalk } from '../../engine/ConversationContext';

/**
 * High-visibility microphone and transcription state banner.
 * Ensures the user and nearby speakers always have an unmistakable visual cue
 * whenever the microphone is actively listening, paused, or muted for TTS.
 */
export const MicStatusBanner: React.FC = () => {
  const { state, settings } = useOpenTalk();

  if (state.phase === 'idle' && !settings.privacy.showMicBannerAlways) {
    return null;
  }

  let bgClass = 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
  let icon = <MicOff className="h-4 w-4 shrink-0" aria-hidden="true" />;
  let label = 'Microphone off — audio is not being captured';

  switch (state.phase) {
    case 'starting':
      bgClass = 'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100';
      icon = <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />;
      label = 'Connecting microphone and speech service…';
      break;
    case 'listening':
      bgClass = 'bg-emerald-600 text-white';
      icon = (
        <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </span>
      );
      label = `Listening (${state.language}) — ${state.activeProviderLabel}`;
      break;
    case 'paused':
      bgClass = 'bg-amber-500 text-slate-950';
      icon = <PauseCircle className="h-4 w-4 shrink-0" aria-hidden="true" />;
      label = 'Listening paused — microphone muted';
      break;
    case 'speaking_tts':
      bgClass = 'bg-sky-600 text-white';
      icon = <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />;
      label = 'Speaking your reply aloud — microphone paused to prevent echo';
      break;
    case 'reconnecting':
      bgClass = 'bg-amber-600 text-white';
      icon = <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />;
      label = 'Reconnecting transcription stream…';
      break;
    case 'error':
      bgClass = 'bg-rose-600 text-white';
      icon = <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />;
      label = state.lastError?.code === 'PROVIDER_UNCONFIGURED'
        ? 'Cloud speech provider not configured — see details below'
        : 'Transcription interrupted — microphone stopped';
      break;
    case 'ended':
      bgClass = 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
      icon = <MicOff className="h-4 w-4 shrink-0" aria-hidden="true" />;
      label = 'Session stopped — microphone off';
      break;
    default:
      icon = <Mic className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />;
      break;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`hc-surface flex items-center justify-center gap-2 border-b border-black/10 px-3 py-2 text-xs font-semibold sm:text-sm ${bgClass}`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
};
