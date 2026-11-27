// Copyright (c) 2026. All rights reserved.

import WebSocket from 'ws';
import { config } from '../config.js';
import { StreamStartOptions } from '../types/asr.js';
import { ServerAsrProviderCallbacks, ServerAsrStreamProvider } from './base.js';

interface DeepgramResponseMessage {
  type?: string;
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
      confidence?: number;
    }>;
  };
  err_msg?: string;
}

function mapLanguageForDeepgram(language: string): string {
  const normalized = language.trim();
  if (normalized.toLowerCase() === 'hi-in' || normalized.toLowerCase() === 'hi') {
    return 'hi';
  }
  if (normalized.toLowerCase() === 'en-in') {
    return 'en-IN';
  }
  return normalized || 'en-IN';
}

/**
 * Deepgram Real-Time Streaming WebSocket Adapter.
 * Connects to wss://api.deepgram.com/v1/listen using the backend DEEPGRAM_API_KEY.
 * Audio chunks are forwarded as raw 16-bit linear PCM binary frames.
 */
export class DeepgramStreamProvider implements ServerAsrStreamProvider {
  public readonly id = 'deepgram' as const;
  public readonly name = 'Deepgram Streaming STT';

  private socket: WebSocket | null = null;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private isClosing = false;

  public connect(options: StreamStartOptions, callbacks: ServerAsrProviderCallbacks): void {
    this.isClosing = false;
    const sampleRate = options.sampleRate || 16000;
    const language = mapLanguageForDeepgram(options.language);

    const params = new URLSearchParams({
      model: config.deepgram.model,
      language,
      encoding: 'linear16',
      sample_rate: String(sampleRate),
      channels: '1',
      interim_results: 'true',
      punctuate: 'true',
      smart_format: 'true',
      endpointing: String(config.deepgram.endpointingMs),
    });

    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

    this.socket = new WebSocket(url, {
      headers: {
        Authorization: `Token ${config.deepgram.apiKey}`,
      },
    });

    this.socket.on('open', () => {
      callbacks.onReady();
      // Keep upstream connection alive during paused intervals without sending audio
      this.keepAliveTimer = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'KeepAlive' }));
        }
      }, 5000);
    });

    this.socket.on('message', (raw) => {
      try {
        const parsed = JSON.parse(raw.toString('utf8')) as DeepgramResponseMessage;
        if (parsed.type === 'Error' || parsed.err_msg) {
          callbacks.onError({
            code: 'UPSTREAM_ERROR',
            message: parsed.err_msg ?? 'Deepgram streaming error.',
            recoverable: true,
          });
          return;
        }

        if (parsed.type === 'Results') {
          const alt = parsed.channel?.alternatives?.[0];
          const text = (alt?.transcript ?? '').trim();
          if (!text) return;

          callbacks.onTranscript({
            text,
            isFinal: Boolean(parsed.is_final || parsed.speech_final),
            confidence: alt?.confidence,
            language,
            timestamp: Date.now(),
          });
        }
      } catch {
        // Ignore malformed non-JSON frames from upstream
      }
    });

    this.socket.on('unexpected-response', (_req, res) => {
      const status = res.statusCode ?? 0;
      const isAuth = status === 401 || status === 403;
      callbacks.onError({
        code: isAuth ? 'AUTH_FAILED' : 'UPSTREAM_ERROR',
        message: isAuth
          ? 'Deepgram rejected the API key (HTTP 401/403). Verify DEEPGRAM_API_KEY on the server.'
          : `Deepgram handshake failed with HTTP ${status}.`,
        recoverable: !isAuth,
      });
    });

    this.socket.on('error', (err) => {
      if (this.isClosing) return;
      callbacks.onError({
        code: 'UPSTREAM_ERROR',
        message: `Deepgram connection error: ${err.message}`,
        recoverable: true,
      });
    });

    this.socket.on('close', (code, reasonBuffer) => {
      this.clearKeepAlive();
      callbacks.onClose(code, reasonBuffer.toString('utf8'));
    });
  }

  public sendAudioChunk(pcm16Chunk: Buffer): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(pcm16Chunk);
    }
  }

  public flush(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: 'Finalize' }));
    }
  }

  public close(): void {
    this.isClosing = true;
    this.clearKeepAlive();
    if (!this.socket) return;
    try {
      if (this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'CloseStream' }));
      }
      this.socket.close(1000, 'Session closed by user');
    } catch {
      // Ignore close errors
    } finally {
      this.socket = null;
    }
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }
}
