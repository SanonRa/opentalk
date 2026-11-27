// Copyright (c) 2026. All rights reserved.

import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { config } from './config.js';
import { getProvidersStatus } from './providers/registry.js';
import { TranscriptionSession } from './ws/transcriptionSession.js';

const app = express();

app.use(
  cors({
    origin: config.clientOrigin === '*' ? true : [config.clientOrigin, 'http://localhost:5173', 'http://localhost:8080'],
    credentials: false,
  })
);
app.use(express.json({ limit: '64kb' }));

app.get('/api/health', (_req, res) => {
  const providerStatus = getProvidersStatus();
  res.json({
    status: 'ok',
    service: 'opentalk-server',
    timestamp: new Date().toISOString(),
    cloudAsrConfigured: providerStatus.anyCloudConfigured,
    defaultProvider: providerStatus.defaultProvider,
  });
});

app.get('/api/providers', (_req, res) => {
  res.json(getProvidersStatus());
});

const server = http.createServer(app);

const allowedOrigins =
  config.clientOrigin === '*'
    ? null
    : new Set([config.clientOrigin, 'http://localhost:5173', 'http://localhost:8080']);

const activeSessionsByIp = new Map<string, number>();

function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

const wss = new WebSocketServer({
  server,
  path: '/ws/transcribe',
  maxPayload: 256 * 1024, // 256 KB max audio frame
  verifyClient: (info, callback) => {
    const origin = info.origin;
    if (allowedOrigins && origin && !allowedOrigins.has(origin)) {
      callback(false, 403, 'Origin not allowed');
      return;
    }

    if (config.wsAuthToken) {
      const reqUrl = new URL(info.req.url ?? '/', 'http://localhost');
      const queryToken = reqUrl.searchParams.get('token');
      const authHeader = info.req.headers.authorization;
      const bearerToken =
        typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : '';
      if (queryToken !== config.wsAuthToken && bearerToken !== config.wsAuthToken) {
        callback(false, 401, 'Unauthorized');
        return;
      }
    }

    if (wss.clients.size >= config.maxConcurrentSessions) {
      callback(false, 429, 'Server session capacity reached');
      return;
    }

    const ip = getClientIp(info.req);
    const ipCount = activeSessionsByIp.get(ip) ?? 0;
    if (ipCount >= config.maxSessionsPerIp) {
      callback(false, 429, 'Too many concurrent sessions from this IP');
      return;
    }

    callback(true);
  },
});

interface AliveWebSocket extends WebSocket {
  isAlive?: boolean;
}

wss.on('connection', (ws: AliveWebSocket, req: http.IncomingMessage) => {
  const ip = getClientIp(req);
  activeSessionsByIp.set(ip, (activeSessionsByIp.get(ip) ?? 0) + 1);

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('close', () => {
    const current = activeSessionsByIp.get(ip) ?? 0;
    if (current <= 1) {
      activeSessionsByIp.delete(ip);
    } else {
      activeSessionsByIp.set(ip, current - 1);
    }
  });

  const session = new TranscriptionSession(ws);
  session.attach();
});

const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((client) => {
    const ws = client as AliveWebSocket;
    if (ws.isAlive === false) {
      ws.terminate();
      return;
    }
    ws.isAlive = false;
    ws.ping();
  });
}, config.wsHeartbeatMs);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

server.listen(config.port, () => {
  const status = getProvidersStatus();
  const configuredNames = status.providers
    .filter((p) => p.configured)
    .map((p) => p.id)
    .join(', ');

  console.log(`[OpenTalk Server] Listening on port ${config.port} (${config.nodeEnv})`);
  if (configuredNames) {
    console.log(`[OpenTalk Server] Configured cloud ASR providers: ${configuredNames}`);
  } else {
    console.log(
      '[OpenTalk Server] Running without cloud ASR API keys. UI will start normally; configure SARVAM_API_KEY or DEEPGRAM_API_KEY in .env to enable cloud streaming.'
    );
  }
});

function shutdown(signal: string): void {
  console.log(`[OpenTalk Server] Received ${signal}, shutting down cleanly...`);
  clearInterval(heartbeatInterval);
  wss.close();
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
