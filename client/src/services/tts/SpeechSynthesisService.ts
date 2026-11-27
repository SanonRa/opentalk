// Copyright (c) 2026. All rights reserved.

export interface TtsSpeakOptions {
  text: string;
  lang: string;
  voiceURI?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (reason: string) => void;
}

/**
 * Browser-native SpeechSynthesis wrapper.
 * Provides deterministic start/end lifecycle hooks so the Conversation Engine
 * can suspend microphone capture during speech playback and prevent acoustic
 * feedback loops.
 */
class SpeechSynthesisService {
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.isSupported()) return [];
    return window.speechSynthesis.getVoices();
  }

  public onVoicesChanged(callback: () => void): () => void {
    if (!this.isSupported()) return () => undefined;
    window.speechSynthesis.addEventListener('voiceschanged', callback);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', callback);
    };
  }

  public cancel(): void {
    if (!this.isSupported()) return;
    window.speechSynthesis.cancel();
  }

  public speak(options: TtsSpeakOptions): void {
    if (!this.isSupported()) {
      options.onError?.('Text-to-speech is not supported in this browser.');
      return;
    }

    const trimmed = options.text.trim();
    if (!trimmed) return;

    // Cancel any previous utterance cleanly before speaking the new message
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = options.lang || 'en-IN';
    utterance.rate = options.rate ?? 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    const voices = this.getVoices();
    if (options.voiceURI) {
      const exact = voices.find((v) => v.voiceURI === options.voiceURI);
      if (exact) utterance.voice = exact;
    } else if (voices.length > 0) {
      const exactLang = voices.find((v) => v.lang.toLowerCase() === utterance.lang.toLowerCase());
      const prefixLang = voices.find((v) =>
        v.lang.toLowerCase().startsWith(utterance.lang.split('-')[0].toLowerCase())
      );
      if (exactLang) utterance.voice = exactLang;
      else if (prefixLang) utterance.voice = prefixLang;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      options.onEnd?.();
    };

    utterance.onstart = () => {
      options.onStart?.();
    };
    utterance.onend = () => {
      finish();
    };
    utterance.onerror = (event) => {
      if (!settled) {
        settled = true;
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          options.onError?.(`Speech playback error: ${event.error}`);
        }
        options.onEnd?.();
      }
    };

    // Invoke onStart proactively before speak() so mic echo-guard engages
    // immediately before audio hardware opens.
    options.onStart?.();
    window.speechSynthesis.speak(utterance);
  }
}

export const ttsService = new SpeechSynthesisService();
