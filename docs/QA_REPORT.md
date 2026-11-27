# OpenTalk — QA, Verification & Stabilisation Report

> **Copyright (c) 2026. All rights reserved.**
> Proprietary source code.

---

## 1. Executive Summary
This QA pass audited the OpenTalk Phase 1 repository (`main` at `21e46c1e55d71f702b6fe5b357989d2932ae5f8b`) on branch `qa/hardening-nov2026`. Critical gaps in the Sarvam AI WebSocket protocol, WebSocket origin/proxy/auth security, and automated test coverage were resolved and verified with Vitest unit/integration suites and headless Edge Playwright checks. Docker Compose runtime verification and live cloud ASR tests remain blocked/unverified in this environment due to the absence of Docker Desktop and live provider API keys.

## 2. Exact Git Commit Tested
- **Base `main` Commit:** `21e46c1e55d71f702b6fe5b357989d2932ae5f8b`
- **QA Branch:** `qa/hardening-nov2026`

## 3. Machine & Toolchain Versions
- **OS:** Windows
- **Node.js:** `v22.20.0`
- **npm:** `10.9.3`
- **Docker / Docker Compose:** Not installed (`docker` not in PATH; `C:\Program Files\Docker\Docker\resources\bin\docker.exe` absent)
- **Playwright:** `1.65.1` (with Microsoft Edge headless)
- **Vitest:** `5.1.2`

## 4. Test Inventory
| Suite | Scope | Type | Outcome |
| :--- | :--- | :--- | :--- |
| `server/src/__tests__/providers.test.ts` | Sarvam Realtime WS & Deepgram WS | Mock WebSocket | **PASS (3/3)** |
| `server/src/__tests__/security.test.ts` | Health, Origin, Auth, Proxy IP, Limits, Malformed JSON | Integration | **PASS (7/7)** |
| `client/src/engine/__tests__/conversationReducer.test.ts` | Reducer state machine, TTS echo guard, pause, error | Unit | **PASS (6/6)** |
| Playwright Headless Edge (`browser_qa.mjs`) | No-key startup, Settings, Replies, Talk, History, 180° toggle | Browser E2E | **PASS (11/11)** |
| Docker Compose (`docker compose up --build`) | Container build & Nginx/Node proxy | Container Runtime | **BLOCKED** (Docker not installed) |
| Live Sarvam / Deepgram & Real Mic/TTS | End-to-end acoustic & cloud key streaming | Manual / Live Key | **BLOCKED** (No API keys / headless) |

## 5. Commands Executed & 6. Actual Results
1. `cd server ; npm ci ; npm run typecheck ; npm run build ; npm audit` — **Exit 0** (`0 vulnerabilities`, clean build).
2. `cd client ; npm ci ; npm run typecheck ; npm run build ; npm audit` — **Exit 0** (`0 vulnerabilities`, `dist/assets/index-C8DPyoAn.js` built).
3. `cd server ; npm test ; npm run typecheck ; npm run build` — **Exit 0** (`2 test files, 8 tests passed`).
4. `cd client ; npm test ; npm run typecheck ; npm run build` — **Exit 0** (`1 test file, 6 tests passed`).
5. `docker --version ; docker compose version` — **Exit 1** (`docker` command not found).

## 7. Unit-Test Results
- `client/src/engine/__tests__/conversationReducer.test.ts`: **6/6 passed** (`createInitialConversationState`, `idle -> starting -> listening -> paused -> listening -> ended`, `TTS_PLAYBACK_STARTED` echo guard dropping late partial/final captions, manual pause surviving TTS playback, reconnecting & error recovery, rotated view & VAD flag).

## 8. Integration-Test Results
- `server/src/__tests__/security.test.ts`: **6/6 passed**:
  - `/api/health` and `/api/providers` report `cloudAsrConfigured: false` when unconfigured.
  - Missing `Origin` and disallowed `Origin` rejected with HTTP `403`; configured `Origin` accepted.
  - `WS_AUTH_TOKEN` enforced via `Sec-WebSocket-Protocol: opentalk-token.<token>` or `?token=`; unauthorized rejected with HTTP `401`.
  - `maxSessionsPerIp` enforced and spoofed `X-Forwarded-For` ignored when `trustProxy: false`.
  - `X-Real-IP` honoured when `trustProxy: true` (for Nginx reverse proxy).
  - Malformed JSON returns `INVALID_MESSAGE`, `ping` returns `pong`, unconfigured `start` returns `PROVIDER_UNCONFIGURED`.

