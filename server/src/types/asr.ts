// Copyright (c) 2026. All rights reserved.

export type CloudProviderId = 'sarvam' | 'deepgram';

export interface ProviderAvailability {
  id: CloudProviderId;
  name: string;
  configured: boolean;
  streaming: boolean;
  supportedLanguages: string[];
  model: string;
  notes: string;
}

export interface ProvidersStatusResponse {
  defaultProvider: CloudProviderId | null;
  anyCloudConfigured: boolean;
  providers: ProviderAvailability[];
  privacyNotice: string;
}

export interface StreamStartOptions {
  language: string;
  sampleRate: number;
  provider?: CloudProviderId | 'auto';
}

export interface TranscriptPayload {
  text: string;
  isFinal: boolean;
  confidence?: number;
  language?: string;
  timestamp: number;
}

/**
 * Control messages sent from browser client to backend WebSocket gateway.
 * Binary WebSocket frames carry raw 16-bit linear PCM (little-endian, mono) audio chunks.
 */
export type ClientControlMessage =
  | {
      type: 'start';
      language: string;
      sampleRate?: number;
      provider?: CloudProviderId | 'auto';
    }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'flush' }
  | { type: 'stop' }
  | { type: 'ping' };

/**
 * Messages sent from backend WebSocket gateway back to browser client.
 */
export type ServerEventMessage =
  | {
      type: 'ready';
      provider: CloudProviderId;
      providerName: string;
      language: string;
    }
  | {
      type: 'transcript';
      text: string;
      isFinal: boolean;
      confidence?: number;
      language?: string;
      timestamp: number;
    }
  | {
      type: 'vad';
      signal: 'speech_start' | 'speech_end';
      timestamp: number;
    }
  | {
      type: 'status';
      status: 'connecting' | 'listening' | 'paused' | 'stopped';
      message?: string;
    }
  | {
      type: 'error';
      code:
        | 'PROVIDER_UNCONFIGURED'
        | 'INVALID_MESSAGE'
        | 'AUTH_FAILED'
        | 'UPSTREAM_ERROR'
        | 'SESSION_LIMIT'
        | 'INTERNAL_ERROR';
      message: string;
      recoverable: boolean;
    }
  | { type: 'pong'; timestamp: number };
