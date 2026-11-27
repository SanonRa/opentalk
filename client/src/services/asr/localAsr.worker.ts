// Copyright (c) 2026. All rights reserved.

import { pipeline, env } from '@huggingface/transformers';

// Configure transformers for browser/worker environment
env.allowLocalModels = false;
env.useBrowserCache = true;

let asrPipeline: any = null;
let currentModelId: string | null = null;
let isProcessing = false;

self.onmessage = async (event: MessageEvent) => {
  const { type, data, id } = event.data;

  switch (type) {
    case 'load-model': {
      const { modelId } = data;
      try {
        if (asrPipeline && currentModelId === modelId) {
          self.postMessage({ type: 'model-loaded', id, modelId });
          return;
        }

        self.postMessage({
          type: 'download-progress',
          data: { modelId, status: 'initiate', progress: 0 },
        });

        asrPipeline = await pipeline('automatic-speech-recognition', modelId, {
          dtype: 'q8',
          device: 'wasm',
          progress_callback: (progressInfo: any) => {
            self.postMessage({
              type: 'download-progress',
              data: {
                modelId,
                status: progressInfo.status,
                file: progressInfo.file,
                progress: progressInfo.progress ?? (progressInfo.loaded && progressInfo.total ? Math.round((progressInfo.loaded / progressInfo.total) * 100) : undefined),
                loaded: progressInfo.loaded,
                total: progressInfo.total,
              },
            });
          },
        });

        currentModelId = modelId;
        self.postMessage({ type: 'model-loaded', id, modelId });
      } catch (err: any) {
        self.postMessage({
          type: 'error',
          id,
          error: {
            code: 'MODEL_LOAD_FAILED',
            message: err?.message || 'Failed to initialize local Whisper model.',
          },
        });
      }
      break;
    }

    case 'transcribe': {
      if (!asrPipeline) {
        self.postMessage({
          type: 'error',
          id,
          error: {
            code: 'MODEL_NOT_DOWNLOADED',
            message: 'Local speech model is not loaded.',
          },
        });
        return;
      }

      if (isProcessing) {
        return;
      }

      isProcessing = true;
      const { audioData, language, isFinal } = data;

      try {
        const floatArray = new Float32Array(audioData);
        if (floatArray.length < 1600) {
          // Less than 100ms
          isProcessing = false;
          return;
        }

        const normLang = (language || 'en').split('-')[0].toLowerCase();
        const whisperLang = normLang === 'hi' ? 'hindi' : normLang === 'te' ? 'telugu' : 'english';

        const result: any = await asrPipeline(floatArray, {
          language: whisperLang,
          task: 'transcribe',
          chunk_length_s: 30,
          stride_length_s: 5,
        });

        const text = (result?.text || '').trim();
        if (text) {
          self.postMessage({
            type: 'transcript',
            id,
            data: {
              text,
              isFinal: Boolean(isFinal),
              language: whisperLang,
              timestamp: Date.now(),
            },
          });
        }
      } catch (err: any) {
        self.postMessage({
          type: 'error',
          id,
          error: {
            code: 'INFERENCE_ERROR',
            message: err?.message || 'Inference error during local transcription.',
          },
        });
      } finally {
        isProcessing = false;
      }
      break;
    }

    case 'unload-model': {
      asrPipeline = null;
      currentModelId = null;
      self.postMessage({ type: 'model-unloaded', id });
      break;
    }

    default:
      break;
  }
};