## 9. Docker Build & Runtime Evidence
- **Status:** **BLOCKED** — Docker Engine is not installed on this Windows host.
- **Static Fixes Applied:** `docker-compose.yml` now passes `WS_AUTH_TOKEN`, `MAX_CONCURRENT_SESSIONS`, `MAX_SESSIONS_PER_IP`, `TRUST_PROXY=true`, and `WS_ALLOW_NO_ORIGIN=false`; `client/nginx.conf` now forwards `X-Forwarded-For` on `/ws/`.
- **Owner Reproduction Command:**
  ```powershell
  docker compose config
  docker compose up --build -d
  docker compose ps
  ```

## 10. Browser Verification Summary
- Headless Microsoft Edge (`--use-fake-ui-for-media-stream`) against `http://localhost:5173` and `http://localhost:4000`:
  - **PASS (11/11):** Servers startup without API keys; Home screen renders without API keys; `opentalk:v1:history` is `null` by default; Browser Speech Fallback selectable in Settings; High-Contrast toggle works; Template creation works; Typed reply submission & message rendering works; Quick reply submission works; 180° two-person view toggle works; History page navigation works; zero uncaught `pageerror` events.

## 11. Sarvam & Deepgram Test Evidence
- **Sarvam AI (`server/src/providers/sarvam.ts`) [Mock WS Verified]:**
  - Migrated from legacy `wss://api.sarvam.ai/speech-to-text/ws` to **`wss://api.sarvam.ai/speech-to-text-realtime/ws`**.
  - Verified `Api-Subscription-Key` header, `language_code`, `model=saaras:v4`, `encoding=linear16`, `sample_rate=16000`, `{"event":"audio_input","audio":"<base64>"}`, `{"event":"flush"}`, `session.begin`, `transcript.partial` (`isFinal: false`), `transcript.final` (`isFinal: true`), `vad.speech_start`, and `vad.speech_end`.
- **Deepgram (`server/src/providers/deepgram.ts`) [Mock WS Verified]:**
  - Verified `Authorization: Token` header, `encoding=linear16`, `interim_results=true`, `5000ms` `KeepAlive` timer (via Vitest fake timers), `Finalize`, `CloseStream`, and interim/final `Results`.
- **Live Cloud Verification:** **Not executed** (no `SARVAM_API_KEY` or `DEEPGRAM_API_KEY` present).

## 12. Security Findings & Fixes
1. **Missing `Origin` header allowed on WS upgrade:** Fixed in `server/src/index.ts` — missing `Origin` is now rejected with `403` unless `WS_ALLOW_NO_ORIGIN=true`.
2. **Spoofable `X-Forwarded-For`:** Fixed in `server/src/index.ts` & `server/src/config.ts` — `X-Real-IP` / `X-Forwarded-For` are only trusted when `TRUST_PROXY=true`.
3. **Browser-compatible `WS_AUTH_TOKEN`:** Added `Sec-WebSocket-Protocol` (`opentalk-token.<token>`) support in both `server/src/index.ts` and `client/src/services/asr/CloudProxyAsrProvider.ts`.
4. **Docker Compose & Nginx proxy alignment:** Updated `docker-compose.yml` to pass all security env vars with `TRUST_PROXY=true`, and `client/nginx.conf` to set `X-Forwarded-For` on `/ws/`.
5. **Client bundle secret scan:** Verified `client/dist/assets/*.js` contains zero API key secrets.

## 13. Remaining Issues & Blockers
- Docker Compose build/runtime verification requires a host with Docker Desktop / Docker Engine.
- Live Sarvam AI and Deepgram streaming require real API keys in `.env`.
- Real microphone + acoustic TTS echo-suppression verification requires manual testing in Chrome/Edge.

## 14. Final Readiness Assessment
**Ready for owner Docker & live-key acceptance testing.** All TypeScript builds, unit tests, mock provider protocol tests, and WebSocket security integration tests pass with zero npm audit vulnerabilities.
