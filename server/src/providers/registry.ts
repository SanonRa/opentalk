// Copyright (c) 2026. All rights reserved.

import { config } from '../config.js';
import {
  CloudProviderId,
  ProviderAvailability,
  ProvidersStatusResponse,
} from '../types/asr.js';
import { ServerAsrStreamProvider } from './base.js';
import { DeepgramStreamProvider } from './deepgram.js';
import { SarvamStreamProvider } from './sarvam.js';

export function getProviderAvailabilityList(): ProviderAvailability[] {
  return [
    {
      id: 'sarvam',
      name: 'Sarvam AI (Saaras v4)',
      configured: config.sarvam.apiKey.length > 0,
      streaming: true,
      supportedLanguages: [
        'en-IN',
        'hi-IN',
        'te-IN',
        'ta-IN',
        'kn-IN',
        'ml-IN',
        'bn-IN',
        'mr-IN',
        'gu-IN',
      ],
      model: config.sarvam.model,
      notes:
        'Optimised for Indian English, Hindi, regional Indian languages, and Hinglish code-mixing.',
    },
    {
      id: 'deepgram',
      name: 'Deepgram (Nova-3)',
      configured: config.deepgram.apiKey.length > 0,
      streaming: true,
      supportedLanguages: ['en-IN', 'en-US', 'en-GB', 'hi-IN'],
      model: config.deepgram.model,
      notes:
        'Low-latency global streaming WebSocket STT with interim captions and smart punctuation.',
    },
  ];
}

export function resolveActiveProviderId(
  requested?: CloudProviderId | 'auto'
): CloudProviderId | null {
  const availability = getProviderAvailabilityList();
  const isConfigured = (id: CloudProviderId) =>
    availability.some((p) => p.id === id && p.configured);

  const preference = requested && requested !== 'auto' ? requested : config.defaultProvider;

  if (preference === 'sarvam') {
    return isConfigured('sarvam') ? 'sarvam' : null;
  }
  if (preference === 'deepgram') {
    return isConfigured('deepgram') ? 'deepgram' : null;
  }

  // Auto priority: Sarvam AI first (Indian languages + en-IN focus), then Deepgram
  if (isConfigured('sarvam')) return 'sarvam';
  if (isConfigured('deepgram')) return 'deepgram';
  return null;
}

export function getProvidersStatus(): ProvidersStatusResponse {
  const providers = getProviderAvailabilityList();
  const defaultProvider = resolveActiveProviderId('auto');
  return {
    defaultProvider,
    anyCloudConfigured: defaultProvider !== null,
    providers,
    privacyNotice:
      'When a cloud ASR provider is active, live microphone audio is streamed through the OpenTalk backend to that provider for real-time transcription. OpenTalk does not save or persist raw audio on disk.',
  };
}

export function createServerAsrProvider(id: CloudProviderId): ServerAsrStreamProvider {
  if (id === 'sarvam') {
    return new SarvamStreamProvider();
  }
  return new DeepgramStreamProvider();
}
