// Copyright (c) 2026. All rights reserved.

export type AsrProviderMode = 'cloud-auto' | 'cloud-sarvam' | 'cloud-deepgram' | 'browser-fallback';

export type AsrConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'paused'
  | 'reconnecting'
  | 'error'
  | 'disconnected';

export interface AsrTranscriptEvent {
  text: string;
  isFinal: boolean;
  confidence?: number;
  language?: string;
  timestamp: number;
}

export interface AsrErrorEvent {
  code:
    | 'PROVIDER_UNCONFIGURED'
    | 'PERMISSION_DENIED'
    | 'UNSUPPORTED_BROWSER'
    | 'AUTH_FAILED'
    | 'NETWORK_ERROR'
    | 'UPSTREAM_ERROR'
    | 'SESSION_LIMIT'
    | 'UNKNOWN';
  message: string;
  recoverable: boolean;
}

export interface AsrProviderAvailability {
  mode: AsrProviderMode;
  available: boolean;
  label: string;
  description: string;
  isCloud: boolean;
  requiresInternet: boolean;
  reasonIfUnavailable?: string;
}

export interface BackendProviderInfo {
  id: 'sarvam' | 'deepgram';
  name: string;
  configured: boolean;
  streaming: boolean;
  supportedLanguages: string[];
  model: string;
  notes: string;
}

export interface BackendProvidersResponse {
  defaultProvider: 'sarvam' | 'deepgram' | null;
  anyCloudConfigured: boolean;
  providers: BackendProviderInfo[];
  privacyNotice: string;
}

export interface AsrStartConfig {
  language: string;
  preferredCloudProvider?: 'auto' | 'sarvam' | 'deepgram';
}

export interface AsrProviderListeners {
  onPartialResult: (event: AsrTranscriptEvent) => void;
  onFinalResult: (event: AsrTranscriptEvent) => void;
  onConnectionStateChange: (state: AsrConnectionState, detail?: string) => void;
  onError: (error: AsrErrorEvent) => void;
  onVadSignal?: (signal: 'speech_start' | 'speech_end') => void;
}

/**
 * Provider-independent Automatic Speech Recognition (ASR) contract.
 * The Conversation Engine interacts solely with this interface so the underlying
 * speech engine can be swapped without modifying UI or state logic.
 */
export interface AsrProvider {
  readonly id: AsrProviderMode;
  readonly displayName: string;
  readonly isCloud: boolean;

  checkAvailability(): Promise<AsrProviderAvailability>;
  start(config: AsrStartConfig, listeners: AsrProviderListeners): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): Promise<void>;
  reconnect(): Promise<void>;
  getConnectionState(): AsrConnectionState;
}
