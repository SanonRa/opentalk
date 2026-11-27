# OpenTalk — Phase 1 Prototype

> **Copyright (c) 2026. All rights reserved.**
> Proprietary source code. Not licensed under any open-source licence.

OpenTalk is a voice-first, two-way communication web application designed to make everyday face-to-face conversations between deaf or hard-of-hearing individuals and the general public more accessible.

---

## Core Interaction Loop

1. A hearing person speaks near the device.
2. OpenTalk streams the microphone audio to the selected speech-recognition provider and displays large, readable live captions.
3. The deaf or hard-of-hearing user reads the transcription (with optional 180° rotated two-person mode).
4. They type a reply or tap a saved quick-reply template.
5. OpenTalk pauses microphone capture (to prevent acoustic feedback), speaks the reply aloud via device-native `SpeechSynthesis`, and resumes listening once playback finishes.

---

## Quick Start with Docker Compose

OpenTalk starts and displays its complete interface **without requiring any secret API keys**.

```bash
# 1. Unzip and enter the project directory
cd opentalk

# 2. (Optional) Configure a cloud ASR key for streaming transcription
cp .env.example .env
# Edit .env and set SARVAM_API_KEY or DEEPGRAM_API_KEY

# 3. Build and start both frontend (Nginx/Vite) and backend (Node.js/WebSocket)
docker compose up --build
```

- **Web App:** `http://localhost:8080`
- **Backend Health Check:** `http://localhost:4000/api/health`
- **Provider Availability:** `http://localhost:4000/api/providers`

If no cloud API keys are configured in `.env`, the UI loads normally and clearly reports `Cloud ASR Unconfigured` when starting cloud transcription. You can also switch to the explicitly labelled **Browser Speech Fallback (Web Speech API)** in **Settings** for quick local prototyping in Chrome or Edge.

---

## Local Development (Without Docker)

Requires **Node.js 18.18+** (Node 20 LTS recommended).

```bash
# Terminal 1 — Backend WebSocket & REST gateway
cd server
npm install
npm run dev

# Terminal 2 — Frontend React + Vite + Tailwind app
cd client
npm install
npm run dev
```

- Frontend dev server: `http://localhost:5173` (proxies `/api` and `/ws` to `http://localhost:4000`).
- Lockfiles (`package-lock.json`) are generated automatically on the first `npm install` on a machine with npm registry access.

---

## Environment Configuration (`.env.example`)

Copy `.env.example` to `.env` to configure cloud speech-to-text providers. All API keys are read exclusively by the Node.js backend (`server/src/config.ts`) and are **never** exposed to the browser bundle.

