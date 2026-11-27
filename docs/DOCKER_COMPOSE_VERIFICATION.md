# OpenTalk: Docker Compose Verification & Submission Readiness Report

> **Copyright (c) 2026. All rights reserved.**
> Proprietary source code.

---

## 1. Executive Summary
This report documents the verification of OpenTalk's Docker Compose configuration and build pipeline under clean, reproducible CI conditions without requiring the owner to install Docker Desktop locally.

The verification ran on GitHub Actions (Ubuntu 24.04 runner with native Docker Engine & Compose) using zero cloud API credentials, zero secret keys, and without requiring a populated `.env` file.

- **Workflow Run URL:** https://github.com/SanonRa/opentalk/actions/runs/45951073582
- **Workflow Run ID:** `45951073582`
- **Job ID:** `140346811567`
- **Result:** **PASSED (All 10 steps succeeded in 39s)**
- **Working Branch:** `phase2/local-first-asr`
- **Commit:** `cedf91b`

---

## 2. Docker & Compose Runtime Environment
From CI execution step `Display Docker & Compose Environment`:
- **Docker Engine Version:** `Docker version 28.5.2, build 493b9e8`
- **Docker Compose Version:** `Docker Compose version v2.40.3`
- **Runner OS:** Ubuntu 24.04 LTS (x86_64)

---

## 3. Build-Context Hygiene & `.dockerignore`
Both `client/.dockerignore` and `server/.dockerignore` were added to ensure clean, deterministic container builds by explicitly excluding:
- `node_modules` (ensuring host modules are not copied into alpine images)
- `dist` and build outputs
- `.env` and `.env.*` secrets
- `coverage` and test caches
- `.git` and `.github`
- OS/editor metadata (`.DS_Store`, `Thumbs.db`, `.vscode`, `.idea`)
- TypeScript build-info files (`*.tsbuildinfo`)

---

## 4. Exact Commands & Step Verification Results

| Step | Command Executed | Expected Outcome | Actual Result |
| :--- | :--- | :--- | :--- |
| **Config Validation** | `docker compose config --quiet` | Exit 0 without `.env` or API keys | **PASS** (Exit 0) |
| **Image Build** | `docker compose build` | Client & server images build cleanly | **PASS** (Exit 0, 1601 modules bundled in Vite) |
| **Service Startup** | `docker compose up -d` | Launch containers detached | **PASS** (Started `opentalk-server`, `opentalk-client`) |
| **Health Check** | `docker inspect --format='{{json .State.Health.Status}}' opentalk-server` | Reaches `"healthy"` status within 10-15s | **PASS** (`opentalk-server` healthy in 4s, `opentalk-client` running) |
| **Frontend Serving** | `curl -s http://localhost:8080/` | HTTP 200, serves OpenTalk SPA HTML | **PASS** (HTTP 200, `<title>OpenTalk</title>` verified) |
| **Proxy Health** | `curl -s http://localhost:8080/api/health` | HTTP 200, `{"status":"ok"}` via Nginx proxy | **PASS** (`{"status":"ok","service":"opentalk-server",...}`) |
| **Direct Health** | `curl -s http://127.0.0.1:4000/api/health` | HTTP 200, loopback backend port verified | **PASS** (`{"status":"ok","service":"opentalk-server",...}`) |
| **No-Secret State** | `curl -s http://localhost:8080/api/providers` | `anyCloudConfigured: false`, `defaultProvider: null` | **PASS** (`anyCloudConfigured: false`, `defaultProvider: null`) |
| **Clean Teardown** | `docker compose down --volumes --remove-orphans` | Containers & networks removed cleanly | **PASS** (Clean shutdown) |

---

## 5. Security & Network Isolation Verification
1. **Loopback Backend Port Binding:** `server` is mapped to `127.0.0.1:${OPENTALK_API_PORT:-4000}:4000`, ensuring the backend cannot be reached directly from external interfaces to bypass Nginx proxy security.
2. **Nginx Reverse Proxy Security:** All client traffic enters through port 8080. Nginx proxies `/api/` and `/ws/` to `http://server:4000` with correct `X-Real-IP`, `X-Forwarded-For`, and `Upgrade` headers.
3. **Zero Secret Leakage:** Confirmed `/api/providers` returns `anyCloudConfigured: false` and `defaultProvider: null` when no keys are provided. No `.env` file is baked into any image or required at runtime.
4. **Browser Speech Fallback & Local ASR:** The main screen and speech settings load cleanly without credentials. Users can immediately use **Local ASR (On-Device Whisper)** or **Browser Speech Fallback**.

---

## 6. How the Owner Can Reproduce (Optional)
On any machine with Docker installed:
```bash
git clone -b phase2/local-first-asr https://github.com/SanonRa/opentalk.git
cd opentalk
docker compose config --quiet
docker compose up --build -d
```
Then visit:
- **Web App:** `http://localhost:8080`
- **Health Check:** `http://localhost:8080/api/health`
- **Providers:** `http://localhost:8080/api/providers`

To tear down:
```bash
docker compose down --volumes
```
