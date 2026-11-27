// Copyright (c) 2026. All rights reserved.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  AsrProvider,
  AsrProviderAvailability,
  BackendProvidersResponse,
} from '../types/asr';
import {
  ConversationMessage,
  ConversationState,
  SavedConversation,
} from '../types/conversation';
import { AppSettings } from '../types/settings';
import { QuickReplyTemplate } from '../types/template';
import {
  checkAllProvidersAvailability,
  createAsrProvider,
  fetchBackendProviders,
} from '../services/asr';
import { ttsService } from '../services/tts/SpeechSynthesisService';
import {
  conversationReducer,
  createInitialConversationState,
} from './conversationReducer';
import {
  clearHistoryStorage,
  loadHistory,
  loadSettings,
  loadTemplates,
  saveHistory,
  saveSettings,
  saveTemplates,
} from './storage';

const TTS_ECHO_DECAY_MS = 350;

export interface OpenTalkContextValue {
  state: ConversationState;
  settings: AppSettings;
  templates: QuickReplyTemplate[];
  history: SavedConversation[];
  providerAvailabilities: AsrProviderAvailability[];
  backendStatus: BackendProvidersResponse | null;
  availableVoices: SpeechSynthesisVoice[];

  // Conversation controls
  startListening: () => Promise<void>;
  pauseListening: () => void;
  resumeListening: () => void;
  stopListening: () => Promise<void>;
  reconnectListening: () => Promise<void>;
  clearSession: () => Promise<void>;
  toggleRotatedView: () => void;
  dismissError: () => void;

  // Outgoing response & TTS
  sendResponse: (text: string, options?: { fromTemplate?: boolean; speak?: boolean }) => void;
  speakMessageAloud: (text: string) => void;
  stopSpeakingTts: () => void;

  // Settings
  updateSettings: (updater: (prev: AppSettings) => AppSettings) => void;
  refreshProviderStatus: () => Promise<void>;

  // Templates CRUD
  addTemplate: (text: string, category?: QuickReplyTemplate['category']) => void;
  updateTemplate: (id: string, text: string, category?: QuickReplyTemplate['category']) => void;
  deleteTemplate: (id: string) => void;

  // Opt-in local history
  saveCurrentConversationToHistory: () => boolean;
  deleteHistoryItem: (id: string) => void;
  clearAllHistory: () => void;
}

