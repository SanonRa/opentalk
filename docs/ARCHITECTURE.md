# OpenTalk — System Architecture & ASR Research

> **Copyright (c) 2026. All rights reserved.**

---

## 1. High-Level Topology

OpenTalk separates the browser user interface and local conversation engine from cloud speech-recognition credentials via a lightweight Node.js WebSocket gateway.

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser Client (React + TypeScript + Vite + Tailwind CSS)         │
│                                                                    │
│  ┌─────────────────────┐      ┌─────────────────────────────────┐  │
│  │ Accessible GUI      │◄────►│ Local Conversation Engine       │  │
│  │ Home / Talk (180°)  │      │ conversationReducer.ts          │  │
│  │ Templates / History │      │ ConversationContext.tsx         │  │
│  │ Settings / Pro      │      │ + 350ms TTS Echo-Guard          │  │
│  └─────────────────────┘      └──────────┬──────────────┬───────┘  │
│                                          │              │          │
│                           ┌──────────────▼──┐    ┌──────▼───────┐  │
│                           │ AsrProvider     │    │ SpeechSynth  │  │
│                           │ Abstraction     │    │ TTS Service  │  │
│                           └─┬─────────────┬─┘    └──────────────┘  │
│                             │             │                        │
│               ┌─────────────▼──┐   ┌──────▼────────────────┐       │
│               │ CloudProxy     │   │ WebSpeechAsrProvider  │       │
│               │ AsrProvider    │   │ (Explicit Fallback)   │       │
│               │ (16kHz PCM16)  │   └───────────────────────┘       │
│               └───────┬────────┘                                   │
└───────────────────────┼────────────────────────────────────────────┘
                        │ WSS /ws/transcribe (binary PCM16 + JSON)
                        │ REST /api/providers, /api/health
┌───────────────────────▼────────────────────────────────────────────┐
│  Nginx Reverse Proxy (client container, port 8080 -> 80)           │
└───────────────────────┬────────────────────────────────────────────┘
                        │ Internal Docker network (server:4000)
