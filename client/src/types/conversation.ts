// Copyright (c) 2026. All rights reserved.

import { AsrConnectionState, AsrErrorEvent, AsrProviderMode } from './asr';

export type SessionPhase =
  | 'idle'
  | 'starting'
  | 'listening'
  | 'paused'
  | 'speaking_tts'
  | 'reconnecting'
  | 'error'
  | 'ended';

export type SpeakerRole = 'hearing' | 'user' | 'system';

export interface ConversationMessage {
  id: string;
  role: SpeakerRole;
  text: string;
  timestamp: number;
  language?: string;
  fromTemplate?: boolean;
  spokenAloud?: boolean;
}

export interface SavedConversation {
  id: string;
  startedAt: number;
  endedAt: number;
  language: string;
  messages: ConversationMessage[];
}

export interface ConversationState {
  sessionId: string | null;
  startedAt: number | null;
  phase: SessionPhase;
  /** True when the microphone was temporarily muted purely to prevent TTS feedback */
  ttsEchoGuardActive: boolean;
  /** Phase to return to once TTS playback completes */
  phaseBeforeTts: 'listening' | 'paused' | 'idle';
  connectionState: AsrConnectionState;
  activeProviderMode: AsrProviderMode;
  activeProviderLabel: string;
  language: string;
  livePartialCaption: string;
  messages: ConversationMessage[];
  lastError: AsrErrorEvent | null;
  isRotatedView: boolean;
  isSpeakingTts: boolean;
  vadSpeaking: boolean;
}
