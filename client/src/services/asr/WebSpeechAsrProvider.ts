// Copyright (c) 2026. All rights reserved.

import {
  AsrConnectionState,
  AsrProvider,
  AsrProviderAvailability,
  AsrProviderListeners,
  AsrStartConfig,
} from '../../types/asr';

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface BrowserSpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: BrowserSpeechRecognitionAlternative;
}

interface BrowserSpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: BrowserSpeechRecognitionResult;
  };
}

interface BrowserSpeechRecognitionErrorEvent {
  readonly error: string;
  readonly message?: string;
}

interface BrowserSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

/**
 * Explicitly labelled Browser SpeechRecognition Fallback.
 *
 * Limitations (also documented in README.md and ARCHITECTURE.md):
 * - Relies on the browser's non-standard Web Speech API (best supported in
 *   Chromium-based browsers such as Chrome and Edge; limited or unavailable in
 *   Firefox and some mobile webviews).
 * - Most browsers route audio to the browser vendor's cloud service (e.g.,
 *   Google servers in Chrome), so it typically requires an internet connection
 *   and is NOT guaranteed to be offline or on-device.
 */
export class WebSpeechAsrProvider implements AsrProvider {
  public readonly id = 'browser-fallback' as const;
  public readonly displayName = 'Browser Speech Fallback (Web Speech API)';
  public readonly isCloud = false;

  private recognition: BrowserSpeechRecognition | null = null;
  private state: AsrConnectionState = 'idle';
  private listeners: AsrProviderListeners | null = null;
  private lastConfig: AsrStartConfig | null = null;
  private intentionalStop = false;
  private isPaused = false;
  private restartTimer: number | null = null;

  public getConnectionState(): AsrConnectionState {
    return this.state;
  }

  public async checkAvailability(): Promise<AsrProviderAvailability> {
    const supported = getSpeechRecognitionConstructor() !== null;
    return {
      mode: this.id,
      available: supported,
      label: this.displayName,
      description:
        'Built-in browser SpeechRecognition fallback. Useful for local prototyping without API keys (Chromium/Edge recommended; may route audio to browser vendor servers).',
      isCloud: false,
      requiresInternet: true,
      reasonIfUnavailable: supported
        ? undefined
        : 'This browser does not expose the Web Speech Recognition API. Try Chrome/Edge or configure a cloud ASR key in .env.',
    };
  }

  public async start(config: AsrStartConfig, listeners: AsrProviderListeners): Promise<void> {
    this.listeners = listeners;
    this.lastConfig = config;
    this.intentionalStop = false;
    this.isPaused = false;
    this.clearRestartTimer();

    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      const message =
        'Browser Speech Recognition is not supported in this browser. Use Chrome/Edge or configure a cloud ASR provider.';
      this.setState('error', message);
      listeners.onError({
        code: 'UNSUPPORTED_BROWSER',
        message,
        recoverable: false,
      });
      return;
    }

    this.launchRecognition(Ctor, config.language);
  }

  public pause(): void {
    if (this.isPaused) return;
    this.isPaused = true;
    this.clearRestartTimer();
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // ignore stop errors when already stopped
      }
    }
    this.setState('paused', 'Paused');
  }

  public resume(): void {
    if (!this.isPaused || this.intentionalStop || !this.lastConfig) return;
    this.isPaused = false;
    const Ctor = getSpeechRecognitionConstructor();
    if (Ctor) {
      this.launchRecognition(Ctor, this.lastConfig.language);
    }
  }

  public async stop(): Promise<void> {
    this.intentionalStop = true;
    this.isPaused = false;
    this.clearRestartTimer();
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.setState('idle', 'Stopped');
  }

  public async reconnect(): Promise<void> {
    if (this.intentionalStop || !this.lastConfig) return;
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) return;
    this.setState('reconnecting', 'Restarting browser speech recognition…');
    this.launchRecognition(Ctor, this.lastConfig.language);
  }

  private launchRecognition(Ctor: SpeechRecognitionConstructor, language: string): void {
    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.abort();
      } catch {
        // ignore
      }
    }

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = language || 'en-IN';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      if (!this.isPaused && !this.intentionalStop) {
        this.setState('connected', 'Listening via Browser Speech Fallback');
      }
    };

    rec.onresult = (event) => {
      if (this.isPaused || this.intentionalStop) return;
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0];
        if (!alt) continue;
        const transcript = alt.transcript.trim();
        if (!transcript) continue;

        if (result.isFinal) {
          this.listeners?.onFinalResult({
            text: transcript,
            isFinal: true,
            confidence: alt.confidence,
            language: rec.lang,
            timestamp: Date.now(),
          });
        } else {
          interim = interim ? `${interim} ${transcript}` : transcript;
        }
      }

      if (interim) {
        this.listeners?.onPartialResult({
          text: interim,
          isFinal: false,
          language: rec.lang,
          timestamp: Date.now(),
        });
      }
    };

    rec.onerror = (event) => {
      if (this.intentionalStop || this.isPaused) return;
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }

      const isPermission =
        event.error === 'not-allowed' || event.error === 'service-not-allowed';
      const isNetwork = event.error === 'network';

      const message = isPermission
        ? 'Microphone permission was denied for browser speech recognition.'
        : isNetwork
          ? 'Browser speech recognition requires an active internet connection.'
          : `Browser speech recognition error: ${event.error}`;

      this.setState('error', message);
      this.listeners?.onError({
        code: isPermission ? 'PERMISSION_DENIED' : isNetwork ? 'NETWORK_ERROR' : 'UNKNOWN',
        message,
        recoverable: !isPermission,
      });

      if (isPermission) {
        this.intentionalStop = true;
      }
    };

    rec.onend = () => {
      if (this.intentionalStop || this.isPaused) return;
      // Browsers automatically end continuous recognition after silence windows;
      // seamlessly restart while the user session remains active.
      this.restartTimer = window.setTimeout(() => {
        if (!this.intentionalStop && !this.isPaused) {
          this.launchRecognition(Ctor, language);
        }
      }, 250);
    };

    this.recognition = rec;
    this.setState('connecting', 'Starting browser speech recognition…');
    try {
      rec.start();
    } catch {
      // Handle rapid restart InvalidStateError gracefully
    }
  }

  private clearRestartTimer(): void {
    if (this.restartTimer !== null) {
      window.clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private setState(next: AsrConnectionState, detail?: string): void {
    this.state = next;
    this.listeners?.onConnectionStateChange(next, detail);
  }
}
