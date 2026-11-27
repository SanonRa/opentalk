// Copyright (c) 2026. All rights reserved.

import WebSocket from 'ws';
import { config } from '../config.js';
import {
  ClientControlMessage,
  ServerEventMessage,
} from '../types/asr.js';
import { ServerAsrStreamProvider } from '../providers/base.js';
import {
  createServerAsrProvider,
  resolveActiveProviderId,
} from '../providers/registry.js';

/**
 * Manages a single client WebSocket transcription session.
 * Audio frames are forwarded directly in memory to the selected cloud ASR
 * provider and immediately discarded after transmission. No raw audio is
 * written to disk or logged.
 */
export class TranscriptionSession {
  private provider: ServerAsrStreamProvider | null = null;
  private isPaused = false;
  private sessionTimer: NodeJS.Timeout | null = null;

  constructor(private readonly clientSocket: WebSocket) {}

  public attach(): void {
    this.clientSocket.on('message', (data, isBinary) => {
      if (isBinary) {
        if (this.provider && !this.isPaused) {
          const buffer = Buffer.isBuffer(data)
            ? data
            : Array.isArray(data)
              ? Buffer.concat(data)
              : Buffer.from(data);
          this.provider.sendAudioChunk(buffer);
        }
        return;
      }

      this.handleControlMessage(data.toString('utf8'));
    });

    this.clientSocket.on('close', () => {
      this.cleanup();
    });

    this.clientSocket.on('error', () => {
      this.cleanup();
    });
  }

  private handleControlMessage(raw: string): void {
    let msg: ClientControlMessage;
    try {
      msg = JSON.parse(raw) as ClientControlMessage;
    } catch {
      this.send({
        type: 'error',
        code: 'INVALID_MESSAGE',
        message: 'Control message must be valid JSON.',
        recoverable: true,
      });
      return;
    }

    switch (msg.type) {
      case 'ping':
        this.send({ type: 'pong', timestamp: Date.now() });
        break;

      case 'start':
        this.startProviderSession(msg.language, msg.sampleRate ?? 16000, msg.provider);
        break;

      case 'pause':
        this.isPaused = true;
        this.provider?.flush();
        this.send({ type: 'status', status: 'paused', message: 'Transcription paused.' });
        break;

      case 'resume':
        this.isPaused = false;
        this.send({ type: 'status', status: 'listening', message: 'Transcription resumed.' });
        break;

      case 'flush':
        this.provider?.flush();
        break;

      case 'stop':
        this.stopProviderSession();
        this.send({ type: 'status', status: 'stopped', message: 'Transcription stopped.' });
        break;

      default:
        this.send({
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: 'Unsupported control message type.',
          recoverable: true,
        });
    }
  }

  private startProviderSession(
    language: string,
    sampleRate: number,
    requestedProvider?: 'sarvam' | 'deepgram' | 'auto'
  ): void {
    this.stopProviderSession();

    const resolvedId = resolveActiveProviderId(requestedProvider);
    if (!resolvedId) {
      const requestedLabel =
        requestedProvider && requestedProvider !== 'auto'
          ? `The requested cloud provider (${requestedProvider})`
          : 'No cloud speech-recognition provider';
      this.send({
        type: 'error',
        code: 'PROVIDER_UNCONFIGURED',
        message: `${requestedLabel} is configured on the OpenTalk server. Add SARVAM_API_KEY or DEEPGRAM_API_KEY in .env (or switch to the Browser Speech Fallback in Settings).`,
        recoverable: false,
      });
      return;
    }

    this.isPaused = false;
    this.send({ type: 'status', status: 'connecting', message: 'Connecting to speech service…' });

    const provider = createServerAsrProvider(resolvedId);
    this.provider = provider;

    this.sessionTimer = setTimeout(() => {
      this.send({
        type: 'error',
        code: 'SESSION_LIMIT',
        message: `Maximum continuous session duration (${config.maxSessionSeconds}s) reached. Tap Start to begin a new session.`,
        recoverable: true,
      });
      this.stopProviderSession();
    }, config.maxSessionSeconds * 1000);

    provider.connect(
      { language, sampleRate, provider: resolvedId },
      {
        onReady: () => {
          this.send({
            type: 'ready',
            provider: provider.id,
            providerName: provider.name,
            language,
          });
          this.send({ type: 'status', status: 'listening' });
        },
        onTranscript: (payload) => {
          this.send({
            type: 'transcript',
            text: payload.text,
            isFinal: payload.isFinal,
            confidence: payload.confidence,
            language: payload.language,
            timestamp: payload.timestamp,
          });
        },
        onVad: (signal) => {
          this.send({ type: 'vad', signal, timestamp: Date.now() });
        },
        onError: (err) => {
          this.send({
            type: 'error',
            code: err.code,
            message: err.message,
            recoverable: err.recoverable,
          });
        },
        onClose: () => {
          if (this.provider === provider) {
            this.provider = null;
            this.clearSessionTimer();
            this.send({ type: 'status', status: 'stopped' });
          }
        },
      }
    );
  }

  private stopProviderSession(): void {
    this.clearSessionTimer();
    if (this.provider) {
      const current = this.provider;
      this.provider = null;
      current.close();
    }
    this.isPaused = false;
  }

  private clearSessionTimer(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  private send(event: ServerEventMessage): void {
    if (this.clientSocket.readyState === WebSocket.OPEN) {
      this.clientSocket.send(JSON.stringify(event));
    }
  }

  public cleanup(): void {
    this.stopProviderSession();
  }
}
