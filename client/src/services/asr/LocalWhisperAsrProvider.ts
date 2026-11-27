// Copyright (c) 2026. All rights reserved.

import {
  AsrConnectionState,
  AsrProvider,
  AsrProviderAvailability,
  AsrProviderListeners,
  AsrStartConfig,
  LocalModelInfo,
} from '../../types/asr';
import { MicrophoneCapture } from '../audio/MicrophoneCapture';

export const AVAILABLE_LOCAL_MODELS: LocalModelInfo[] = [
  {
    id: 'onnx-community/whisper-tiny',
    name: 'Whisper Tiny (Quantized)',
    sizeMb: 42,
    description: 'Fastest on-device model. Ideal for low-latency English and Hindi everyday conversations.',
    languages: ['en-IN', 'en-US', 'en-GB', 'hi-IN'],
    recommended: true,
  },
  {
    id: 'onnx-community/whisper-base',
    name: 'Whisper Base (Quantized)',
    sizeMb: 78,
    description: 'Higher accuracy multilingual model. Better Indic vocabulary coverage including Telugu (te-IN).',
    languages: ['en-IN', 'hi-IN', 'te-IN', 'ta-IN', 'bn-IN', 'mr-IN'],
  },
];

const LOCAL_STORAGE_ACTIVE_MODEL_KEY = 'opentalk:local_model_id';

export class LocalWhisperAsrProvider implements AsrProvider {
  public readonly id = 'local-whisper' as const;
  public readonly displayName = 'Local ASR (On-Device Whisper)';
  public readonly isCloud = false;

  private mic = new MicrophoneCapture(16000);
  private worker: Worker | null = null;
  private state: AsrConnectionState = 'idle';
  private listeners: AsrProviderListeners | null = null;
  private lastConfig: AsrStartConfig | null = null;
  private isPaused = false;
  private intentionalStop = false;
  private audioBuffer: number[] = [];
  private lastChunkTime = Date.now();
  private isTranscribing = false;

  private static inMemorySelectedModelId: string | null = null;

