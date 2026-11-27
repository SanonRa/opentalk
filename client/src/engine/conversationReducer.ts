// Copyright (c) 2026. All rights reserved.

import { AsrConnectionState, AsrErrorEvent, AsrProviderMode } from '../types/asr';
import { ConversationMessage, ConversationState } from '../types/conversation';

export type ConversationAction =
  | {
      type: 'SESSION_START_REQUESTED';
      sessionId: string;
      language: string;
      providerMode: AsrProviderMode;
      providerLabel: string;
    }
  | {
      type: 'CONNECTION_STATE_CHANGED';
      connectionState: AsrConnectionState;
      detail?: string;
    }
  | { type: 'SESSION_PAUSED_BY_USER' }
  | { type: 'SESSION_RESUMED_BY_USER' }
  | { type: 'SESSION_STOPPED' }
  | { type: 'SESSION_CLEARED' }
  | { type: 'PARTIAL_CAPTION_RECEIVED'; text: string }
  | {
      type: 'FINAL_CAPTION_RECEIVED';
      message: ConversationMessage;
    }
  | {
      type: 'USER_MESSAGE_ADDED';
      message: ConversationMessage;
    }
  | { type: 'TTS_PLAYBACK_STARTED' }
  | { type: 'TTS_PLAYBACK_ENDED' }
  | { type: 'ERROR_OCCURRED'; error: AsrErrorEvent }
  | { type: 'ERROR_CLEARED' }
  | { type: 'TOGGLE_ROTATED_VIEW' }
  | { type: 'SET_LANGUAGE'; language: string }
  | { type: 'SET_PROVIDER_META'; providerMode: AsrProviderMode; providerLabel: string }
  | { type: 'SET_VAD_SPEAKING'; speaking: boolean };

export function createInitialConversationState(
  language: string,
  providerMode: AsrProviderMode
): ConversationState {
  return {
    sessionId: null,
    startedAt: null,
    phase: 'idle',
    ttsEchoGuardActive: false,
    phaseBeforeTts: 'idle',
    connectionState: 'idle',
    activeProviderMode: providerMode,
    activeProviderLabel:
      providerMode === 'local-whisper'
        ? 'Local ASR (On-Device Whisper)'
        : providerMode === 'browser-fallback'
          ? 'Browser Speech Fallback'
          : providerMode === 'cloud-sarvam'
            ? 'Cloud Proxy — Sarvam AI'
            : providerMode === 'cloud-deepgram'
              ? 'Cloud Proxy — Deepgram'
              : 'Cloud Proxy (Auto)',
    language,
    livePartialCaption: '',
    messages: [],
    lastError: null,
    isRotatedView: false,
    isSpeakingTts: false,
    vadSpeaking: false,
  };
}

