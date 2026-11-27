# OpenTalk Phase 2 — System Architecture & Local-First ASR Research

> **Copyright (c) 2026. All rights reserved.**
> Proprietary source code.

---

## 1. Phase 2 Strategic Objective
The strategic objective of OpenTalk Phase 2 is to achieve **Local-First Speech Recognition** directly on the user's client hardware, without routing microphone audio to Sarvam AI, Deepgram, Wispr, or any external cloud service.

---

## 2. Local Inference Engine Evaluation Matrix

Three primary local runtime options were evaluated for in-browser client execution:

| Engine | Runtime & Packaging | Model Formats | Indian English, Hindi & Telugu | Model Sizes | Memory & CPU Footprint | Browser Compatibility | Phase 2 Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`@huggingface/transformers` (Transformers.js v3)** | Dedicated Web Worker + ONNX Runtime Web WASM/WebGPU | ONNX quantized (`q8` / `uint8`) | `whisper-tiny` & `whisper-base` multilingual models natively support English, Hindi (`hi-IN`), and Telugu (`te-IN`) | Tiny: ~42 MB<br>Base: ~78 MB | ~150–250 MB RAM; standard multi-core CPU WASM | Chrome, Edge, Firefox, Safari (zero COOP/COEP header requirement) | **Selected & Implemented** |
| **`whisper.cpp` (WASM)** | Custom Emscripten compilation + WebAssembly | GGML / GGUF | Strong English; multilang models support Hindi and Telugu | Tiny: ~75 MB<br>Base: ~145 MB | ~180–320 MB RAM; multi-threading requires `SharedArrayBuffer` | Requires COOP/COEP headers which break embedded iframes and third-party resources | Ruled out due to header & deployment restrictions |
| **`sherpa-onnx` (WASM)** | Custom C++ WASM bindings | ONNX (Zipformer / Conformer) | Requires disparate per-language acoustic models (separate Hindi/Telugu packs) | ~50–120 MB per language pack | ~120–200 MB RAM | Requires manual asset management and separate language switching pipelines | Ruled out for unified multilingual conversational needs |

---

## 3. Implemented Phase 2 Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│ OpenTalk Client (React 18 + Vite + Tailwind CSS)                       │
│                                                                        │
│ ┌──────────────────────┐        ┌───────────────────────────────────┐  │
│ │ Accessible UI        │◄──────►│ Local Conversation Engine         │  │
│ │ - Local Model Mgr    │        │ conversationReducer.ts            │  │
│ │ - Mode Switcher      │        │ + TTS Echo Suppression (350ms)    │  │
│ └──────────────────────┘        └─────────────────┬─────────────────┘  │
│                                                   │                    │
│                                      ┌────────────▼──────────────┐     │
│                                      │ AsrProvider Interface     │     │
│                                      └────────────┬──────────────┘     │
│                     ┌─────────────────────────────┼────────────────┐   │
│                     │                             │                │   │
│         ┌───────────▼─────────────┐   ┌───────────▼──────────┐ ┌───▼───┐
│         │ LocalWhisperAsrProvider │   │ CloudProxyAsrProvider│ │WebSp..│
│         │ (100% On-Device, Offline│   │ (Sarvam / Deepgram)  │ │(Fallb)│
│         └───────────┬─────────────┘   └──────────────────────┘ └───────┘
│                     │                                                  │
│   ┌─────────────────▼──────────────────┐                               │
│   │ AudioWorklet: pcm-capture-processor│                               │
│   │ (16 kHz mono Float32 off-thread)   │                               │
│   └─────────────────┬──────────────────┘                               │
│                     │ postMessage(Float32Array)                        │
│   ┌─────────────────▼──────────────────┐                               │
│   │ Web Worker: localAsr.worker.ts     │                               │
│   │ Transformers.js v3 + ONNX Runtime  │                               │
│   │ Quantized Whisper (Tiny / Base)    │                               │
│   └─────────────────┬──────────────────┘                               │
│                     │                                                  │
│   ┌─────────────────▼──────────────────┐                               │
│   │ Browser Cache Storage              │                               │
│   │ (Transparent, deletable models)    │                               │
│   └────────────────────────────────────┘                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Architectural Safeguards
1. **Explicit Model Download:** Models are never downloaded implicitly in the background. Users must tap **Download** in Settings, where a live progress bar displays downloaded megabytes and percentages.
2. **Zero Audio Exfiltration:** When `local-whisper` is active, the WebSocket proxy to the backend is not contacted. All audio processing stays in worker memory and is immediately garbage-collected after transcription.
3. **Model Deletion & Storage Transparency:** Users can delete cached models at any time with a single tap in Settings via `LocalWhisperAsrProvider.deleteModelCache()`.
4. **Three Distinct Execution Modes:**
   - **Local ASR:** 100% on-device Whisper, offline capable.
   - **Browser Speech Fallback:** Native browser SpeechRecognition (typically Google/Chromium cloud).
   - **Cloud ASR:** Sarvam AI / Deepgram streaming via secure Node.js backend.
