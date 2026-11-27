// Copyright (c) 2026. All rights reserved.

import {
  AsrConnectionState,
  AsrProvider,
  AsrProviderAvailability,
  AsrProviderListeners,
  AsrProviderMode,
  AsrStartConfig,
  BackendProvidersResponse,
} from '../../types/asr';
import { MicrophoneCapture } from '../audio/MicrophoneCapture';

interface ServerEvent {
  type: 'ready' | 'transcript' | 'vad' | 'status' | 'error' | 'pong';
  provider?: 'sarvam' | 'deepgram';
  providerName?: string;
  text?: string;
  isFinal?: boolean;
  confidence?: number;
  language?: string;
  timestamp?: number;
  signal?: 'speech_start' | 'speech_end';
  status?: 'connecting' | 'listening' | 'paused' | 'stopped';
  code?:
    | 'PROVIDER_UNCONFIGURED'
    | 'INVALID_MESSAGE'
    | 'AUTH_FAILED'
    | 'UPSTREAM_ERROR'
    | 'SESSION_LIMIT'
    | 'INTERNAL_ERROR';
  message?: string;
  recoverable?: boolean;
}

function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/transcribe`;
}

export async function fetchBackendProviders(): Promise<BackendProvidersResponse | null> {
  try {
    const response = await fetch('/api/providers', {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as BackendProvidersResponse;
  } catch {
    return null;
  }
}

/**
 * Cloud Proxy ASR Provider.
 * Streams 16 kHz PCM16 audio over WebSocket to the OpenTalk Node.js backend,
 * which forwards audio in memory to Sarvam AI or Deepgram without exposing API
 * credentials to the browser.
 */
export class CloudProxyAsrProvider implements AsrProvider {
  public readonly isCloud = true;
  private socket: WebSocket | null = null;
  private mic = new MicrophoneCapture(16000);
  private state: AsrConnectionState = 'idle';
  private listeners: AsrProviderListeners | null = null;
  private lastConfig: AsrStartConfig | null = null;
  private intentionalStop = false;
  private isPaused = false;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private readonly maxReconnectAttempts = 4;

  constructor(
    public readonly id: Extract<AsrProviderMode, 'cloud-auto' | 'cloud-sarvam' | 'cloud-deepgram'>,
    public readonly displayName: string
  ) {}

  public getConnectionState(): AsrConnectionState {
    return this.state;
  }

  public async checkAvailability(): Promise<AsrProviderAvailability> {
    const info = await fetchBackendProviders();
    if (!info) {
      return {
        mode: this.id,
        available: false,
        label: this.displayName,
        description: 'Backend streaming proxy is unreachable.',
        isCloud: true,
        requiresInternet: true,
        reasonIfUnavailable:
          'Could not reach the OpenTalk backend server (/api/providers). Verify Docker Compose or the server process is running.',
      };
    }

    if (this.id === 'cloud-auto') {
      return {
        mode: this.id,
        available: info.anyCloudConfigured,
        label: this.displayName,
        description: info.anyCloudConfigured
          ? `Ready via ${info.defaultProvider === 'sarvam' ? 'Sarvam AI' : 'Deepgram'}`
          : 'No cloud ASR credentials configured on server.',
        isCloud: true,
        requiresInternet: true,
        reasonIfUnavailable: info.anyCloudConfigured
          ? undefined
          : 'No cloud ASR API key is set on the backend. Add SARVAM_API_KEY or DEEPGRAM_API_KEY in .env, or select Browser Speech Fallback in Settings.',
      };
    }

    const targetId = this.id === 'cloud-sarvam' ? 'sarvam' : 'deepgram';
    const matched = info.providers.find((p) => p.id === targetId);
    const configured = Boolean(matched?.configured);
    return {
      mode: this.id,
      available: configured,
      label: matched?.name ?? this.displayName,
      description: matched?.notes ?? 'Cloud streaming speech recognition.',
      isCloud: true,
      requiresInternet: true,
      reasonIfUnavailable: configured
        ? undefined
        : `${matched?.name ?? targetId} is not configured on the backend. Set ${
            targetId === 'sarvam' ? 'SARVAM_API_KEY' : 'DEEPGRAM_API_KEY'
          } in .env and restart the server.`,
    };
  }

  public async start(config: AsrStartConfig, listeners: AsrProviderListeners): Promise<void> {
    this.listeners = listeners;
    this.lastConfig = config;
    this.intentionalStop = false;
    this.isPaused = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();

    // Check server availability first so we show a crisp message before requesting mic
    const availability = await this.checkAvailability();
    if (!availability.available) {
      this.setState('error', availability.reasonIfUnavailable);
      listeners.onError({
        code: 'PROVIDER_UNCONFIGURED',
        message:
          availability.reasonIfUnavailable ??
          'Cloud speech recognition is not configured on the backend.',
        recoverable: false,
      });
      return;
    }

    await this.openConnectionAndMic();
  }

  public pause(): void {
    this.isPaused = true;
    this.mic.setMuted(true);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'pause' }));
    }
    this.setState('paused', 'Microphone paused');
  }

  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.mic.setMuted(false);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'resume' }));
      this.setState('connected', 'Listening');
    } else if (!this.intentionalStop) {
      void this.reconnect();
    }
  }

  public async stop(): Promise<void> {
    this.intentionalStop = true;
    this.isPaused = false;
    this.clearReconnectTimer();

    await this.mic.stop();

    if (this.socket) {
      try {
        if (this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'stop' }));
        }
        this.socket.close(1000, 'Stopped by user');
      } catch {
        // ignore close errors
      }
      this.socket = null;
    }

    this.setState('idle', 'Stopped');
  }

  public async reconnect(): Promise<void> {
    if (this.intentionalStop || !this.lastConfig || !this.listeners) return;
    this.clearReconnectTimer();
    await this.mic.stop();
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.setState('reconnecting', 'Reconnecting to speech service…');
    await this.openConnectionAndMic();
  }

  private async openConnectionAndMic(): Promise<void> {
    if (!this.lastConfig || !this.listeners) return;

    this.setState('connecting', 'Connecting to OpenTalk backend…');

    const requestedCloud: 'auto' | 'sarvam' | 'deepgram' =
      this.id === 'cloud-sarvam'
        ? 'sarvam'
        : this.id === 'cloud-deepgram'
          ? 'deepgram'
          : this.lastConfig.preferredCloudProvider ?? 'auto';

    // Acquire microphone permission before opening upstream stream
    try {
      await this.mic.start((pcmChunk) => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN && !this.isPaused) {
          this.socket.send(pcmChunk);
        }
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Microphone permission was denied or no microphone was found.';
      this.setState('error', msg);
      this.listeners.onError({
        code: 'PERMISSION_DENIED',
        message: `Microphone access failed: ${msg}`,
        recoverable: false,
      });
      return;
    }

    const ws = new WebSocket(getWebSocketUrl());
    ws.binaryType = 'arraybuffer';
    this.socket = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      ws.send(
        JSON.stringify({
          type: 'start',
          language: this.lastConfig?.language ?? 'en-IN',
          sampleRate: 16000,
          provider: requestedCloud,
        })
      );
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      let parsed: ServerEvent;
      try {
        parsed = JSON.parse(event.data) as ServerEvent;
      } catch {
        return;
      }

      switch (parsed.type) {
        case 'ready':
          this.setState('connected', `Connected (${parsed.providerName ?? parsed.provider ?? 'Cloud'})`);
          break;

        case 'transcript': {
          const text = (parsed.text ?? '').trim();
          if (!text) return;
          const payload = {
            text,
            isFinal: Boolean(parsed.isFinal),
            confidence: parsed.confidence,
            language: parsed.language,
            timestamp: parsed.timestamp ?? Date.now(),
          };
          if (payload.isFinal) {
            this.listeners?.onFinalResult(payload);
          } else {
            this.listeners?.onPartialResult(payload);
          }
          break;
        }

        case 'vad':
          if (parsed.signal) {
            this.listeners?.onVadSignal?.(parsed.signal);
          }
          break;

        case 'status':
          if (parsed.status === 'paused') {
            this.setState('paused', parsed.message);
          } else if (parsed.status === 'listening') {
            this.setState('connected', parsed.message);
          }
          break;

        case 'error': {
          const code =
            parsed.code === 'PROVIDER_UNCONFIGURED'
              ? 'PROVIDER_UNCONFIGURED'
              : parsed.code === 'AUTH_FAILED'
                ? 'AUTH_FAILED'
                : parsed.code === 'SESSION_LIMIT'
                  ? 'SESSION_LIMIT'
                  : 'UPSTREAM_ERROR';
          const recoverable = Boolean(parsed.recoverable);
          this.setState('error', parsed.message);
          this.listeners?.onError({
            code,
            message: parsed.message ?? 'Speech service returned an error.',
            recoverable,
          });
          if (!recoverable) {
            this.intentionalStop = true;
            void this.mic.stop();
          }
          break;
        }
      }
    };

    ws.onerror = () => {
      if (this.intentionalStop) return;
      this.listeners?.onError({
        code: 'NETWORK_ERROR',
        message: 'Connection to the OpenTalk transcription gateway was interrupted.',
        recoverable: true,
      });
    };

    ws.onclose = () => {
      if (this.intentionalStop) return;
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.intentionalStop) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      void this.mic.stop();
      this.setState('error', 'Unable to reconnect to speech service.');
      this.listeners?.onError({
        code: 'NETWORK_ERROR',
        message: 'Could not restore the transcription stream after multiple attempts. Tap Start to try again.',
        recoverable: true,
      });
      return;
    }

    this.reconnectAttempts += 1;
    const delayMs = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 8000);
    this.setState(
      'reconnecting',
      `Connection dropped. Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})…`
    );

    this.reconnectTimer = window.setTimeout(() => {
      void this.reconnect();
    }, delayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(next: AsrConnectionState, detail?: string): void {
    this.state = next;
    this.listeners?.onConnectionStateChange(next, detail);
  }
}
