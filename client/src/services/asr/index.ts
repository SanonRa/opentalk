// Copyright (c) 2026. All rights reserved.

import { AsrProvider, AsrProviderAvailability, AsrProviderMode } from '../../types/asr';
import { CloudProxyAsrProvider, fetchBackendProviders } from './CloudProxyAsrProvider';
import { WebSpeechAsrProvider } from './WebSpeechAsrProvider';

export { fetchBackendProviders };

export function createAsrProvider(mode: AsrProviderMode): AsrProvider {
  switch (mode) {
    case 'cloud-sarvam':
      return new CloudProxyAsrProvider('cloud-sarvam', 'Cloud Proxy — Sarvam AI');
    case 'cloud-deepgram':
      return new CloudProxyAsrProvider('cloud-deepgram', 'Cloud Proxy — Deepgram');
    case 'browser-fallback':
      return new WebSpeechAsrProvider();
    case 'cloud-auto':
    default:
      return new CloudProxyAsrProvider('cloud-auto', 'Cloud Proxy (Auto)');
  }
}

export async function checkAllProvidersAvailability(): Promise<AsrProviderAvailability[]> {
  const modes: AsrProviderMode[] = [
    'cloud-auto',
    'cloud-sarvam',
    'cloud-deepgram',
    'browser-fallback',
  ];
  return Promise.all(modes.map((mode) => createAsrProvider(mode).checkAvailability()));
}
