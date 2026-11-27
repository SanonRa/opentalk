// Copyright (c) 2026. All rights reserved.

import React, { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Contrast,
  Volume2,
  Shield,
  RefreshCw,
  Cloud,
  Globe,
  Cpu,
  Download,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { CAPTION_COLOR_PRESETS, SUPPORTED_LANGUAGES } from '../data/defaults';
import { useOpenTalk } from '../engine/ConversationContext';
import { AsrProviderMode, LocalModelDownloadProgress } from '../types/asr';
import { CaptionSize, UiTextSize } from '../types/settings';
import {
  AVAILABLE_LOCAL_MODELS,
  LocalWhisperAsrProvider,
} from '../services/asr/LocalWhisperAsrProvider';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    providerAvailabilities,
    backendStatus,
    availableVoices,
    refreshProviderStatus,
    speakMessageAloud,
    clearAllHistory,
    history,
  } = useOpenTalk();

  const providerOptions: Array<{
    mode: AsrProviderMode;
    title: string;
    subtitle: string;
  }> = [
    {
      mode: 'local-whisper',
      title: 'Local ASR (On-Device Whisper)',
      subtitle:
        '100% on-device speech recognition via Transformers.js ONNX. Zero microphone audio leaves your browser. Works completely offline once downloaded.',
    },
    {
      mode: 'cloud-auto',
      title: 'Cloud Proxy (Auto)',
      subtitle: 'Uses Sarvam AI if configured, otherwise Deepgram via the OpenTalk backend.',
    },
    {
      mode: 'cloud-sarvam',
      title: 'Sarvam AI (Saaras v4)',
      subtitle: 'Optimised for Indian English, Hindi, regional languages & Hinglish.',
    },
    {
      mode: 'cloud-deepgram',
      title: 'Deepgram (Nova-3)',
      subtitle: 'Low-latency global streaming WebSocket STT.',
    },
    {
      mode: 'browser-fallback',
      title: 'Browser Speech Fallback (Web Speech API)',
      subtitle:
        'Prototype fallback without API keys. Best in Chrome/Edge; typically requires internet and routes audio through browser vendor servers.',
    },
  ];

  const [cachedModels, setCachedModels] = useState<Record<string, boolean>>({});
  const [downloadProgress, setDownloadProgress] = useState<LocalModelDownloadProgress | null>(null);
  const [activeLocalModel, setActiveLocalModel] = useState<string>(
    LocalWhisperAsrProvider.getSelectedModelId()
  );

  useEffect(() => {
    async function checkCaches() {
      const results: Record<string, boolean> = {};
      for (const m of AVAILABLE_LOCAL_MODELS) {
        results[m.id] = await LocalWhisperAsrProvider.isModelCached(m.id);
      }
      setCachedModels(results);
    }
    void checkCaches();
  }, []);

  const handleDownloadModel = (modelId: string) => {
    setDownloadProgress({ modelId, status: 'initiate', progress: 0 });
    const worker = new Worker(new URL('../services/asr/localAsr.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e) => {
      if (e.data.type === 'download-progress') {
        setDownloadProgress(e.data.data);
      } else if (e.data.type === 'model-loaded') {
        setDownloadProgress(null);
        setCachedModels((prev) => ({ ...prev, [modelId]: true }));
        worker.terminate();
      } else if (e.data.type === 'error') {
        alert(e.data.error.message);
        setDownloadProgress(null);
        worker.terminate();
      }
    };
    worker.postMessage({
      type: 'load-model',
      data: { modelId, language: settings.language },
    });
  };

  const handleDeleteModel = async (modelId: string) => {
    if (confirm('Delete this downloaded model from browser storage to free up space?')) {
      await LocalWhisperAsrProvider.deleteModelCache(modelId);
      setCachedModels((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings & Accessibility</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Tailor caption readability, colour contrast, speech recognition, voice playback, and
          privacy controls.
        </p>
      </div>

      {/* 1. Theme & Contrast */}
      <section className="hc-card space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-bold">Appearance & Accessibility</h2>

        {/* Theme */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => updateSettings((prev) => ({ ...prev, theme: 'light' }))}
            className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border text-sm font-bold ${
              settings.theme === 'light'
                ? 'hc-accent-btn border-sky-600 bg-sky-600 text-white'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            <Sun className="h-4 w-4" aria-hidden="true" />
            <span>Light Theme</span>
          </button>
          <button
            type="button"
            onClick={() => updateSettings((prev) => ({ ...prev, theme: 'dark' }))}
            className={`flex min-h-[48px] items-center justify-center gap-2 rounded-xl border text-sm font-bold ${
              settings.theme === 'dark'
                ? 'hc-accent-btn border-sky-600 bg-sky-600 text-white'
                : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            <Moon className="h-4 w-4" aria-hidden="true" />
            <span>Dark Theme</span>
          </button>
        </div>

        {/* High Contrast */}
        <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950">
          <div className="flex items-center gap-2.5">
            <Contrast className="h-5 w-5 text-amber-500" aria-hidden="true" />
            <div>
              <div className="text-sm font-bold">High-Contrast Mode</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Pure black surfaces, white text, and high-visibility yellow focus & action highlights.
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.highContrast}
            onClick={() =>
              updateSettings((prev) => ({ ...prev, highContrast: !prev.highContrast }))
            }
            className={`min-h-[42px] min-w-[72px] rounded-xl px-4 text-sm font-bold ${
              settings.highContrast
                ? 'bg-yellow-400 text-black'
                : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {settings.highContrast ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Caption Text Size */}
        <div>
          <span className="mb-2 block text-sm font-bold">Caption Text Size</span>
          <div className="grid grid-cols-4 gap-2">
            {(['md', 'lg', 'xl', '2xl'] as CaptionSize[]).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => updateSettings((prev) => ({ ...prev, captionSize: sz }))}
                className={`min-h-[46px] rounded-xl border text-sm font-bold uppercase ${
                  settings.captionSize === sz
                    ? 'hc-accent-btn border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        {/* Interface Text Size */}
        <div>
          <span className="mb-2 block text-sm font-bold">Interface Text Size</span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: 'normal', label: 'Standard' },
                { value: 'large', label: 'Large' },
                { value: 'xlarge', label: 'Extra Large' },
              ] as Array<{ value: UiTextSize; label: string }>
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() =>
                  updateSettings((prev) => ({ ...prev, uiTextSize: opt.value }))
                }
                className={`min-h-[46px] rounded-xl border text-sm font-bold ${
                  settings.uiTextSize === opt.value
                    ? 'hc-accent-btn border-sky-600 bg-sky-600 text-white'
                    : 'border-slate-300 dark:border-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Caption Text & Background Colours */}
        <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold">Custom Caption Colours</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.useCustomCaptionColors}
              onClick={() =>
                updateSettings((prev) => ({
                  ...prev,
                  useCustomCaptionColors: !prev.useCustomCaptionColors,
                }))
              }
              className={`min-h-[38px] rounded-xl px-3.5 text-xs font-bold ${
                settings.useCustomCaptionColors
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {settings.useCustomCaptionColors ? 'Enabled' : 'Theme Default'}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-xl border border-slate-300 p-3 text-sm font-semibold dark:border-slate-700">
              <span>Caption Text Colour</span>
              <input
                type="color"
                value={settings.captionTextColor}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    useCustomCaptionColors: true,
                    captionTextColor: e.target.value,
                  }))
                }
                className="h-9 w-14 cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
            <label className="flex items-center justify-between rounded-xl border border-slate-300 p-3 text-sm font-semibold dark:border-slate-700">
              <span>Caption Background</span>
              <input
                type="color"
                value={settings.captionBgColor}
                onChange={(e) =>
                  updateSettings((prev) => ({
                    ...prev,
                    useCustomCaptionColors: true,
                    captionBgColor: e.target.value,
                  }))
                }
                className="h-9 w-14 cursor-pointer rounded border-0 bg-transparent"
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            {CAPTION_COLOR_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  updateSettings((prev) => ({
                    ...prev,
                    highContrast: false,
                    useCustomCaptionColors: true,
                    captionBgColor: preset.bg,
                    captionTextColor: preset.text,
                  }))
                }
                style={{ backgroundColor: preset.bg, color: preset.text }}
                className="min-h-[38px] rounded-lg border border-slate-400/60 px-3 py-1.5 text-xs font-bold"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 2. Language & Speech Recognition Provider */}
      <section className="hc-card space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Language & Speech Recognition</h2>
          <button
            type="button"
            onClick={() => void refreshProviderStatus()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs font-bold dark:border-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Check Status</span>
          </button>
        </div>

        <div>
          <label htmlFor="settings-language" className="mb-1.5 block text-sm font-bold">
            Primary Spoken & Caption Language
          </label>
          <select
            id="settings-language"
            value={settings.language}
            onChange={(e) =>
              updateSettings((prev) => ({ ...prev, language: e.target.value }))
            }
            className="hc-surface min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-base font-semibold dark:border-slate-700 dark:bg-slate-950"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeLabel} ({lang.code})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2.5">
          <span className="block text-sm font-bold">Speech Recognition Provider</span>
          {providerOptions.map((opt) => {
            const avail = providerAvailabilities.find((p) => p.mode === opt.mode);
            const selected = settings.asrProviderMode === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() =>
                  updateSettings((prev) => ({ ...prev, asrProviderMode: opt.mode }))
                }
                className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition ${
                  selected
                    ? 'border-sky-600 bg-sky-50/70 dark:border-sky-400 dark:bg-sky-950/40'
                    : 'border-slate-200 hover:border-slate-400 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {opt.mode === 'local-whisper' ? (
                    <Cpu className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" aria-hidden="true" />
                  ) : opt.mode === 'browser-fallback' ? (
                    <Globe className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
                  ) : (
                    <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-sky-500" aria-hidden="true" />
                  )}
                  <div>
                    <div className="text-sm font-bold">{opt.title}</div>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      {opt.subtitle}
                    </p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    avail?.available
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
                  }`}
                >
                  {avail?.available ? 'Available' : 'Unconfigured'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Local Whisper Model Management */}
        {settings.asrProviderMode === 'local-whisper' && (
          <div className="mt-4 space-y-3 rounded-xl border border-sky-200 bg-sky-50/50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-sky-950 dark:text-sky-100">
                  On-Device Whisper Model Storage
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Models are stored locally in browser Cache Storage. Download once for permanent offline use.
                </p>
              </div>
            </div>

            {downloadProgress && (
              <div className="rounded-lg bg-white p-3 dark:bg-slate-900">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Downloading {downloadProgress.file || downloadProgress.modelId}…</span>
                  <span>{downloadProgress.progress !== undefined ? `${downloadProgress.progress}%` : 'Preparing…'}</span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full bg-sky-600 transition-all duration-300"
                    style={{ width: `${downloadProgress.progress || 10}%` }}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              {AVAILABLE_LOCAL_MODELS.map((model) => {
                const isCached = Boolean(cachedModels[model.id]);
                const isSelected = activeLocalModel === model.id;
                return (
                  <div
                    key={model.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{model.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          ~{model.sizeMb} MB
                        </span>
                        {model.recommended && (
                          <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                            Recommended
                          </span>
                        )}
                        {isCached && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Downloaded</span>
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {model.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isCached ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveLocalModel(model.id);
                              LocalWhisperAsrProvider.setSelectedModelId(model.id);
                            }}
                            className={`min-h-[36px] rounded-lg px-3 text-xs font-bold ${
                              isSelected
                                ? 'bg-sky-600 text-white'
                                : 'border border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            {isSelected ? 'Active' : 'Select'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteModel(model.id)}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-rose-200 px-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/50"
                            title="Delete model from cache"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(downloadProgress)}
                          onClick={() => handleDownloadModel(model.id)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white transition hover:bg-sky-700 disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download (~{model.sizeMb}MB)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 3. Text-to-Speech (TTS) Preferences */}
      <section className="hc-card space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Text-to-Speech (TTS)</h2>
          <button
            type="button"
            onClick={() => speakMessageAloud('Hello, this is OpenTalk speaking aloud.')}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 text-xs font-bold text-white hover:bg-sky-700"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            <span>Test Voice</span>
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950">
          <div>
            <div className="text-sm font-bold">Speak Typed Replies Automatically</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Microphone is automatically paused while OpenTalk speaks to prevent echo.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.tts.enabled}
            onClick={() =>
              updateSettings((prev) => ({
                ...prev,
                tts: { ...prev.tts, enabled: !prev.tts.enabled },
              }))
            }
            className={`min-h-[40px] min-w-[68px] rounded-xl px-3.5 text-xs font-bold ${
              settings.tts.enabled
                ? 'bg-sky-600 text-white'
                : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {settings.tts.enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div>
          <label htmlFor="tts-voice-select" className="mb-1.5 block text-sm font-bold">
            Device Voice ({availableVoices.length} detected)
          </label>
          <select
            id="tts-voice-select"
            value={settings.tts.voiceURI}
            onChange={(e) =>
              updateSettings((prev) => ({
                ...prev,
                tts: { ...prev.tts, voiceURI: e.target.value },
              }))
            }
            className="hc-surface min-h-[48px] w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950"
          >
            <option value="">Automatic (match selected language)</option>
            {availableVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm font-bold">
            <div className="flex justify-between">
              <span>Speech Rate</span>
              <span>{settings.tts.rate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.6"
              step="0.1"
              value={settings.tts.rate}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  tts: { ...prev.tts, rate: Number(e.target.value) },
                }))
              }
              className="w-full accent-sky-600"
            />
          </label>

          <label className="space-y-1.5 text-sm font-bold">
            <div className="flex justify-between">
              <span>Voice Pitch</span>
              <span>{settings.tts.pitch.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.5"
              step="0.1"
              value={settings.tts.pitch}
              onChange={(e) =>
                updateSettings((prev) => ({
                  ...prev,
                  tts: { ...prev.tts, pitch: Number(e.target.value) },
                }))
              }
              className="w-full accent-sky-600"
            />
          </label>
        </div>
      </section>

      {/* 4. Privacy & Data Handling */}
      <section className="hc-card space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <h2 className="text-lg font-bold">Privacy Controls</h2>
        </div>

        <p className="rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          {backendStatus?.privacyNotice ??
            'When a cloud ASR provider is active, live microphone audio is streamed through the OpenTalk backend to that provider for real-time transcription. OpenTalk never saves or persists raw audio.'}
        </p>

        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold">Allow Local Conversation History</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Opt-in only. Stores text transcripts solely in this browser&apos;s localStorage.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.privacy.allowHistorySaving}
            onClick={() =>
              updateSettings((prev) => ({
                ...prev,
                privacy: {
                  ...prev.privacy,
                  allowHistorySaving: !prev.privacy.allowHistorySaving,
                  autoSaveOnEnd: !prev.privacy.allowHistorySaving
                    ? prev.privacy.autoSaveOnEnd
                    : false,
                },
              }))
            }
            className={`min-h-[40px] min-w-[68px] rounded-xl px-3.5 text-xs font-bold ${
              settings.privacy.allowHistorySaving
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {settings.privacy.allowHistorySaving ? 'ON' : 'OFF'}
          </button>
        </div>

        {settings.privacy.allowHistorySaving && (
          <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-800">
            <div>
              <div className="text-sm font-bold">Auto-Save Transcript When Stopping</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Automatically save text transcript to local history when you tap Stop.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.privacy.autoSaveOnEnd}
              onClick={() =>
                updateSettings((prev) => ({
                  ...prev,
                  privacy: {
                    ...prev.privacy,
                    autoSaveOnEnd: !prev.privacy.autoSaveOnEnd,
                  },
                }))
              }
              className={`min-h-[40px] min-w-[68px] rounded-xl px-3.5 text-xs font-bold ${
                settings.privacy.autoSaveOnEnd
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {settings.privacy.autoSaveOnEnd ? 'ON' : 'OFF'}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3 dark:border-slate-800">
          <div>
            <div className="text-sm font-bold">Always Show Microphone Status Banner</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Keeps the top status bar visible even when the microphone is off.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.privacy.showMicBannerAlways}
            onClick={() =>
              updateSettings((prev) => ({
                ...prev,
                privacy: {
                  ...prev.privacy,
                  showMicBannerAlways: !prev.privacy.showMicBannerAlways,
                },
              }))
            }
            className={`min-h-[40px] min-w-[68px] rounded-xl px-3.5 text-xs font-bold ${
              settings.privacy.showMicBannerAlways
                ? 'bg-sky-600 text-white'
                : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {settings.privacy.showMicBannerAlways ? 'ON' : 'OFF'}
          </button>
        </div>

        {history.length > 0 && (
          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <button
              type="button"
              onClick={clearAllHistory}
              className="min-h-[44px] rounded-xl border border-rose-400 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950"
            >
              Delete All Saved Conversations ({history.length})
            </button>
          </div>
        )}
      </section>
    </div>
  );
};
