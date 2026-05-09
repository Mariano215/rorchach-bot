# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the app

No build step. No npm. No bundler.

Open `Inkblot Agent.html` directly in a browser:
```bash
open "Inkblot Agent.html"          # macOS
# or serve locally to avoid CORS on fetch() calls:
python3 -m http.server 8080
# then open http://localhost:8080/Inkblot%20Agent.html
```

Edit any `.jsx` or `.js` file, then hard-refresh (`Cmd+Shift+R`). Babel runs in-browser at runtime.

## Architecture

**Single-file app, no module system.** All scripts are loaded in `Inkblot Agent.html` in strict dependency order via `<script type="text/babel">`. Each file exposes its exports as `window` globals for the next file to consume.

Load order (and what each file exports to `window`):
1. `tweaks-panel.jsx` → `useTweaks`, `TweaksPanel`, `TweakSection`, `TweakRadio`, `TweakColor`, `TweakSlider`, `TweakNumber`, `TweakToggle`, `TweakButton`, `TweakRow`
2. `data.jsx` → `window.PROVIDERS`, `window.ROUTES`, `window.CONVERSATION`
3. `inkblots.jsx` → `window.ProviderBlot`, `window.BrandMark`, `window.HeroBlot`, `window.PROVIDER_BLOTS`
4. `screens.jsx` → `PlatesScreen`, `CouchScreen`, `DiagnosisScreen`, `NotesScreen`, `VaultScreen` (consumed directly by app.jsx, not on window)
5. `app.jsx` → mounts `<App />` into `#root`

**Routing is client-state only** — `app.jsx` uses a `route` string in `React.useState` mapped via a switch. No React Router. No URL changes.

**Theming** is driven by `data-theme`, `data-density`, `data-palette` attributes on `<html>`, toggled by the `useTweaks` hook. `styles.css` uses CSS custom properties keyed on those attributes.

## Files NOT loaded by `Inkblot Agent.html`

These are standalone prototype files, not wired into the main app yet:
- `voice.js` — full voice pipeline (Whisper STT → Ollama chat → Chatterbox TTS). Self-contained IIFE.
- `face.jsx` — animated waveform face driven by amplitude data from `voice.js`.
- `cards.js` — procedural bezier inkblot generator (alternative to the SVG ellipse approach in `inkblots.jsx`).

To wire voice into the app, `voice.js` must be loaded before `app.jsx` (no React dep, plain IIFE).

## Inkblot rendering

`inkblots.jsx` uses SVG `<feTurbulence>` + `<feDisplacementMap>` for organic distortion. Each provider has a hand-tuned `PROVIDER_BLOTS` entry with `seed`, `freq`, `scale`, and an `shapes` array of ellipses. The left half is rendered, clipped at x=101, then mirrored with `transform="translate(200,0) scale(-1,1)"` to guarantee bilateral symmetry.

Adding a new provider = add an entry to `PROVIDERS` in `data.jsx` and a matching key in `PROVIDER_BLOTS` in `inkblots.jsx`.

## Voice pipeline endpoints

`voice.js` expects these local services (configurable via Tweaks panel at runtime):

| Service | Default endpoint | Protocol |
|---|---|---|
| Whisper STT | `http://localhost:8765` | OpenAI-compatible POST `/v1/audio/transcriptions` |
| Ollama LLM | `http://localhost:11434` | Ollama POST `/api/chat` (streaming NDJSON) |
| Chatterbox TTS | `http://localhost:8123` | POST `/tts` → `audio/wav` blob |

**Local services run on Windows 11** (RTX 4090). Connect via Tailscale IP or hostname when developing from macOS. The `whisperUrl`, `ollamaUrl`, and `ttsUrl` config keys in `voice.js` accept any URL — point them at the Windows 11 Tailscale address.

Chatterbox voice-cloning fields (`audio_prompt_path`, `reference_audio`, `speaker_wav`) are all sent; the server ignores whichever it doesn't recognize. Reference audio files live in `voice-ref/`.

Mock mode (no local services): set `ttsUrl` to `"speech"` to fall back to Web Speech API end-to-end.

## Tweaks panel protocol

`tweaks-panel.jsx` owns an `__activate_edit_mode` / `__deactivate_edit_mode` postMessage protocol for external tooling. `TWEAK_DEFAULTS` in `app.jsx` is delimited by `/*EDITMODE-BEGIN*/` and `/*EDITMODE-END*/` comments — tooling that injects tweaks via postMessage parses and replaces that block.

## What's not built yet

Per `README.md` status section: provider adapters, routing engine, local server discovery, and persistence are all stubs. The UI is complete; the network layer is the next work surface.