| Variable | Required | Default | Purpose |
| :--- | :--- | :--- | :--- |
| `ASR_DEFAULT_PROVIDER` | No | `auto` | `auto` (Sarvam → Deepgram), `sarvam`, or `deepgram` |
| `SARVAM_API_KEY` | For Sarvam AI | *(empty)* | Subscription key for [Sarvam AI Streaming STT](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/streaming-api) |
| `SARVAM_STT_MODEL` | No | `saaras:v4` | Sarvam model (`saaras:v4` or `saaras:v3-realtime`) |
| `SARVAM_STT_MODE` | No | `transcribe` | `transcribe`, `translate`, `verbatim`, `translit`, or `codemix` |
| `DEEPGRAM_API_KEY` | For Deepgram | *(empty)* | API key for [Deepgram Streaming STT](https://developers.deepgram.com/docs/models-languages-overview) |
| `DEEPGRAM_STT_MODEL` | No | `nova-3` | Deepgram model (`nova-3` or `nova-2`) |
| `DEEPGRAM_ENDPOINTING_MS` | No | `400` | Silence window (ms) before finalizing an utterance |
| `OPENTALK_WEB_PORT` | No | `8080` | Host port mapped to the Nginx frontend container |
| `OPENTALK_API_PORT` | No | `4000` | Host port mapped to the Node.js backend container |

---

## Files & Components Requiring API Credentials

Only the backend reads API keys, and only when cloud ASR streaming is activated:

1. `.env` (created locally from `.env.example`) — stores `SARVAM_API_KEY` and/or `DEEPGRAM_API_KEY`.
2. `server/src/config.ts` — loads `SARVAM_API_KEY` and `DEEPGRAM_API_KEY` from environment variables.
3. `server/src/providers/sarvam.ts` — authenticates `wss://api.sarvam.ai/speech-to-text/ws` via the `api-subscription-key` header.
4. `server/src/providers/deepgram.ts` — authenticates `wss://api.deepgram.com/v1/listen` via the `Authorization: Token <key>` header.
5. `server/src/providers/registry.ts` — reports boolean `configured` flags to `/api/providers` (never returns key values).

---

## Implemented Features (Phase 1)

- **Provider-Independent ASR Abstraction** (`client/src/types/asr.ts`, `client/src/services/asr/`): supports `start`, `stop`, `pause`, `resume`, partial captions, final captions, connection state transitions, exponential backoff reconnection, and availability reporting.
- **Secure Backend Streaming Proxy** (`server/src/`): Express + `ws` gateway implementing real WebSocket adapters for **Sarvam AI (Saaras v4)** and **Deepgram (Nova-3)** with zero raw-audio persistence on disk.
- **Explicitly Labelled Browser Fallback** (`WebSpeechAsrProvider.ts`): Web Speech API adapter for Chromium-based prototyping when no cloud key is present.
- **Local Conversation Engine** (`conversationReducer.ts`, `ConversationContext.tsx`): predictable state machine handling sessions, listening/paused/speaking/reconnecting/error phases, quick replies, and a **TTS echo-suppression guard** (pauses mic capture during TTS playback + 350 ms post-speech decay buffer).
- **Accessible Mobile-First Interface**:
  - **Home Screen**: OpenTalk branding, Start Conversation CTA, language selector (`en-IN`, `hi-IN`, regional Indian languages, `en-US`, `en-GB`), recent activity, navigation to Templates and Settings, and Pro roadmap preview.
  - **Conversation Screen**: large live captions, unmistakable top microphone status banner, Start/Pause/Resume/Stop/Reconnect controls, inline caption style popover, scrollable transcript with TTS replay, text composer + quick-reply strip, and **180° rotatable two-person partner display**.
  - **Templates Screen**: create, edit, delete, and immediately speak templates; seeded with 5 everyday phrases (*Please speak slowly.*, *Could you repeat that?*, *I need assistance.*, *Please write that down.*, *Thank you.*).
  - **Settings Screen**: caption text size (`M`–`2XL`), interface text size (`Standard`–`Extra Large`), custom caption text & background colours + presets, High-Contrast Mode, Light/Dark themes, language & ASR provider selector, TTS voice/rate/pitch + Test Voice, and Privacy controls.
  - **Opt-In Local History**: disabled by default; text transcripts stored locally in `localStorage` only when explicitly saved or opted in, with individual and delete-all controls.
  - **Pro Placeholder**: non-transactional preview modal with zero billing or subscription code.

---

## Incomplete Features & Known Limitations

- **Runtime & Build Verification**: This archive was assembled in an offline sandbox without outbound npm registry or Docker daemon access. `npm install`, `tsc`, `vite build`, and `docker compose up --build` have **not** been executed in this environment; `package-lock.json` files will be generated when running `npm install` locally.
- **Audio Capture API**: `MicrophoneCapture.ts` uses `ScriptProcessorNode` for broad zero-bundler-config compatibility; migrating to `AudioWorkletNode` is recommended for Phase 2 to reduce main-thread audio jitter on low-end mobile devices.
- **Browser Speech Fallback Limitations**: `WebSpeechAsrProvider` depends on the browser's `SpeechRecognition` / `webkitSpeechRecognition` API (best supported in Chrome/Edge; unsupported in Firefox) and typically routes audio to the browser vendor's cloud servers, requiring an internet connection.
- **Cloud Provider Protocol Verification**: Both `SarvamStreamProvider` and `DeepgramStreamProvider` were implemented directly against their November 2026 official WebSocket documentation, but live audio round-trip testing requires valid developer API keys.
- **No Automated Test Suite Yet**: Unit tests for `conversationReducer` and integration tests for `TranscriptionSession` are planned for Phase 2.
- **No End-to-End Encryption or On-Device ASR**: When cloud ASR is active, live audio is streamed over TLS (`wss://`) to the configured cloud provider; OpenTalk does not claim on-device processing or end-to-end encryption for cloud streams.

---

## Privacy & Security Posture

- Explicit browser microphone permission requested only when the user taps **Start Listening**.
- Persistent, high-visibility microphone status banner (`MicStatusBanner.tsx`) whenever listening, paused, or speaking.
- No hidden background listening; all `MediaStream` tracks are stopped immediately on **Stop**.
- Zero raw-audio retention in browser storage or on the Node.js server.
- Optional text-only conversation history is off by default and stored solely in local browser storage when enabled.
- Cloud API credentials remain strictly server-side.

---

## Suggested Next Development Steps

1. Run `npm install` in both `server/` and `client/` to generate lockfiles and run `npm run typecheck` + `docker compose up --build`.
2. Obtain a free developer key from [Sarvam AI](https://www.sarvam.ai/apis/speech-to-text) or [Deepgram](https://deepgram.com/pricing) ($200 starter credit) and verify end-to-end streaming in Indian English (`en-IN`) and Hindi (`hi-IN`).
3. Upgrade `MicrophoneCapture.ts` from `ScriptProcessorNode` to an `AudioWorkletProcessor`.
4. Add Vitest unit tests for `conversationReducer.ts` (especially TTS echo-guard state transitions) and WebSocket integration tests for `TranscriptionSession.ts`.
5. Add PWA manifest and service worker support so OpenTalk can be installed on mobile home screens.
6. Explore WebRTC/WASM on-device Whisper or Sherpa-ONNX models for offline Phase 2 captioning.

---

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for full architecture diagrams, state machine documentation, and the cloud ASR provider research matrix.
