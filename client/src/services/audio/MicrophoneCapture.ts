// Copyright (c) 2026. All rights reserved.

/**
 * Explicit user-controlled microphone capture that downsamples live browser
 * microphone input to 16 kHz 16-bit signed linear PCM (little-endian, mono).
 *
 * Privacy guarantee:
 * - Audio is streamed strictly in memory to the active callback and discarded.
 * - No audio is recorded to disk, IndexedDB, or localStorage.
 * - All MediaStream tracks are explicitly stopped on `stop()`.
 */
export class MicrophoneCapture {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private muted = false;
  private running = false;

  constructor(private readonly targetSampleRate = 16000) {}

  public async start(onPcmChunk: (chunk: ArrayBuffer) => void): Promise<void> {
    if (this.running) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Browser does not support microphone capture (navigator.mediaDevices.getUserMedia).');
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioCtx();

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
    // 4096 samples balances low latency (~85ms at 48kHz) with broad browser compatibility
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    const inputSampleRate = this.audioContext.sampleRate;

    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.running || this.muted) return;
      const inputChannel = event.inputBuffer.getChannelData(0);
      const pcm16 = this.downsampleToPcm16(inputChannel, inputSampleRate, this.targetSampleRate);
      if (pcm16.byteLength > 0) {
        onPcmChunk(pcm16);
      }
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
    this.running = true;
    this.muted = false;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public async stop(): Promise<void> {
    this.running = false;
    this.muted = false;

    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      try {
        this.processorNode.disconnect();
      } catch {
        // ignore disconnect errors
      }
      this.processorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore disconnect errors
      }
      this.sourceNode = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        // ignore close errors
      }
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  private downsampleToPcm16(
    input: Float32Array,
    inputRate: number,
    outputRate: number
  ): ArrayBuffer {
    if (outputRate >= inputRate) {
      const buffer = new ArrayBuffer(input.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < input.length; i++) {
        const clamped = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      }
      return buffer;
    }

    const ratio = inputRate / outputRate;
    const outputLength = Math.floor(input.length / ratio);
    const buffer = new ArrayBuffer(outputLength * 2);
    const view = new DataView(buffer);

    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < outputLength) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let sum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < input.length; i++) {
        sum += input[i];
        count++;
      }
      const sample = count > 0 ? sum / count : 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offsetResult * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }

    return buffer;
  }
}
