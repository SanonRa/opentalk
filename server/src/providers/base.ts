// Copyright (c) 2026. All rights reserved.

import { CloudProviderId, StreamStartOptions, TranscriptPayload } from '../types/asr.js';

export interface ServerAsrProviderCallbacks {
  onReady: () => void;
  onTranscript: (payload: TranscriptPayload) => void;
  onVad?: (signal: 'speech_start' | 'speech_end') => void;
  onError: (error: {
    code: 'AUTH_FAILED' | 'UPSTREAM_ERROR';
    message: string;
    recoverable: boolean;
  }) => void;
  onClose: (code: number, reason: string) => void;
}

/**
 * Provider-independent backend streaming ASR adapter interface.
 * Implementations forward live audio frames strictly in memory without writing
 * raw audio to disk.
 */
export interface ServerAsrStreamProvider {
  readonly id: CloudProviderId;
  readonly name: string;

  connect(options: StreamStartOptions, callbacks: ServerAsrProviderCallbacks): void;
  sendAudioChunk(pcm16Chunk: Buffer): void;
  flush(): void;
  close(): void;
}
