// Copyright (c) 2026. All rights reserved.

import { AppSettings } from '../types/settings';
import { QuickReplyTemplate } from '../types/template';

export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  ttsLocale: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-IN', label: 'English (India)', nativeLabel: 'English (India)', ttsLocale: 'en-IN' },
  { code: 'hi-IN', label: 'Hindi', nativeLabel: 'हिन्दी (Hindi)', ttsLocale: 'hi-IN' },
  { code: 'en-US', label: 'English (US)', nativeLabel: 'English (US)', ttsLocale: 'en-US' },
  { code: 'en-GB', label: 'English (UK)', nativeLabel: 'English (UK)', ttsLocale: 'en-GB' },
  { code: 'te-IN', label: 'Telugu', nativeLabel: 'తెలుగు (Telugu)', ttsLocale: 'te-IN' },
  { code: 'ta-IN', label: 'Tamil', nativeLabel: 'தமிழ் (Tamil)', ttsLocale: 'ta-IN' },
  { code: 'kn-IN', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ (Kannada)', ttsLocale: 'kn-IN' },
  { code: 'mr-IN', label: 'Marathi', nativeLabel: 'मराठी (Marathi)', ttsLocale: 'mr-IN' },
  { code: 'bn-IN', label: 'Bengali', nativeLabel: 'বাংলা (Bengali)', ttsLocale: 'bn-IN' },
];

export const DEFAULT_TEMPLATES: QuickReplyTemplate[] = [
  {
    id: 'tpl-speak-slowly',
    text: 'Please speak slowly.',
    category: 'clarification',
    createdAt: 1700000000001,
    updatedAt: 1700000000001,
  },
  {
    id: 'tpl-repeat',
    text: 'Could you repeat that?',
    category: 'clarification',
    createdAt: 1700000000002,
    updatedAt: 1700000000002,
  },
  {
    id: 'tpl-assistance',
    text: 'I need assistance.',
    category: 'assistance',
    createdAt: 1700000000003,
    updatedAt: 1700000000003,
  },
  {
    id: 'tpl-write-down',
    text: 'Please write that down.',
    category: 'clarification',
    createdAt: 1700000000004,
    updatedAt: 1700000000004,
  },
  {
    id: 'tpl-thank-you',
    text: 'Thank you.',
    category: 'general',
    createdAt: 1700000000005,
    updatedAt: 1700000000005,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  highContrast: false,
  captionSize: 'xl',
  uiTextSize: 'normal',
  captionTextColor: '#ffffff',
  captionBgColor: '#0f172a',
  useCustomCaptionColors: false,
  language: 'en-IN',
  asrProviderMode: 'cloud-auto',
  tts: {
    enabled: true,
    voiceURI: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
  },
  privacy: {
    allowHistorySaving: false,
    autoSaveOnEnd: false,
    showMicBannerAlways: true,
  },
};

export const CAPTION_COLOR_PRESETS = [
  { label: 'Slate Dark', bg: '#0f172a', text: '#f8fafc' },
  { label: 'Pure Black / White', bg: '#000000', text: '#ffffff' },
  { label: 'Black / High-Vis Yellow', bg: '#000000', text: '#fde047' },
  { label: 'Paper Light', bg: '#ffffff', text: '#0f172a' },
  { label: 'Soft Cream', bg: '#fefce8', text: '#1c1917' },
  { label: 'Deep Navy / Cyan', bg: '#082f49', text: '#e0f2fe' },
];