┌───────────────────────▼────────────────────────────────────────────┐
│  Node.js + TypeScript Backend (server container, port 4000)        │
│                                                                    │
│  TranscriptionSession (in-memory only; zero disk audio retention)  │
│           │                                                        │
│  ServerAsrStreamProvider Interface (providers/base.ts)             │
│     ├── SarvamStreamProvider  (wss://api.sarvam.ai/...)            │
│     └── DeepgramStreamProvider (wss://api.deepgram.com/v1/listen)  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Cloud ASR Provider Evaluation

Official documentation was evaluated with priority on **real-time streaming**, **Indian English (`en-IN`) and Hindi (`hi-IN`)**, **latency**, **pricing**, and **developer accessibility**.

> **Note on Wispr Flow:** Wispr Flow's private developer API is not available for runtime integration and is **not** used as OpenTalk's speech-recognition engine.

| Provider | Streaming Protocol | Indian English & Hindi | Latency & VAD | Pricing (Reference) | Developer Accessibility | Phase 1 Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **[Sarvam AI (Saaras v4)](https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/streaming-api)** | Native WebSocket (`wss://api.sarvam.ai/speech-to-text/ws`) | Strongest Indic focus: `en-IN`, `hi-IN`, 22 Indian languages + native `codemix` (Hinglish) mode | Millisecond streaming with configurable `high_vad_sensitivity` (~64 ms silence boundary at 16 kHz) & `START_SPEECH`/`END_SPEECH` signals | INR pay-as-you-go ([Sarvam API Pricing](https://www.sarvam.ai/api-pricing)); ~₹30/hr STT | Simple `api-subscription-key` header; raw WebSocket works cleanly in Node.js | **Implemented** (`server/src/providers/sarvam.ts`) |
| **[Deepgram (Nova-3)](https://developers.deepgram.com/docs/models-languages-overview)** | Native WebSocket (`wss://api.deepgram.com/v1/listen`) | Supports `en-IN` and `hi` with interim results & smart punctuation | Sub-300 ms streaming with configurable `endpointing` & `KeepAlive` frames | Pay-as-you-go ~$0.0077/min for Nova-3 streaming; **$200 free starter credit** ([Deepgram Pricing](https://deepgram.com/pricing)) | Single `Authorization: Token` header; raw binary PCM16 frames | **Implemented** (`server/src/providers/deepgram.ts`) |
| **[Google Cloud Speech-to-Text V2](https://docs.cloud.google.com/speech-to-text/docs/streaming-recognize)** | Bidirectional **gRPC only** (no native raw WebSocket) | Broad `en-IN` and `hi-IN` coverage via Chirp 2 / Chirp 3 models | Low-latency gRPC streaming; requires GCP IAM & service account | $300 free trial credits; standard per-minute tiers ([GCP STT Pricing](https://cloud.google.com/speech-to-text/pricing)) | Higher setup friction (GCP project, IAM, gRPC client) | Candidate for Phase 2 adapter |
| **[Azure AI Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-to-text)** | Real-time SDK / WebSocket | Supports `en-IN` and `hi-IN` ([Azure Language Support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support)) | Real-time streaming with continuous recognition | Pay-as-you-go + free tier hours ([Azure Speech Pricing](https://azure.microsoft.com/en-us/pricing/details/speech/)) | Requires Azure subscription, region & Speech resource provisioning | Candidate for Phase 2 adapter |

### Architectural Decision
Phase 1 ships with **both Sarvam AI and Deepgram** implemented behind `ServerAsrStreamProvider`, with `ASR_DEFAULT_PROVIDER=auto` preferring Sarvam AI (when `SARVAM_API_KEY` is present) for Indian English, Hindi, and Hinglish conversations, and falling back to Deepgram (when `DEEPGRAM_API_KEY` is present). Adding Google Cloud STT or Azure AI Speech later requires only adding one file under `server/src/providers/` and registering it in `registry.ts`.

---

## 3. ASR Provider Abstraction

### Client-Side Contract (`client/src/types/asr.ts`)
`AsrProvider` isolates the Conversation Engine from transport details:

- `checkAvailability()` — queries `/api/providers` (cloud) or browser feature detection (fallback) without requesting microphone permission.
- `start(config, listeners)` — begins capture and emits partial/final transcripts, VAD signals, connection states, and structured errors.
- `pause()` / `resume()` — mutes microphone tracks and pauses upstream transmission without tearing down the session.
- `stop()` — closes WebSocket/recognition sessions and releases all `MediaStreamTrack` hardware handles.
- `reconnect()` — restores dropped streams with exponential backoff (up to 4 attempts on transient network errors; never auto-retries `401`/`403` auth errors or `PROVIDER_UNCONFIGURED`).

### Explicitly Labelled Browser Fallback (`WebSpeechAsrProvider.ts`)
- Exposed as **Browser Speech Fallback (Web Speech API)** in Settings and as a one-tap option in the unconfigured-provider alert.
- **Compatibility:** Works best in Chromium-based browsers (Chrome, Edge); unsupported in Firefox and restricted in some mobile webviews.
- **Connectivity & Privacy:** Most browsers send audio to vendor cloud servers for `SpeechRecognition`; OpenTalk explicitly warns users that this fallback typically requires internet connectivity and is not guaranteed to be offline.

---

## 4. Local Conversation Engine & TTS Echo Suppression

State transitions are managed deterministically by `conversationReducer.ts` and coordinated by `ConversationContext.tsx`.

### Session Phases
`idle` → `starting` → `listening` ↔ `paused` / `speaking_tts` / `reconnecting` → `ended` (or `error`)

### Preventing Microphone–TTS Feedback Loops
When the deaf/hard-of-hearing user sends a typed reply or taps a quick-reply template while live captioning is active:

1. `speakMessageAloud()` checks if the engine is in `listening` phase.
2. It immediately calls `providerRef.current.pause()` (which mutes `MediaStreamTrack` audio tracks and stops forwarding PCM frames) and dispatches `TTS_PLAYBACK_STARTED` (`ttsEchoGuardActive = true`, `phase = 'speaking_tts'`).
3. `conversationReducer` drops any late in-flight partial/final captions while `ttsEchoGuardActive` is `true`.
4. `SpeechSynthesisService` speaks the utterance aloud.
5. On `utterance.onend` (or `onerror`), OpenTalk waits **350 ms** (`TTS_ECHO_DECAY_MS`) so room acoustics and speaker tail decay before dispatching `TTS_PLAYBACK_ENDED` and resuming `providerRef.current.resume()`.
6. If the user had manually paused listening prior to speaking, the engine remains paused after TTS completes (`phaseBeforeTts === 'paused'`).

---

## 5. Privacy & Data Lifecycle

- **Raw Audio:** Never written to disk, `localStorage`, or `IndexedDB` on either client or server. On the Node.js gateway, binary PCM buffers are forwarded immediately to the upstream WebSocket and garbage-collected.
- **Conversation History:** Strictly opt-in (`privacy.allowHistorySaving: false` by default). Saved transcripts contain text, role, timestamp, and language code only, stored locally in `localStorage` under `opentalk:v1:history`, with per-session and delete-all controls.
- **Credentials:** Stored only in server environment variables; `/api/providers` exposes only boolean `configured` status.