const OpenTalkContext = createContext<OpenTalkContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const OpenTalkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [templates, setTemplates] = useState<QuickReplyTemplate[]>(() => loadTemplates());
  const [history, setHistory] = useState<SavedConversation[]>(() => loadHistory());
  const [providerAvailabilities, setProviderAvailabilities] = useState<AsrProviderAvailability[]>(
    []
  );
  const [backendStatus, setBackendStatus] = useState<BackendProvidersResponse | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>(() =>
    ttsService.getVoices()
  );

  const [state, dispatch] = useReducer(
    conversationReducer,
    createInitialConversationState(settings.language, settings.asrProviderMode)
  );

  const providerRef = useRef<AsrProvider | null>(null);
  const stateRef = useRef<ConversationState>(state);
  stateRef.current = state;
  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;
  const echoResumeTimerRef = useRef<number | null>(null);

  const refreshProviderStatus = useCallback(async () => {
    const [backend, list] = await Promise.all([
      fetchBackendProviders(),
      checkAllProvidersAvailability(),
    ]);
    setBackendStatus(backend);
    setProviderAvailabilities(list);
  }, []);

  useEffect(() => {
    void refreshProviderStatus();
  }, [refreshProviderStatus]);

  useEffect(() => {
    const syncVoices = () => setAvailableVoices(ttsService.getVoices());
    syncVoices();
    return ttsService.onVoicesChanged(syncVoices);
  }, []);

  // Apply root theme, high-contrast, and UI typography classes
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', settings.theme === 'dark');
    root.classList.toggle('high-contrast', settings.highContrast);
    root.dataset.uiTextSize = settings.uiTextSize;
  }, [settings.theme, settings.highContrast, settings.uiTextSize]);

  // Persist settings and templates
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveTemplates(templates);
  }, [templates]);

  // Clean up hardware resources on unmount
  useEffect(() => {
    return () => {
      if (echoResumeTimerRef.current !== null) {
        window.clearTimeout(echoResumeTimerRef.current);
      }
      ttsService.cancel();
      void providerRef.current?.stop();
    };
  }, []);

  const clearEchoResumeTimer = useCallback(() => {
    if (echoResumeTimerRef.current !== null) {
      window.clearTimeout(echoResumeTimerRef.current);
      echoResumeTimerRef.current = null;
    }
  }, []);

  const startListening = useCallback(async () => {
    const currentSettings = settingsRef.current;
    clearEchoResumeTimer();
    ttsService.cancel();

    if (providerRef.current) {
      await providerRef.current.stop();
      providerRef.current = null;
    }

    const provider = createAsrProvider(currentSettings.asrProviderMode);
    providerRef.current = provider;

    dispatch({
      type: 'SESSION_START_REQUESTED',
      sessionId: stateRef.current.sessionId ?? makeId('conv'),
      language: currentSettings.language,
      providerMode: provider.id,
      providerLabel: provider.displayName,
    });

    await provider.start(
      {
        language: currentSettings.language,
        preferredCloudProvider:
          currentSettings.asrProviderMode === 'cloud-sarvam'
            ? 'sarvam'
            : currentSettings.asrProviderMode === 'cloud-deepgram'
              ? 'deepgram'
              : 'auto',
      },
      {
        onPartialResult: (evt) => {
          dispatch({ type: 'PARTIAL_CAPTION_RECEIVED', text: evt.text });
        },
        onFinalResult: (evt) => {
          const message: ConversationMessage = {
            id: makeId('msg'),
            role: 'hearing',
            text: evt.text,
            timestamp: evt.timestamp,
            language: evt.language ?? currentSettings.language,
          };
          dispatch({ type: 'FINAL_CAPTION_RECEIVED', message });
        },
        onConnectionStateChange: (connectionState, detail) => {
          dispatch({ type: 'CONNECTION_STATE_CHANGED', connectionState, detail });
        },
        onError: (error) => {
          dispatch({ type: 'ERROR_OCCURRED', error });
        },
        onVadSignal: (signal) => {
          dispatch({ type: 'SET_VAD_SPEAKING', speaking: signal === 'speech_start' });
        },
      }
    );
  }, [clearEchoResumeTimer]);

  const pauseListening = useCallback(() => {
    clearEchoResumeTimer();
    providerRef.current?.pause();
    dispatch({ type: 'SESSION_PAUSED_BY_USER' });
  }, [clearEchoResumeTimer]);

  const resumeListening = useCallback(() => {
    clearEchoResumeTimer();
    ttsService.cancel();
    providerRef.current?.resume();
    dispatch({ type: 'SESSION_RESUMED_BY_USER' });
  }, [clearEchoResumeTimer]);

  const saveCurrentConversationToHistory = useCallback((): boolean => {
    const snap = stateRef.current;
    if (snap.messages.length === 0) return false;

    const record: SavedConversation = {
      id: snap.sessionId ?? makeId('conv'),
      startedAt: snap.startedAt ?? snap.messages[0].timestamp,
      endedAt: Date.now(),
      language: snap.language,
      messages: snap.messages,
    };

    setHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== record.id);
      const next = [record, ...filtered].slice(0, 50);
      saveHistory(next);
      return next;
    });
    return true;
  }, []);

  const stopListening = useCallback(async () => {
    clearEchoResumeTimer();
    if (providerRef.current) {
      await providerRef.current.stop();
      providerRef.current = null;
    }
    dispatch({ type: 'SESSION_STOPPED' });

    // Only auto-save if user explicitly opted into both history saving and auto-save
    if (
      settingsRef.current.privacy.allowHistorySaving &&
      settingsRef.current.privacy.autoSaveOnEnd &&
      stateRef.current.messages.length > 0
    ) {
      saveCurrentConversationToHistory();
    }
  }, [clearEchoResumeTimer, saveCurrentConversationToHistory]);

  const reconnectListening = useCallback(async () => {
    if (providerRef.current) {
      await providerRef.current.reconnect();
    } else {
      await startListening();
    }
  }, [startListening]);

  const clearSession = useCallback(async () => {
    clearEchoResumeTimer();
    ttsService.cancel();
    if (providerRef.current) {
      await providerRef.current.stop();
      providerRef.current = null;
    }
    dispatch({ type: 'SESSION_CLEARED' });
  }, [clearEchoResumeTimer]);

  /**
   * Speaks text aloud using browser SpeechSynthesis while engaging the
   * microphone echo-suppression guard:
   * 1. If ASR is currently listening, pause ASR immediately before speech begins.
   * 2. Play TTS utterance.
   * 3. Wait TTS_ECHO_DECAY_MS after playback ends so room reverb dissipates.
   * 4. Resume ASR only if it was listening before TTS started.
   */
  const speakMessageAloud = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const currentSettings = settingsRef.current;
      const wasListening =
        stateRef.current.phase === 'listening' || stateRef.current.ttsEchoGuardActive;

      clearEchoResumeTimer();

      if (wasListening) {
        providerRef.current?.pause();
      }
      dispatch({ type: 'TTS_PLAYBACK_STARTED' });

      ttsService.speak({
        text: trimmed,
        lang: currentSettings.language,
        voiceURI: currentSettings.tts.voiceURI || undefined,
        rate: currentSettings.tts.rate,
        pitch: currentSettings.tts.pitch,
        volume: currentSettings.tts.volume,
        onEnd: () => {
          clearEchoResumeTimer();
          echoResumeTimerRef.current = window.setTimeout(() => {
            const shouldResume = stateRef.current.ttsEchoGuardActive;
            dispatch({ type: 'TTS_PLAYBACK_ENDED' });
            if (shouldResume && providerRef.current) {
              providerRef.current.resume();
            }
          }, TTS_ECHO_DECAY_MS);
        },
        onError: (reason) => {
          dispatch({
            type: 'ERROR_OCCURRED',
            error: {
              code: 'UNKNOWN',
              message: reason,
              recoverable: true,
            },
          });
        },
      });
    },
    [clearEchoResumeTimer]
  );

  const stopSpeakingTts = useCallback(() => {
    clearEchoResumeTimer();
    ttsService.cancel();
    const shouldResume = stateRef.current.ttsEchoGuardActive;
    dispatch({ type: 'TTS_PLAYBACK_ENDED' });
    if (shouldResume && providerRef.current) {
      providerRef.current.resume();
    }
  }, [clearEchoResumeTimer]);

  const sendResponse = useCallback(
    (text: string, options?: { fromTemplate?: boolean; speak?: boolean }) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const shouldSpeak = options?.speak ?? settingsRef.current.tts.enabled;
      const msg: ConversationMessage = {
        id: makeId('msg'),
        role: 'user',
        text: trimmed,
        timestamp: Date.now(),
        language: settingsRef.current.language,
        fromTemplate: options?.fromTemplate ?? false,
        spokenAloud: shouldSpeak,
      };
      dispatch({ type: 'USER_MESSAGE_ADDED', message: msg });

      if (shouldSpeak) {
        speakMessageAloud(trimmed);
      }
    },
    [speakMessageAloud]
  );

  const updateSettings = useCallback((updater: (prev: AppSettings) => AppSettings) => {
    setSettings((prev) => {
      const next = updater(prev);
      if (next.language !== prev.language) {
        dispatch({ type: 'SET_LANGUAGE', language: next.language });
      }
      if (next.asrProviderMode !== prev.asrProviderMode) {
        const label =
          next.asrProviderMode === 'browser-fallback'
            ? 'Browser Speech Fallback'
            : next.asrProviderMode === 'cloud-sarvam'
              ? 'Cloud Proxy — Sarvam AI'
              : next.asrProviderMode === 'cloud-deepgram'
                ? 'Cloud Proxy — Deepgram'
                : 'Cloud Proxy (Auto)';
        dispatch({
          type: 'SET_PROVIDER_META',
          providerMode: next.asrProviderMode,
          providerLabel: label,
        });
      }
      return next;
    });
  }, []);

  const addTemplate = useCallback(
    (text: string, category: QuickReplyTemplate['category'] = 'custom') => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const now = Date.now();
      const item: QuickReplyTemplate = {
        id: makeId('tpl'),
        text: trimmed,
        category,
        createdAt: now,
        updatedAt: now,
      };
      setTemplates((prev) => [item, ...prev]);
    },
    []
  );

  const updateTemplate = useCallback(
    (id: string, text: string, category?: QuickReplyTemplate['category']) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setTemplates((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                text: trimmed,
                category: category ?? item.category,
                updatedAt: Date.now(),
              }
            : item
        )
      );
    },
    []
  );

  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearAllHistory = useCallback(() => {
    setHistory([]);
    clearHistoryStorage();
  }, []);

  const toggleRotatedView = useCallback(() => {
    dispatch({ type: 'TOGGLE_ROTATED_VIEW' });
  }, []);

  const dismissError = useCallback(() => {
    dispatch({ type: 'ERROR_CLEARED' });
  }, []);

  return (
    <OpenTalkContext.Provider
      value={{
        state,
        settings,
        templates,
        history,
        providerAvailabilities,
        backendStatus,
        availableVoices,
        startListening,
        pauseListening,
        resumeListening,
        stopListening,
        reconnectListening,
        clearSession,
        toggleRotatedView,
        dismissError,
        sendResponse,
        speakMessageAloud,
        stopSpeakingTts,
        updateSettings,
        refreshProviderStatus,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        saveCurrentConversationToHistory,
        deleteHistoryItem,
        clearAllHistory,
      }}
    >
      {children}
    </OpenTalkContext.Provider>
  );
};

export function useOpenTalk(): OpenTalkContextValue {
  const ctx = useContext(OpenTalkContext);
  if (!ctx) {
    throw new Error('useOpenTalk must be used within an OpenTalkProvider.');
  }
  return ctx;
}
