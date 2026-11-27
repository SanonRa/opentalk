// Copyright (c) 2026. All rights reserved.

import dotenv from 'dotenv';
import path from 'node:path';
import { CloudProviderId } from './types/asr.js';

// Load root .env if present; silently continue when running without secrets
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDefaultProvider(value: string | undefined): CloudProviderId | 'auto' {
  if (value === 'sarvam' || value === 'deepgram' || value === 'auto') {
    return value;
  }
  return 'auto';
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  return fallback;
}

export interface ServerConfig {
  nodeEnv: string;
  port: number;
  clientOrigin: string;
  defaultProvider: CloudProviderId | 'auto';
  sarvam: {
    apiKey: string;
    model: string;
    mode: string;
  };
  deepgram: {
    apiKey: string;
    model: string;
    endpointingMs: number;
  };
  maxSessionSeconds: number;
  wsHeartbeatMs: number;
  wsAuthToken: string;
  maxConcurrentSessions: number;
  maxSessionsPerIp: number;
  trustProxy: boolean;
  wsAllowNoOrigin: boolean;
}

export const config: ServerConfig = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePositiveInt(process.env.PORT, 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  defaultProvider: parseDefaultProvider(process.env.ASR_DEFAULT_PROVIDER),
  sarvam: {
    apiKey: (process.env.SARVAM_API_KEY ?? '').trim(),
    model: (process.env.SARVAM_STT_MODEL ?? 'saaras:v4').trim(),
    mode: (process.env.SARVAM_STT_MODE ?? 'transcribe').trim(),
  },
  deepgram: {
    apiKey: (process.env.DEEPGRAM_API_KEY ?? '').trim(),
    model: (process.env.DEEPGRAM_STT_MODEL ?? 'nova-3').trim(),
    endpointingMs: parsePositiveInt(process.env.DEEPGRAM_ENDPOINTING_MS, 400),
  },
  maxSessionSeconds: parsePositiveInt(process.env.ASR_MAX_SESSION_SECONDS, 1800),
  wsHeartbeatMs: parsePositiveInt(process.env.WS_HEARTBEAT_MS, 25000),
  wsAuthToken: (process.env.WS_AUTH_TOKEN ?? '').trim(),
  maxConcurrentSessions: parsePositiveInt(process.env.MAX_CONCURRENT_SESSIONS, 10),
  maxSessionsPerIp: parsePositiveInt(process.env.MAX_SESSIONS_PER_IP, 3),
  trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
  wsAllowNoOrigin: parseBoolean(process.env.WS_ALLOW_NO_ORIGIN, false),
};
