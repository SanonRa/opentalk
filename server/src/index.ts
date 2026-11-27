// Copyright (c) 2026. All rights reserved.

import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { config, ServerConfig } from './config.js';
import { getProvidersStatus } from './providers/registry.js';
import { TranscriptionSession } from './ws/transcriptionSession.js';

export function getClientIp(req: http.IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) {
      return realIp.trim();
    }
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}

export function extractWsAuthToken(req: http.IncomingMessage): string {
  const reqUrl = new URL(req.url ?? '/', 'http://localhost');
  const queryToken = reqUrl.searchParams.get('token');
  if (queryToken) return queryToken;

  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const protocols = req.headers['sec-websocket-protocol'];
  if (typeof protocols === 'string') {
    for (const proto of protocols.split(',')) {
      const trimmed = proto.trim();
      if (trimmed.startsWith('opentalk-token.')) {
        return trimmed.slice('opentalk-token.'.length);
      }
    }
  }

  return '';
}

export function createOpenTalkServer(serverConfig: ServerConfig = config) {
  const app = express();

  const allowedOrigins =
    serverConfig.clientOrigin === '*'
      ? null
      : new Set([serverConfig.clientOrigin, 'http://localhost:5173', 'http://localhost:8080']);

  app.use(
    cors({
      origin: allowedOrigins === null ? true : Array.from(allowedOrigins),
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
  const activeSessionsByIp = new Map<string, number>();

  const wss = new WebSocketServer({
    server,
    path: '/ws/transcribe',
    maxPayload: 256 * 1024, // 256 KB max audio frame
    handleProtocols: (protocols) => {
      if (protocols.has('opentalk-v1')) return 'opentalk-v1';
      return false;
    },
    verifyClient: (info, callback) => {
      const origin = info.origin;
      if (allowedOrigins) {
        if (!origin && !serverConfig.wsAllowNoOrigin) {
          callback(false, 403, 'Origin header required');
          return;
        }
        if (origin && !allowedOrigins.has(origin)) {
          callback(false, 403, 'Origin not allowed');
          return;
        }
      }

      if (serverConfig.wsAuthToken) {
        const providedToken = extractWsAuthToken(info.req);
        if (providedToken !== serverConfig.wsAuthToken) {
          callback(false, 401, 'Unauthorized');
          return;
        }
      }

      if (wss.clients.size >= serverConfig.maxConcurrentSessions) {
        callback(false, 429, 'Server session capacity reached');
        return;
      }

      const ip = getClientIp(info.req, serverConfig.trustProxy);
      const ipCount = activeSessionsByIp.get(ip) ?? 0;
      if (ipCount >= serverConfig.maxSessionsPerIp) {
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
    const ip = getClientIp(req, serverConfig.trustProxy);
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
  }, serverConfig.wsHeartbeatMs);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return { app, server, wss, heartbeatInterval, activeSessionsByIp };
}

const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith('index.js') || process.argv[1].endsWith('index.ts'));

if (isMainModule) {
  const { server, wss, heartbeatInterval } = createOpenTalkServer(config);

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
}
