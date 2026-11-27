// Copyright (c) 2026. All rights reserved.

import React from 'react';
import { Cloud, CloudOff, Globe } from 'lucide-react';
import { useOpenTalk } from '../../engine/ConversationContext';

export const ProviderStatusBadge: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { settings, providerAvailabilities } = useOpenTalk();
  const active = providerAvailabilities.find((p) => p.mode === settings.asrProviderMode);

  if (settings.asrProviderMode === 'browser-fallback') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200">
        <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{compact ? 'Browser Fallback' : 'Browser Speech Fallback (Unverified Offline)'}</span>
      </span>
    );
  }

  if (active?.available) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200">
        <Cloud className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{compact ? 'Cloud ASR Ready' : active.description}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-900 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-200">
      <CloudOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{compact ? 'Cloud Key Missing' : 'Cloud ASR Unconfigured'}</span>
    </span>
  );
};
