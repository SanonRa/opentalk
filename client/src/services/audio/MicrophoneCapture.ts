// Copyright (c) 2026. All rights reserved.

export type PcmAudioCallback = (pcm16: ArrayBuffer, float32?: Float32Array) => void;

/**
 * MicrophoneCapture with AudioWorkletNode support and graceful ScriptProcessorNode fallback.
 * Captures 16 kHz mono linear audio for both local on-device inference (Float32Array)
 * and cloud WebSocket streaming (Int16 PCM).
 */
export class MicrophoneCapture {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private muted = false;
  private running = false;

  constructor(private readonly targetSampleRate = 16000) {}

  public async start(onAudioChunk: PcmAudioCallback): Promise<void> {
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

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioCtx();

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

    let workletInitialized = false;
    if (this.audioContext.audioWorklet && typeof this.audioContext.audioWorklet.addModule === 'function') {
      try {
        await this.audioContext.audioWorklet.addModule('/worklets/pcm-capture-processor.js');
        this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-capture-processor', {
          processorOptions: {
            targetSampleRate: this.targetSampleRate,
            bufferSize: 2048,
          },
        });
        this.workletNode.port.onmessage = (event) => {
          if (!this.running || this.muted) return;
          const { pcm16Chunk, float32Chunk } = event.data;
          if (pcm16Chunk) {
            const f32 = float32Chunk ? new Float32Array(float32Chunk) : undefined;
            onAudioChunk(pcm16Chunk, f32);
          }
        };
        this.sourceNode.connect(this.workletNode);
        this.workletNode.connect(this.audioContext.destination);
        workletInitialized = true;
      } catch {
        // Fallback to ScriptProcessorNode
        workletInitialized = false;
      }
    }

    if (!workletInitialized) {
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);
      const inputSampleRate = this.audioContext.sampleRate;

      this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.running || this.muted) return;
        const inputChannel = event.inputBuffer.getChannelData(0);
        const { pcm16, float32 } = this.downsampleAudio(
          inputChannel,
          inputSampleRate,
          this.targetSampleRate
        );
        if (pcm16.byteLength > 0) {
          onAudioChunk(pcm16, float32);
        }
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);
    }

    this.running = true;
    this.muted = false;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.workletNode) {
      this.workletNode.port.postMessage({ muted });
    }
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

    if (this.workletNode) {
      try {
        this.workletNode.disconnect();
      } catch {
        // ignore
      }
      this.workletNode = null;
    }

    if (this.processorNode) {
      this.processorNode.onaudioprocess = null;
      try {
        this.processorNode.disconnect();
      } catch {
        // ignore
      }
      this.processorNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }

    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  private downsampleAudio(
    input: Float32Array,
    inputRate: number,
    outputRate: number
  ): { pcm16: ArrayBuffer; float32: Float32Array } {
    if (outputRate >= inputRate) {
      const pcm16 = new ArrayBuffer(input.length * 2);
      const view = new DataView(pcm16);
      const float32 = new Float32Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const clamped = Math.max(-1, Math.min(1, input[i]));
        float32[i] = clamped;
        view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      }
      return { pcm16, float32 };
    }

    const ratio = inputRate / outputRate;
    const outputLength = Math.floor(input.length / ratio);
    const pcm16 = new ArrayBuffer(outputLength * 2);
    const view = new DataView(pcm16);
    const float32 = new Float32Array(outputLength);

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
      const avg = count > 0 ? sum / count : 0;
      const clamped = Math.max(-1, Math.min(1, avg));
      float32[offsetResult] = clamped;
      view.setInt16(offsetResult * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);

      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }

    return { pcm16, float32 };
  }
}
