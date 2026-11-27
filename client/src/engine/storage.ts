// Copyright (c) 2026. All rights reserved.

import { DEFAULT_SETTINGS, DEFAULT_TEMPLATES } from '../data/defaults';
import { SavedConversation } from '../types/conversation';
import { AppSettings } from '../types/settings';
import { QuickReplyTemplate } from '../types/template';

const STORAGE_KEYS = {
  settings: 'opentalk:v1:settings',
  templates: 'opentalk:v1:templates',
  history: 'opentalk:v1:history',
} as const;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadSettings(): AppSettings {
  const stored = safeParse<Partial<AppSettings>>(
    localStorage.getItem(STORAGE_KEYS.settings),
    {}
  );
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    tts: {
      ...DEFAULT_SETTINGS.tts,
      ...(stored.tts ?? {}),
    },
    privacy: {
      ...DEFAULT_SETTINGS.privacy,
      ...(stored.privacy ?? {}),
    },
  };
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function loadTemplates(): QuickReplyTemplate[] {
  const stored = safeParse<QuickReplyTemplate[] | null>(
    localStorage.getItem(STORAGE_KEYS.templates),
    null
  );
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    return DEFAULT_TEMPLATES;
  }
  return stored;
}

export function saveTemplates(templates: QuickReplyTemplate[]): void {
  localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
}

export function loadHistory(): SavedConversation[] {
  const stored = safeParse<SavedConversation[]>(
    localStorage.getItem(STORAGE_KEYS.history),
    []
  );
  return Array.isArray(stored) ? stored : [];
}

export function saveHistory(conversations: SavedConversation[]): void {
  // Never store raw audio — only structured text messages explicitly consented by the user
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(conversations));
}

export function clearHistoryStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.history);
}
