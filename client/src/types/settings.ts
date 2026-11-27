// Copyright (c) 2026. All rights reserved.

import { AsrProviderMode } from './asr';

export type ThemeMode = 'light' | 'dark';
export type CaptionSize = 'md' | 'lg' | 'xl' | '2xl';
export type UiTextSize = 'normal' | 'large' | 'xlarge';

export interface AppSettings {
  theme: ThemeMode;
  highContrast: boolean;
  captionSize: CaptionSize;
  uiTextSize: UiTextSize;
  captionTextColor: string;
  captionBgColor: string;
  useCustomCaptionColors: boolean;
  language: string;
  asrProviderMode: AsrProviderMode;
  tts: {
    enabled: boolean;
    voiceURI: string;
    rate: number;
    pitch: number;
    volume: number;
  };
  privacy: {
    /** History is strictly opt-in; never auto-save without explicit consent */
    allowHistorySaving: boolean;
    autoSaveOnEnd: boolean;
    showMicBannerAlways: boolean;
  };
}
