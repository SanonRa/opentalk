// Copyright (c) 2026. All rights reserved.

import React from 'react';
import { X } from 'lucide-react';
import { CAPTION_COLOR_PRESETS } from '../../data/defaults';
import { useOpenTalk } from '../../engine/ConversationContext';
import { CaptionSize } from '../../types/settings';

interface CaptionAppearancePopoverProps {
  open: boolean;
  onClose: () => void;
}

const SIZE_OPTIONS: Array<{ value: CaptionSize; label: string }> = [
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'L' },
  { value: 'xl', label: 'XL' },
  { value: '2xl', label: '2XL' },
];

export const CaptionAppearancePopover: React.FC<CaptionAppearancePopoverProps> = ({
  open,
  onClose,
}) => {
  const { settings, updateSettings } = useOpenTalk();

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="Quick caption appearance settings"
      className="hc-card rounded-2xl border border-slate-200 bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold">Caption Appearance</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close caption appearance controls"
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Caption text size */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
            Caption Text Size
          </span>
          <div className="grid grid-cols-4 gap-2">
            {SIZE_OPTIONS.map((opt) => {
              const selected = settings.captionSize === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    updateSettings((prev) => ({ ...prev, captionSize: opt.value }))
                  }
                  className={`min-h-[44px] rounded-xl border text-sm font-bold transition ${
                    selected
                      ? 'hc-accent-btn border-sky-600 bg-sky-600 text-white'
                      : 'border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* High Contrast quick toggle */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
            High-Contrast Mode
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.highContrast}
            onClick={() =>
              updateSettings((prev) => ({ ...prev, highContrast: !prev.highContrast }))
            }
            className={`min-h-[40px] rounded-xl px-4 text-xs font-bold ${
              settings.highContrast
                ? 'bg-yellow-400 text-black'
                : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {settings.highContrast ? 'On' : 'Off'}
          </button>
        </div>

        {/* Color presets */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-400">
            Caption Colour Preset
          </span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CAPTION_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  updateSettings((prev) => ({
                    ...prev,
                    highContrast: false,
                    useCustomCaptionColors: true,
                    captionBgColor: preset.bg,
                    captionTextColor: preset.text,
                  }))
                }
                style={{ backgroundColor: preset.bg, color: preset.text }}
                className="min-h-[40px] rounded-xl border border-slate-400/50 px-2.5 py-1.5 text-xs font-bold shadow-sm"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
