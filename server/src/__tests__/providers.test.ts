// Copyright (c) 2026. All rights reserved.

import { describe, it, expect, afterEach, vi } from 'vitest';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { SarvamStreamProvider } from '../providers/sarvam.js';
import { DeepgramStreamProvider } from '../providers/deepgram.js';
import { config } from '../config.js';

interface MockServerContext {
  wss: WebSocketServer;
  url: string;
  close: () => Promise<void>;
}

async function startMockWsServer(): Promise<MockServerContext> {
  const server = http.createServer();
  const wss = new WebSocketServer({ server });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  return {
    wss,
    url: `ws://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        wss.close(() => server.close(() => resolve()));
      }),
  };
}

describe('SarvamStreamProvider (mock WebSocket)', () => {
  let mock: MockServerContext | null = null;

  afterEach(async () => {
    vi.useRealTimers();
    if (mock) {
      await mock.close();
      mock = null;
    }
  });

  it('uses realtime query params, Api-Subscription-Key header, audio_input envelope, and partial/final events', async () => {
    mock = await startMockWsServer();
    config.sarvam.apiKey = 'test-sarvam-key';

    let capturedReqUrl = '';
    let capturedApiKey: string | undefined;
    const receivedPayloads: Array<Record<string, unknown>> = [];

    mock.wss.on('connection', (ws, req) => {
      capturedReqUrl = req.url ?? '';
      capturedApiKey = req.headers['api-subscription-key'] as string | undefined;

      ws.send(JSON.stringify({ event: 'session.begin', request_id: 'req-123' }));

      ws.on('message', (raw) => {
        const parsed = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
        receivedPayloads.push(parsed);

        if (parsed.event === 'audio_input') {
          ws.send(JSON.stringify({ event: 'vad.speech_start' }));
          ws.send(
            JSON.stringify({
              event: 'transcript.partial',
              transcript: 'Namaste',
              language: 'hi-IN',
            })
          );
        } else if (parsed.event === 'flush') {
          ws.send(
            JSON.stringify({
              event: 'transcript.final',
              transcript: 'Namaste doston',
              language: 'hi-IN',
            })
          );
          ws.send(JSON.stringify({ event: 'vad.speech_end' }));
        }
      });
    });

    const provider = new SarvamStreamProvider(mock.url);
    const transcripts: Array<{ text: string; isFinal: boolean }> = [];
    const vads: string[] = [];

    await new Promise<void>((resolve, reject) => {
      provider.connect(
        { language: 'hi-IN', sampleRate: 16000, provider: 'sarvam' },
        {
          onReady: () => {
            provider.sendAudioChunk(Buffer.from([1, 2, 3, 4]));
            provider.flush();
          },
          onTranscript: (t) => {
            transcripts.push({ text: t.text, isFinal: t.isFinal });
            if (t.isFinal) {
              setTimeout(() => {
                provider.close();
                resolve();
              }, 20);
            }
          },
          onVad: (s) => vads.push(s),
          onError: (e) => reject(new Error(e.message)),
          onClose: () => {},
        }
      );
    });

    expect(capturedApiKey).toBe('test-sarvam-key');
    expect(capturedReqUrl).toContain('language_code=hi-IN');
    expect(capturedReqUrl).toContain('model=saaras%3Av4');
    expect(capturedReqUrl).toContain('encoding=linear16');
    expect(capturedReqUrl).toContain('sample_rate=16000');

    expect(receivedPayloads[0]).toEqual({
      event: 'audio_input',
      audio: Buffer.from([1, 2, 3, 4]).toString('base64'),
    });
    expect(receivedPayloads[1]).toEqual({ event: 'flush' });

    expect(vads).toEqual(['speech_start', 'speech_end']);
    expect(transcripts).toEqual([
      { text: 'Namaste', isFinal: false },
      { text: 'Namaste doston', isFinal: true },
    ]);
  });
});

describe('DeepgramStreamProvider (mock WebSocket)', () => {
  let mock: MockServerContext | null = null;

  afterEach(async () => {
    vi.useRealTimers();
    if (mock) {
      await mock.close();
      mock = null;
    }
  });

  it('sends Authorization Token, linear16 PCM, 5s KeepAlive, Finalize, and handles interim/final Results', async () => {
    vi.useFakeTimers();
    mock = await startMockWsServer();
    config.deepgram.apiKey = 'test-deepgram-key';

    let capturedAuth: string | undefined;
    let capturedUrl = '';
    const controlMessages: Array<Record<string, unknown>> = [];
    const binaryChunks: Buffer[] = [];

    mock.wss.on('connection', (ws, req) => {
      capturedAuth = req.headers.authorization;
      capturedUrl = req.url ?? '';

      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          binaryChunks.push(Buffer.from(data as Buffer));
          ws.send(
            JSON.stringify({
              type: 'Results',
              is_final: false,
              channel: { alternatives: [{ transcript: 'Hello', confidence: 0.8 }] },
            })
          );
        } else {
          const msg = JSON.parse(data.toString('utf8')) as Record<string, unknown>;
          controlMessages.push(msg);
          if (msg.type === 'Finalize') {
            ws.send(
              JSON.stringify({
                type: 'Results',
                is_final: true,
                speech_final: true,
                channel: { alternatives: [{ transcript: 'Hello world', confidence: 0.99 }] },
              })
            );
          }
        }
      });
    });

    const provider = new DeepgramStreamProvider(mock.url);
    const transcripts: Array<{ text: string; isFinal: boolean }> = [];

    await new Promise<void>((resolve, reject) => {
      provider.connect(
        { language: 'en-IN', sampleRate: 16000, provider: 'deepgram' },
        {
          onReady: () => {
            provider.sendAudioChunk(Buffer.from([10, 20, 30, 40]));
            resolve();
          },
          onTranscript: (t) => transcripts.push({ text: t.text, isFinal: t.isFinal }),
          onError: (e) => reject(new Error(e.message)),
          onClose: () => {},
        }
      );
    });

    // Advance 5000ms to verify 5s KeepAlive interval
    await vi.advanceTimersByTimeAsync(5100);
    provider.flush();
    await vi.advanceTimersByTimeAsync(50);
    provider.close();
    await vi.advanceTimersByTimeAsync(50);

    expect(capturedAuth).toBe('Token test-deepgram-key');
    expect(capturedUrl).toContain('encoding=linear16');
    expect(capturedUrl).toContain('interim_results=true');
    expect(capturedUrl).toContain('sample_rate=16000');
    expect(binaryChunks).toHaveLength(1);
    expect(controlMessages.some((m) => m.type === 'KeepAlive')).toBe(true);
    expect(controlMessages.some((m) => m.type === 'Finalize')).toBe(true);
    expect(controlMessages.some((m) => m.type === 'CloseStream')).toBe(true);
    expect(transcripts).toEqual([
      { text: 'Hello', isFinal: false },
      { text: 'Hello world', isFinal: true },
    ]);
  });
});
