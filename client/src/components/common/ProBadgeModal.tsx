// Copyright (c) 2026. All rights reserved.

import React from 'react';
import { Sparkles, X, CheckCircle2 } from 'lucide-react';

interface ProBadgeModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Non-transactional placeholder for future OpenTalk Pro capabilities.
 * Contains no billing, subscription, or payment logic.
 */
export const ProBadgeModal: React.FC<ProBadgeModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  const roadmapItems = [
    'Multi-speaker diarization for group conversations',
    'Custom vocabulary & domain-specific terminology packs',
    'Offline on-device speech recognition models',
    'Natural neural TTS voices for regional Indian languages',
    'Encrypted optional cross-device template sync',
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="hc-card w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="pro-modal-title" className="text-lg font-bold">
                OpenTalk Pro (Coming Soon)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Phase 1 prototype placeholder — no payments or accounts active
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Pro preview dialog"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          Core face-to-face captioning and text-to-speech replies are built to remain accessible.
          Future Pro capabilities under exploration include:
        </p>

        <ul className="mt-4 space-y-2.5">
          {roadmapItems.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="hc-accent-btn min-h-[44px] rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
