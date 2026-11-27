// Copyright (c) 2026. All rights reserved.

/**
 * AudioWorkletProcessor that downsamples input audio frames to 16 kHz
 * mono Float32Array and Int16Array, posting them to the main thread with
 * minimal allocations and zero main-thread audio processing jitter.
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetSampleRate = (options && options.processorOptions && options.processorOptions.targetSampleRate) || 16000;
    this.bufferSize = (options && options.processorOptions && options.processorOptions.bufferSize) || 2048;
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
    this.muted = false;

    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.muted === 'boolean') {
        this.muted = event.data.muted;
      }
    };
  }

  process(inputs) {
    if (this.muted) {
      return true;
    }

    const input = inputs[0];
    if (!input || input.length === 0) {
      return true;
    }

    const channelData = input[0];
    if (!channelData || channelData.length === 0) {
      return true;
    }

    const inputSampleRate = sampleRate;
    const ratio = inputSampleRate / this.targetSampleRate;

    if (Math.abs(ratio - 1.0) < 0.01) {
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferIndex++] = channelData[i];
        if (this.bufferIndex >= this.bufferSize) {
          this.flushBuffer();
        }
      }
    } else {
      let offset = 0;
      while (offset < channelData.length) {
        const nextOffset = Math.min(channelData.length, Math.round(offset + ratio));
        let sum = 0;
        let count = 0;
        for (let i = offset; i < nextOffset; i++) {
          sum += channelData[i];
          count++;
        }
        this.buffer[this.bufferIndex++] = count > 0 ? sum / count : 0;
        if (this.bufferIndex >= this.bufferSize) {
          this.flushBuffer();
        }
        offset = nextOffset;
      }
    }

    return true;
  }

  flushBuffer() {
    const chunk = new Float32Array(this.buffer.subarray(0, this.bufferIndex));
    // Also build PCM16 ArrayBuffer
    const pcm16 = new ArrayBuffer(chunk.length * 2);
    const view = new DataView(pcm16);
    for (let i = 0; i < chunk.length; i++) {
      const s = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    this.port.postMessage(
      {
        float32Chunk: chunk.buffer,
        pcm16Chunk: pcm16,
      },
      [chunk.buffer, pcm16]
    );

    this.bufferIndex = 0;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
