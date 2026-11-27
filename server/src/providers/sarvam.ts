// Copyright (c) 2026. All rights reserved.

import WebSocket from 'ws';
import { config } from '../config.js';
import { StreamStartOptions } from '../types/asr.js';
import { ServerAsrProviderCallbacks, ServerAsrStreamProvider } from './base.js';

interface SarvamMessage {
  type?: 'data' | 'events' | 'error';
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
  };
  return map[normalized] ?? 'en-IN';
}

/**
 * Sarvam AI Real-Time Streaming WebSocket Adapter.
 * Uses Sarvam's documented WebSocket endpoint (wss://api.sarvam.ai/speech-to-text/ws)
 * with model `saaras:v4`, `pcm_s16le` audio framing, and VAD signals.
 *
 * Official docs: https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/streaming-api
 */
export class SarvamStreamProvider implements ServerAsrStreamProvider {
  public readonly id = 'sarvam' as const;
  public readonly name = 'Sarvam AI Streaming STT (Saaras v4)';

  private socket: WebSocket | null = null;
  private sampleRate = 16000;
  private isClosing = false;

  public connect(options: StreamStartOptions, callbacks: ServerAsrProviderCallbacks): void {
    this.isClosing = false;
    this.sampleRate = options.sampleRate || 16000;
    const languageCode = mapLanguageForSarvam(options.language);

    const params = new URLSearchParams({
      'language-code': languageCode,
      language_code: languageCode,
      model: config.sarvam.model,
      mode: config.sarvam.mode,
      sample_rate: String(this.sampleRate),
      input_audio_codec: 'pcm_s16le',
      high_vad_sensitivity: 'true',
      vad_signals: 'true',
      flush_signal: 'true',
    });

    const url = `wss://api.sarvam.ai/speech-to-text/ws?${params.toString()}`;

    this.socket = new WebSocket(url, {
      headers: {
        'api-subscription-key': config.sarvam.apiKey,
      },
    });

    this.socket.on('open', () => {
      callbacks.onReady();
    });

    this.socket.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString('utf8')) as SarvamMessage;

        if (parsed.type === 'error') {
          callbacks.onError({
            code: 'UPSTREAM_ERROR',
            message: parsed.data?.message ?? 'Sarvam AI streaming error.',
            recoverable: false,
          });
          return;
        }

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
          ? 'Sarvam AI rejected the API subscription key (HTTP 403). Verify SARVAM_API_KEY on the server.'
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
      audio: {
        data: pcm16Chunk.toString('base64'),
        sample_rate: String(this.sampleRate),
        encoding: 'audio/pcm',
      },
    };
    this.socket.send(JSON.stringify(payload));
  }

  public flush(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'flush' }));
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
