// Copyright (c) 2026. All rights reserved.

import WebSocket from 'ws';
import { config } from '../config.js';
import { StreamStartOptions } from '../types/asr.js';
import { ServerAsrProviderCallbacks, ServerAsrStreamProvider } from './base.js';

interface SarvamRealtimeMessage {
  event?: string;
  type?: string;
  request_id?: string;
  transcript?: string;
  text?: string;
  language?: string;
  language_code?: string;
  message?: string;
  error?: string | { message?: string; code?: string };
  data?: {
    transcript?: string;
    language_code?: string;
    signal_type?: 'START_SPEECH' | 'END_SPEECH';
    message?: string;
    is_final?: boolean;
  };
}

function mapLanguageForSarvam(language: string): string {
  const normalized = language.trim();
  const map: Record<string, string> = {
    'en-IN': 'en-IN',
    'en-US': 'en-IN',
    'en-GB': 'en-IN',
    'hi-IN': 'hi-IN',
    hi: 'hi-IN',
    'te-IN': 'te-IN',
    'ta-IN': 'ta-IN',
    'kn-IN': 'kn-IN',
    'ml-IN': 'ml-IN',
    'bn-IN': 'bn-IN',
    'mr-IN': 'mr-IN',
    'gu-IN': 'gu-IN',
    auto: 'auto',
  };
  return map[normalized] ?? 'en-IN';
}

/**
 * Sarvam AI Realtime Streaming WebSocket Adapter.
 * Uses Sarvam's recommended Realtime Streaming endpoint
 * (wss://api.sarvam.ai/speech-to-text-realtime/ws) with model `saaras:v4`,
 * `linear16` audio encoding, `audio_input` base64 frames, and partial/final
 * transcript + VAD events.
 *
 * Official docs: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/streaming-api
 */
export class SarvamStreamProvider implements ServerAsrStreamProvider {
  public readonly id = 'sarvam' as const;
  public readonly name = 'Sarvam AI Realtime Streaming STT (Saaras v4)';

  private socket: WebSocket | null = null;
  private isClosing = false;
  private readyEmitted = false;
  private readonly endpointBaseUrl: string;

  constructor(endpointBaseUrl = 'wss://api.sarvam.ai/speech-to-text-realtime/ws') {
    this.endpointBaseUrl = endpointBaseUrl;
  }

  public connect(options: StreamStartOptions, callbacks: ServerAsrProviderCallbacks): void {
    this.isClosing = false;
    this.readyEmitted = false;
    const sampleRate = options.sampleRate === 8000 ? 8000 : 16000;
    const languageCode = mapLanguageForSarvam(options.language);

    const params = new URLSearchParams({
      language_code: languageCode,
      model: config.sarvam.model,
      mode: config.sarvam.mode,
      stream_type: 'balanced',
      endpointing: 'vad',
      encoding: 'linear16',
      sample_rate: String(sampleRate),
    });

    const url = `${this.endpointBaseUrl}?${params.toString()}`;

    this.socket = new WebSocket(url, {
      headers: {
        'Api-Subscription-Key': config.sarvam.apiKey,
      },
    });

    const emitReadyOnce = () => {
      if (!this.readyEmitted) {
        this.readyEmitted = true;
        callbacks.onReady();
      }
    };

    this.socket.on('open', () => {
      // Emit ready on open so audio streaming can start immediately;
      // session.begin also calls emitReadyOnce idempotently.
      emitReadyOnce();
    });

    this.socket.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString('utf8')) as SarvamRealtimeMessage;
        const eventName = parsed.event ?? parsed.type;

        if (eventName === 'session.begin') {
          emitReadyOnce();
          return;
        }

        if (eventName === 'error' || eventName === 'session.error') {
          const errMsg =
            typeof parsed.error === 'string'
              ? parsed.error
              : parsed.error?.message ?? parsed.message ?? parsed.data?.message ?? 'Sarvam AI streaming error.';
          callbacks.onError({
            code: 'UPSTREAM_ERROR',
            message: errMsg,
            recoverable: false,
          });
          return;
        }

        if (eventName === 'vad.speech_start') {
          callbacks.onVad?.('speech_start');
          return;
        }

        if (eventName === 'vad.speech_end') {
          callbacks.onVad?.('speech_end');
          return;
        }

        if (eventName === 'transcript.partial' || eventName === 'transcript.final') {
          const text = (parsed.transcript ?? parsed.text ?? parsed.data?.transcript ?? '').trim();
          if (!text) return;
          callbacks.onTranscript({
            text,
            isFinal: eventName === 'transcript.final',
            language: parsed.language ?? parsed.language_code ?? languageCode,
            timestamp: Date.now(),
          });
          return;
        }

        if (eventName === 'session.end') {
          this.close();
          return;
        }

        // Defensive fallback for legacy event shapes if ever returned
        if (parsed.type === 'events' && parsed.data?.signal_type) {
          if (parsed.data.signal_type === 'START_SPEECH') {
            callbacks.onVad?.('speech_start');
          } else if (parsed.data.signal_type === 'END_SPEECH') {
            callbacks.onVad?.('speech_end');
          }
          return;
        }

        if (parsed.type === 'data' && parsed.data?.transcript) {
          const text = parsed.data.transcript.trim();
          if (!text) return;
          callbacks.onTranscript({
            text,
            isFinal: parsed.data.is_final ?? true,
            language: parsed.data.language_code ?? languageCode,
            timestamp: Date.now(),
          });
        }
      } catch {
        // Ignore unparseable frames
      }
    });

    this.socket.on('unexpected-response', (_req, res) => {
      const status = res.statusCode ?? 0;
      const isAuth = status === 401 || status === 403;
      callbacks.onError({
        code: isAuth ? 'AUTH_FAILED' : 'UPSTREAM_ERROR',
        message: isAuth
          ? 'Sarvam AI rejected the API subscription key (HTTP 401/403). Verify SARVAM_API_KEY on the server.'
          : `Sarvam AI handshake failed with HTTP ${status}.`,
        recoverable: !isAuth,
      });
    });

    this.socket.on('error', (err) => {
      if (this.isClosing) return;
      callbacks.onError({
        code: 'UPSTREAM_ERROR',
        message: `Sarvam AI connection error: ${err.message}`,
        recoverable: true,
      });
    });

    this.socket.on('close', (code, reasonBuffer) => {
      const reason = reasonBuffer.toString('utf8');
      // Per Sarvam docs: 4xxx codes indicate invalid parameters and should not auto-retry
      if (code >= 4000 && code < 5000 && !this.isClosing) {
        callbacks.onError({
          code: 'UPSTREAM_ERROR',
          message: `Sarvam AI closed stream with code ${code}: ${reason || 'Invalid connection parameters.'}`,
          recoverable: false,
        });
      }
      callbacks.onClose(code, reason);
    });
  }

  public sendAudioChunk(pcm16Chunk: Buffer): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    const payload = {
      event: 'audio_input',
      audio: pcm16Chunk.toString('base64'),
    };
    this.socket.send(JSON.stringify(payload));
  }

  public flush(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ event: 'flush' }));
  }

  public close(): void {
    this.isClosing = true;
    if (!this.socket) return;
    try {
      this.socket.close(1000, 'Session closed by user');
    } catch {
      // Ignore close errors
    } finally {
      this.socket = null;
    }
  }
}
