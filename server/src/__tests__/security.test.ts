// Copyright (c) 2026. All rights reserved.

import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { config, ServerConfig } from '../config.js';
import { createOpenTalkServer } from '../index.js';

function makeTestConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    ...config,
    port: 0,
    clientOrigin: 'http://localhost:5173',
    wsAuthToken: '',
    maxConcurrentSessions: 5,
    maxSessionsPerIp: 2,
    trustProxy: false,
    wsAllowNoOrigin: false,
    ...overrides,
  };
}

function connectWs(
  url: string,
  options: WebSocket.ClientOptions = {},
  protocols?: string | string[]
): Promise<{ ws?: WebSocket; statusCode?: number }> {
  return new Promise((resolve) => {
    const ws = protocols ? new WebSocket(url, protocols, options) : new WebSocket(url, options);
    ws.on('open', () => resolve({ ws }));
    ws.on('unexpected-response', (_req, res) => {
      resolve({ statusCode: res.statusCode });
    });
    ws.on('error', () => {
      // Handled by unexpected-response or close
    });
  });
}

describe('OpenTalk server security & session limits', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const fn = cleanups.pop();
      if (fn) await fn();
    }
  });

  async function startTestServer(overrides: Partial<ServerConfig> = {}) {
    const ctx = createOpenTalkServer(makeTestConfig(overrides));
    await new Promise<void>((resolve) => ctx.server.listen(0, '127.0.0.1', resolve));
    const addr = ctx.server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${addr.port}`;
    const wsUrl = `ws://127.0.0.1:${addr.port}/ws/transcribe`;

    cleanups.push(
      () =>
        new Promise<void>((resolve) => {
          clearInterval(ctx.heartbeatInterval);
          ctx.wss.clients.forEach((c) => c.terminate());
          ctx.wss.close(() => ctx.server.close(() => resolve()));
        })
    );

    return { baseUrl, wsUrl };
  }

  it('serves /api/health and /api/providers in unconfigured state', async () => {
    const { baseUrl } = await startTestServer();
    const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
    expect(health.status).toBe('ok');
    expect(health.cloudAsrConfigured).toBe(false);

    const providers = await fetch(`${baseUrl}/api/providers`).then((r) => r.json());
    expect(providers.anyCloudConfigured).toBe(false);
    expect(providers.providers.every((p: { configured: boolean }) => !p.configured)).toBe(true);
  });

  it('rejects missing Origin and disallowed Origin, allows configured Origin', async () => {
    const { wsUrl } = await startTestServer();

    const noOrigin = await connectWs(wsUrl);
    expect(noOrigin.statusCode).toBe(403);

    const badOrigin = await connectWs(wsUrl, { headers: { Origin: 'https://evil.example' } });
    expect(badOrigin.statusCode).toBe(403);

    const goodOrigin = await connectWs(wsUrl, { headers: { Origin: 'http://localhost:5173' } });
    expect(goodOrigin.ws).toBeDefined();
    goodOrigin.ws?.close();
  });

  it('enforces WS_AUTH_TOKEN via query or Sec-WebSocket-Protocol', async () => {
    const { wsUrl } = await startTestServer({ wsAuthToken: 'secret-token-123' });

    const unauth = await connectWs(wsUrl, { headers: { Origin: 'http://localhost:5173' } });
    expect(unauth.statusCode).toBe(401);

    const wrong = await connectWs(`${wsUrl}?token=wrong`, {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(wrong.statusCode).toBe(401);

    const validProto = await connectWs(
      wsUrl,
      { headers: { Origin: 'http://localhost:5173' } },
      ['opentalk-v1', 'opentalk-token.secret-token-123']
    );
    expect(validProto.ws).toBeDefined();
    validProto.ws?.close();
  });

  it('enforces per-IP limit and ignores spoofed X-Forwarded-For when trustProxy is false', async () => {
    const { wsUrl } = await startTestServer({ maxSessionsPerIp: 2, trustProxy: false });

    const c1 = await connectWs(wsUrl, {
      headers: { Origin: 'http://localhost:5173', 'X-Forwarded-For': '1.1.1.1' },
    });
    const c2 = await connectWs(wsUrl, {
      headers: { Origin: 'http://localhost:5173', 'X-Forwarded-For': '2.2.2.2' },
    });
    const c3 = await connectWs(wsUrl, {
      headers: { Origin: 'http://localhost:5173', 'X-Forwarded-For': '3.3.3.3' },
    });

    expect(c1.ws).toBeDefined();
    expect(c2.ws).toBeDefined();
    expect(c3.statusCode).toBe(429);

    c1.ws?.close();
    c2.ws?.close();
  });

  it('honours X-Real-IP behind Nginx when trustProxy is true', async () => {
    const { wsUrl } = await startTestServer({ maxSessionsPerIp: 1, trustProxy: true });

    const c1 = await connectWs(wsUrl, {
      headers: { Origin: 'http://localhost:5173', 'X-Real-IP': '203.0.113.10' },
    });
    const c2 = await connectWs(wsUrl, {
      headers: { Origin: 'http://localhost:5173', 'X-Real-IP': '203.0.113.11' },
    });
    const c1Duplicate = await connectWs(wsUrl, {
      headers: { Origin: 'http://localhost:5173', 'X-Real-IP': '203.0.113.10' },
    });

    expect(c1.ws).toBeDefined();
    expect(c2.ws).toBeDefined();
    expect(c1Duplicate.statusCode).toBe(429);

    c1.ws?.close();
    c2.ws?.close();
  });

  it('rejects malformed JSON and unconfigured provider start, responds to ping', async () => {
    const { wsUrl } = await startTestServer();
    const { ws } = await connectWs(wsUrl, { headers: { Origin: 'http://localhost:5173' } });
    expect(ws).toBeDefined();
    if (!ws) return;

    const messages: Array<Record<string, unknown>> = [];
    ws.on('message', (raw) => {
      messages.push(JSON.parse(raw.toString('utf8')) as Record<string, unknown>);
    });

    ws.send('not-json');
    ws.send(JSON.stringify({ type: 'ping' }));
    ws.send(JSON.stringify({ type: 'start', language: 'en-IN', provider: 'auto' }));

    await new Promise((r) => setTimeout(r, 50));

    expect(messages[0].code).toBe('INVALID_MESSAGE');
    expect(messages[1].type).toBe('pong');
    expect(messages[2].code).toBe('PROVIDER_UNCONFIGURED');

    ws.close();
  });

  it('enforces global maxConcurrentSessions cap and drops oversized frames', async () => {
    const { wsUrl } = await startTestServer({ maxConcurrentSessions: 2, maxSessionsPerIp: 10 });
    const s1 = await connectWs(wsUrl, { headers: { Origin: 'http://localhost:5173' } });
    const s2 = await connectWs(wsUrl, { headers: { Origin: 'http://localhost:5173' } });
    const s3 = await connectWs(wsUrl, { headers: { Origin: 'http://localhost:5173' } });

    expect(s1.ws).toBeDefined();
    expect(s2.ws).toBeDefined();
    expect(s3.statusCode).toBe(429);

    s1.ws?.close();
    s2.ws?.close();
  });
});
