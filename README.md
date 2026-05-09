# Rorschach Bot

> **What do you see?** A multi-provider AI hub with a Rorschach inkblot identity — talk to OpenAI, Claude, Gemini, Grok, Mistral, DeepSeek, Llama, or your own local Ollama / LM Studio / vLLM box from a single interface.

Each provider is a "plate" — its own symmetrical inkblot — and routes can fall back from one plate to the next when budget, latency, or refusals demand it.

---

## Status

Pre-release. The design system is in place; the runtime is being wired in.

- ✅ UI / design system
- ⏳ Provider adapters
- ⏳ Routing engine
- ⏳ Local server discovery
- ⏳ Persistence

---

## Supported providers

| Plate | Provider | Endpoint | Models |
| --- | --- | --- | --- |
| I | **OpenAI** | `api.openai.com` | gpt-4o, gpt-4o-mini, o1, o3-mini |
| II | **Anthropic** | `api.anthropic.com` | claude-haiku-4-5, claude-sonnet-4-5, claude-opus-4-1 |
| III | **Google Gemini** | `generativelanguage.googleapis.com` | gemini-2.5-pro, gemini-2.5-flash |
| IV | **xAI Grok** | `api.x.ai` | grok-4, grok-4-mini |
| V | **Mistral** | `api.mistral.ai` | mistral-large-2, codestral, ministral |
| VI | **DeepSeek** | `api.deepseek.com` | deepseek-v3.2, deepseek-r1 |
| VII | **Llama (Together)** | `api.together.xyz` | llama-3.3-70b, llama-3.1-405b |
| VIII | **Ollama** (local) | `localhost:11434` | any pulled model |
| IX | **LM Studio** (local) | `localhost:1234` | any loaded model |
| X | **Custom** | any OpenAI-compatible URL | — |

All hosted providers speak their native API; local servers are accessed through their OpenAI-compatible endpoints. Adding a new provider is a single adapter file under `src/providers/`.

---

## The five screens

The app is organised as a clinical session — five rooms in one building.

| Screen | Path | What it does |
| --- | --- | --- |
| **The Plates** | `/` | Grid of all 10 providers as inkblot cards; live status, latency, cost. Tap to set the default. |
| **The Couch** | `/chat` | The conversation. Switch the active model mid-thread; every reply is signed by the plate that produced it. |
| **The Diagnosis** | `/routes` | Routing rules + fallback chains (cheap-first, hard-reasoning, code, air-gapped, etc). |
| **The Notes** | `/usage` | Tokens, spend, refusals, latency. Per-day chart, per-provider share. |
| **The Vault** | `/keys` | API key management for hosted providers; auto-discovery for local servers; custom endpoint form. |

---

## Architecture

```
┌──────────────────────────────────────────────┐
│  UI (React)                                  │
└──────────────────────────────────────────────┘
                    │
┌──────────────────────────────────────────────┐
│  Router         (rule engine + fallback)     │
└──────────────────────────────────────────────┘
                    │
┌─────────┬─────────┬─────────┬─────────┬──────┐
│ OpenAI  │ Claude  │ Gemini  │ Grok    │ ...  │
└─────────┴─────────┴─────────┴─────────┴──────┘
                    │
┌─────────────┬────────────────┬───────────────┐
│ Ollama      │ LM Studio      │ Custom (vLLM) │
└─────────────┴────────────────┴───────────────┘
```

### Adapter contract

Every provider implements the same minimal interface:

```ts
interface ProviderAdapter {
  id: string;
  list(): Promise<ModelInfo[]>;
  stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<Chunk>;
  estimate(req: ChatRequest): { tokens: number; usd: number };
  health(): Promise<{ ok: boolean; latencyMs?: number }>;
}
```

### Routing rules

A route has a name, a condition, and an ordered fallback chain. The router evaluates the condition first, then walks the chain — moving on if a plate refuses, errors, or exceeds its budget.

```yaml
- name: Default
  cond: "*"
  chain: [anthropic, openai, gemini]

- name: Cheap & Fast
  cond: "tokens.estimate < 4000 AND latency.p50 < 600"
  chain: [gemini, deepseek, mistral]

- name: Air-Gapped
  cond: "data.classification == 'sensitive'"
  chain: [ollama, lmstudio]
```

---

## Local servers

Local providers are auto-discovered by scanning common ports on `localhost` and `*.local`:

- `:11434` Ollama
- `:1234` LM Studio
- `:8080` Llama.cpp default
- `:5000` text-generation-webui
- `:8000` vLLM default

Anything that responds to `GET /v1/models` is treated as an OpenAI-compatible endpoint and offered as a candidate adapter.

### Windows 11 GPU node (RTX 4090)

The voice pipeline runs against a dedicated Windows 11 machine with an RTX 4090. Three services are hosted there:

| Service | Port | Notes |
|---|---|---|
| **Ollama** | `11434` | LLM inference — any pulled model |
| **Whisper** | `8765` | OpenAI-compatible STT via faster-whisper-server |
| **Chatterbox** | `8123` | TTS voice synthesis, voice-cloning via reference audio |

Connect via [Tailscale](https://tailscale.com) hostname or IP. Point the voice pipeline at the Windows 11 node by setting `whisperUrl`, `ollamaUrl`, and `ttsUrl` in the Tweaks panel to the Tailscale address (e.g. `http://windows-11:11434`).

Reference audio files for Chatterbox voice cloning live in `voice-ref/`.

---

## Configuration

API keys are stored encrypted at rest. The hub reads from environment variables on first boot:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
export GOOGLE_API_KEY="AIza..."
export XAI_API_KEY="xai-..."
export MISTRAL_API_KEY="..."
export DEEPSEEK_API_KEY="..."
export TOGETHER_API_KEY="..."
```

…or you add them through **The Vault** at runtime.

---

## Design

The interface is parchment + ink — a Rorschach test, not a chat app. Cormorant Garamond for display, IBM Plex Sans for body, IBM Plex Mono for technical detail. One vermillion accent (the classic Plate II red).

Open `Inkblot Agent.html` in a browser to view the prototype. Toggle the **Tweaks** panel to switch theme (Paper / Midnight), density (Compact / Default / Roomy), and accent palette (Vermillion / Indigo / Moss / Amber).

---

## License

MIT.
