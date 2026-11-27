// Copyright (c) 2026. All rights reserved.

import { describe, it, expect } from 'vitest';
import {
  LocalWhisperAsrProvider,
  AVAILABLE_LOCAL_MODELS,
} from '../LocalWhisperAsrProvider';

describe('LocalWhisperAsrProvider', () => {
  it('exposes available quantized local models', () => {
    expect(AVAILABLE_LOCAL_MODELS.length).toBeGreaterThanOrEqual(2);
    expect(AVAILABLE_LOCAL_MODELS[0].id).toBe('onnx-community/whisper-tiny');
    expect(AVAILABLE_LOCAL_MODELS[1].id).toBe('onnx-community/whisper-base');
    expect(AVAILABLE_LOCAL_MODELS[0].languages).toContain('en-IN');
    expect(AVAILABLE_LOCAL_MODELS[1].languages).toContain('te-IN');
  });

  it('checks availability based on WebAssembly and Worker environment', async () => {
    const provider = new LocalWhisperAsrProvider();
    const avail = await provider.checkAvailability();
    expect(avail.mode).toBe('local-whisper');
    expect(avail.isCloud).toBe(false);
    expect(avail.requiresInternet).toBe(false);
  });

  it('manages selected local model ID via localStorage', () => {
    LocalWhisperAsrProvider.setSelectedModelId('onnx-community/whisper-base');
    expect(LocalWhisperAsrProvider.getSelectedModelId()).toBe('onnx-community/whisper-base');
    LocalWhisperAsrProvider.setSelectedModelId('onnx-community/whisper-tiny');
    expect(LocalWhisperAsrProvider.getSelectedModelId()).toBe('onnx-community/whisper-tiny');
  });
});