  public static getSelectedModelId(): string {
    if (LocalWhisperAsrProvider.inMemorySelectedModelId) {
      return LocalWhisperAsrProvider.inMemorySelectedModelId;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(LOCAL_STORAGE_ACTIVE_MODEL_KEY) || AVAILABLE_LOCAL_MODELS[0].id;
      }
    } catch {
      // ignore
    }
    return AVAILABLE_LOCAL_MODELS[0].id;
  }

  public static setSelectedModelId(id: string): void {
    LocalWhisperAsrProvider.inMemorySelectedModelId = id;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LOCAL_STORAGE_ACTIVE_MODEL_KEY, id);
      }
    } catch {
      // ignore
    }
  }

  public static async isModelCached(modelId: string): Promise<boolean> {
    if (!('caches' in window)) return false;
    try {
      const keys = await caches.keys();
      for (const key of keys) {
        if (key.includes('transformers') || key.includes('onnx')) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          const hasModel = requests.some((req) => req.url.includes(modelId.replace('/', '_')));
          if (hasModel) return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }

  public static async deleteModelCache(modelId: string): Promise<boolean> {
    if (!('caches' in window)) return false;
    try {
      const keys = await caches.keys();
      let deletedAny = false;
      for (const key of keys) {
        if (key.includes('transformers') || key.includes('onnx')) {
          const cache = await caches.open(key);
          const requests = await cache.keys();
          for (const req of requests) {
            if (req.url.includes(modelId) || req.url.includes(modelId.replace('/', '_'))) {
              await cache.delete(req);
              deletedAny = true;
            }
          }
        }
      }
      return deletedAny;
    } catch {
      return false;
    }
  }

  public getConnectionState(): AsrConnectionState {
    return this.state;
  }

  public async checkAvailability(): Promise<AsrProviderAvailability> {
    const isWorkerSupported = typeof Worker !== 'undefined';
    const isWasmSupported = typeof WebAssembly !== 'undefined';
    const available = isWorkerSupported && isWasmSupported;

    return {
      mode: 'local-whisper',
      available,
      label: this.displayName,
      description: '100% on-device local transcription using quantized Whisper ONNX. Zero audio sent to external servers.',
      isCloud: false,
      requiresInternet: false,
      reasonIfUnavailable: available
        ? undefined
        : 'WebAssembly or Web Workers are not supported in this browser.',
    };
  }

  public async start(config: AsrStartConfig, listeners: AsrProviderListeners): Promise<void> {
    this.listeners = listeners;
    this.lastConfig = config;
    this.intentionalStop = false;
    this.isPaused = false;
    this.audioBuffer = [];
    this.lastChunkTime = Date.now();

    this.setState('connecting', 'Initializing local speech model…');

    const modelId = LocalWhisperAsrProvider.getSelectedModelId();
    await this.initWorker();

    try {
      await this.loadModelInWorker(modelId, config.language);
    } catch (err: any) {
      const isNotDownloaded = err?.code === 'MODEL_NOT_DOWNLOADED';
      this.setState('error', err?.message || 'Local model not ready');
      listeners.onError({
        code: isNotDownloaded ? 'MODEL_NOT_DOWNLOADED' : 'UPSTREAM_ERROR',
        message: err?.message || 'Could not load local model. Ensure it has been downloaded in Settings.',
        recoverable: false,
      });
      return;
    }

    try {
      await this.mic.start((_pcm16, float32) => {
        if (!float32 || this.isPaused || this.intentionalStop) return;
        this.handleAudioSample(float32);
      });
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Microphone access failed';
      this.setState('error', msg);
      listeners.onError({
        code: 'PERMISSION_DENIED',
        message: `Microphone access denied: ${msg}`,
        recoverable: false,
      });
      return;
    }

    this.setState('connected', 'Listening locally (On-Device)');
  }

  public pause(): void {
    this.isPaused = true;
    this.mic.setMuted(true);
    this.flushBuffer(true);
    this.setState('paused', 'Microphone paused');
  }

  public resume(): void {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.audioBuffer = [];
    this.lastChunkTime = Date.now();
    this.mic.setMuted(false);
    this.setState('connected', 'Listening locally (On-Device)');
  }

  public async stop(): Promise<void> {
    this.intentionalStop = true;
    this.isPaused = false;
    await this.mic.stop();
    this.flushBuffer(true);
    this.audioBuffer = [];
    this.setState('idle', 'Stopped');
  }

  public async reconnect(): Promise<void> {
    if (this.intentionalStop || !this.lastConfig || !this.listeners) return;
    await this.stop();
    await this.start(this.lastConfig, this.listeners);
  }

  private async initWorker(): Promise<void> {
    if (this.worker) return;

    this.worker = new Worker(new URL('./localAsr.worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (event) => {
      const { type, data, error } = event.data;
      if (type === 'transcript' && this.listeners) {
        if (data.isFinal) {
          this.listeners.onFinalResult(data);
        } else {
          this.listeners.onPartialResult(data);
        }
      } else if (type === 'error' && this.listeners) {
        this.listeners.onError({
          code: error.code || 'UNKNOWN',
          message: error.message || 'Local inference error',
          recoverable: true,
        });
      }
    };
  }

  private loadModelInWorker(modelId: string, language: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) return reject(new Error('Worker not initialized'));

      const handler = (event: MessageEvent) => {
        if (event.data.type === 'model-loaded' && event.data.modelId === modelId) {
          this.worker?.removeEventListener('message', handler);
          resolve();
        } else if (event.data.type === 'error') {
          this.worker?.removeEventListener('message', handler);
          reject(event.data.error);
        }
      };

      this.worker.addEventListener('message', handler);
      this.worker.postMessage({
        type: 'load-model',
        data: { modelId, language },
      });
    });
  }

  private handleAudioSample(samples: Float32Array): void {
    for (let i = 0; i < samples.length; i++) {
      this.audioBuffer.push(samples[i]);
    }

    const elapsed = Date.now() - this.lastChunkTime;
    // Every 1.5 seconds or 24000 samples, trigger interim transcription
    if (this.audioBuffer.length >= 24000 || elapsed >= 1500) {
      this.flushBuffer(false);
    }
  }

  private flushBuffer(isFinal: boolean): void {
    if (this.audioBuffer.length === 0 || !this.worker || this.isTranscribing) return;

    const audioData = new Float32Array(this.audioBuffer);
    if (!isFinal && audioData.length < 16000) return; // Keep collecting if less than 1 sec

    if (isFinal) {
      this.audioBuffer = [];
    } else {
      // Keep trailing 0.5s for continuity
      this.audioBuffer = this.audioBuffer.slice(-8000);
    }

    this.lastChunkTime = Date.now();
    this.worker.postMessage({
      type: 'transcribe',
      data: {
        audioData: audioData.buffer,
        language: this.lastConfig?.language ?? 'en-IN',
        isFinal,
      },
    }, [audioData.buffer]);
  }

  private setState(state: AsrConnectionState, detail?: string): void {
    this.state = state;
    this.listeners?.onConnectionStateChange(state, detail);
  }
}