export function conversationReducer(
  state: ConversationState,
  action: ConversationAction
): ConversationState {
  switch (action.type) {
    case 'SESSION_START_REQUESTED':
      return {
        ...state,
        sessionId: state.sessionId ?? action.sessionId,
        startedAt: state.startedAt ?? Date.now(),
        phase: 'starting',
        connectionState: 'connecting',
        language: action.language,
        activeProviderMode: action.providerMode,
        activeProviderLabel: action.providerLabel,
        lastError: null,
        livePartialCaption: '',
      };

    case 'CONNECTION_STATE_CHANGED': {
      let nextPhase = state.phase;
      if (action.connectionState === 'connected') {
        nextPhase = state.isSpeakingTts ? 'speaking_tts' : 'listening';
      } else if (action.connectionState === 'reconnecting') {
        nextPhase = 'reconnecting';
      } else if (action.connectionState === 'paused') {
        nextPhase = state.isSpeakingTts ? 'speaking_tts' : 'paused';
      } else if (action.connectionState === 'error') {
        nextPhase = 'error';
      } else if (action.connectionState === 'idle' && state.phase !== 'ended') {
        nextPhase = state.messages.length > 0 ? 'ended' : 'idle';
      }

      return {
        ...state,
        connectionState: action.connectionState,
        phase: nextPhase,
        activeProviderLabel:
          action.detail && action.connectionState === 'connected'
            ? action.detail
            : state.activeProviderLabel,
      };
    }

    case 'SESSION_PAUSED_BY_USER':
      return {
        ...state,
        phase: 'paused',
        connectionState: state.connectionState === 'connected' ? 'paused' : state.connectionState,
        vadSpeaking: false,
      };

    case 'SESSION_RESUMED_BY_USER':
      return {
        ...state,
        phase: 'listening',
        connectionState: 'connected',
        lastError: null,
      };

    case 'SESSION_STOPPED':
      return {
        ...state,
        phase: state.messages.length > 0 ? 'ended' : 'idle',
        connectionState: 'idle',
        livePartialCaption: '',
        ttsEchoGuardActive: false,
        vadSpeaking: false,
      };

    case 'SESSION_CLEARED':
      return {
        ...createInitialConversationState(state.language, state.activeProviderMode),
        activeProviderLabel: state.activeProviderLabel,
        isRotatedView: state.isRotatedView,
      };

    case 'PARTIAL_CAPTION_RECEIVED':
      // Ignore any stray partial captions if TTS echo guard is active
      if (state.ttsEchoGuardActive || state.phase === 'paused') {
        return state;
      }
      return {
        ...state,
        livePartialCaption: action.text,
      };

    case 'FINAL_CAPTION_RECEIVED':
      if (state.ttsEchoGuardActive) {
        return state;
      }
      return {
        ...state,
        livePartialCaption: '',
        messages: [...state.messages, action.message],
      };

    case 'USER_MESSAGE_ADDED':
      return {
        ...state,
        sessionId: state.sessionId ?? `sess-${Date.now()}`,
        startedAt: state.startedAt ?? Date.now(),
        messages: [...state.messages, action.message],
      };

    case 'TTS_PLAYBACK_STARTED': {
      const priorPhase: 'listening' | 'paused' | 'idle' =
        state.phase === 'listening'
          ? 'listening'
          : state.phase === 'paused'
            ? 'paused'
            : 'idle';
      return {
        ...state,
        isSpeakingTts: true,
        ttsEchoGuardActive: priorPhase === 'listening',
        phaseBeforeTts: priorPhase,
        phase: priorPhase === 'listening' ? 'speaking_tts' : state.phase,
        livePartialCaption: '',
        vadSpeaking: false,
      };
    }

    case 'TTS_PLAYBACK_ENDED': {
      const restoredPhase =
        state.ttsEchoGuardActive && state.phase === 'speaking_tts'
          ? state.phaseBeforeTts
          : state.phase === 'speaking_tts'
            ? 'idle'
            : state.phase;
      return {
        ...state,
        isSpeakingTts: false,
        ttsEchoGuardActive: false,
        phase: restoredPhase,
      };
    }

    case 'ERROR_OCCURRED':
      return {
        ...state,
        phase: 'error',
        connectionState: 'error',
        lastError: action.error,
        vadSpeaking: false,
      };

    case 'ERROR_CLEARED':
      return {
        ...state,
        lastError: null,
        phase: state.phase === 'error' ? 'idle' : state.phase,
        connectionState: state.connectionState === 'error' ? 'idle' : state.connectionState,
      };

    case 'TOGGLE_ROTATED_VIEW':
      return {
        ...state,
        isRotatedView: !state.isRotatedView,
      };

    case 'SET_LANGUAGE':
      return {
        ...state,
        language: action.language,
      };

    case 'SET_PROVIDER_META':
      return {
        ...state,
        activeProviderMode: action.providerMode,
        activeProviderLabel: action.providerLabel,
      };

    case 'SET_VAD_SPEAKING':
      return {
        ...state,
        vadSpeaking: action.speaking,
      };

    default:
      return state;
  }
}
