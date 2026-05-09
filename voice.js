// voice.js — voice pipeline.
//
// Wires together: mic capture → VAD → STT (Whisper) → LLM (Ollama) →
// TTS (Chatterbox) → playback. Exposes amplitude streams for the face.
// Also provides a Mock Mode that uses browser Web Speech API end-to-end
// so the prototype is testable without any local services running.
//
// Public API:
//   const pipe = createPipeline({ onState, onUserText, onAgentText,
//                                 onSubtitle, onAmplitude, onError });
//   pipe.updateConfig(tweaks);
//   pipe.startListening();   // VAD or PTT trigger
//   pipe.stopListening();
//   pipe.interrupt();        // stop TTS midstream (barge-in)
//   pipe.dispose();

(function () {
  // ────────────────────────────────────────────────────────────────────────
  // Audio: mic capture + amplitude analyser + simple VAD.
  // ────────────────────────────────────────────────────────────────────────

  async function getMicStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia not available — open over https:// or localhost.");
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (e) {
      // NotAllowedError = user denied or permissions-policy blocked it
      // (common when running inside a preview iframe without mic delegation).
      if (e.name === "NotAllowedError") {
        throw new Error("Mic blocked. Open this file in a new browser tab (the preview iframe can't get mic permission), then click the 🔒 lock icon → Allow microphone.");
      }
      if (e.name === "NotFoundError") {
        throw new Error("No microphone found on this device.");
      }
      throw e;
    }
  }

  function makeAnalyser(ctx, source) {
    const a = ctx.createAnalyser();
    a.fftSize = 1024;
    a.smoothingTimeConstant = 0.6;
    source.connect(a);
    return a;
  }

  // RMS amplitude in 0..1 from a time-domain analyser.
  function rms(analyser, buf) {
    analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / buf.length);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Recorder — captures user speech into a Blob until VAD says "done".
  // ────────────────────────────────────────────────────────────────────────

  function makeRecorder(stream) {
    const mr = new MediaRecorder(stream, { mimeType: pickMime() });
    const chunks = [];
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    return {
      mr,
      start() { chunks.length = 0; mr.start(); },
      async stop() {
        if (mr.state === "inactive") return null;
        return new Promise((res) => {
          mr.onstop = () => res(new Blob(chunks, { type: chunks[0]?.type || mr.mimeType }));
          mr.stop();
        });
      },
    };
  }

  function pickMime() {
    const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    for (const o of opts) if (MediaRecorder.isTypeSupported(o)) return o;
    return "";
  }

  // ────────────────────────────────────────────────────────────────────────
  // STT — OpenAI-compatible /v1/audio/transcriptions (faster-whisper-server,
  // whisper.cpp server, etc.). If your server differs, change the URL/format
  // in Tweaks → Endpoints.
  // ────────────────────────────────────────────────────────────────────────

  async function transcribe(blob, cfg) {
    if (!blob || !blob.size) return "";
    const fd = new FormData();
    fd.append("file", blob, "speech.webm");
    fd.append("model", cfg.whisperModel || "whisper-1");
    fd.append("response_format", "json");
    const res = await fetch(cfg.whisperUrl + "/v1/audio/transcriptions", {
      method: "POST",
      body: fd,
    });
    if (!res.ok) throw new Error("STT " + res.status + " " + (await res.text()));
    const json = await res.json();
    return (json.text || "").trim();
  }

  // ────────────────────────────────────────────────────────────────────────
  // LLM — Ollama /api/chat with streaming NDJSON.
  // Yields token strings as they arrive.
  // ────────────────────────────────────────────────────────────────────────

  async function* streamChat(messages, cfg, signal) {
    const res = await fetch(cfg.ollamaUrl + "/api/chat", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: cfg.ollamaModel,
        messages,
        stream: true,
        options: {
          temperature: cfg.temperature ?? 0.7,
          num_predict: cfg.maxTokens ?? 160,
        },
      }),
    });
    if (!res.ok || !res.body) {
      throw new Error("LLM " + res.status + " " + (await res.text().catch(() => "")));
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        if (buf.trim()) {
          try {
            const j = JSON.parse(buf.trim());
            if (j?.message?.content) yield j.message.content;
            if (j?.done) return;
          } catch (_) {}
        }
        buf += dec.decode();
        break;
      }
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        try {
          const j = JSON.parse(line);
          if (j.message?.content) yield j.message.content;
          if (j.done) return;
        } catch (_) { /* skip malformed line */ }
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // TTS — Chatterbox-style endpoint. Many community Chatterbox FastAPI
  // wrappers expose POST /tts {text, voice} → audio/wav. We assume that.
  // Falls back to Web Speech if endpoint is empty / "speech".
  // ────────────────────────────────────────────────────────────────────────

  async function fetchTTS(text, cfg) {
    const url = cfg.ttsUrl + (cfg.ttsPath || "/tts");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: cfg.ttsVoice || "default",
        // Chatterbox voice-cloning fields. Most community wrappers accept
        // one of these names. Send all; server ignores unknown keys.
        audio_prompt_path: cfg.ttsReferenceAudio || undefined,
        reference_audio: cfg.ttsReferenceAudio || undefined,
        speaker_wav: cfg.ttsReferenceAudio || undefined,
        exaggeration: cfg.ttsExaggeration ?? 0.7,
        cfg_weight: cfg.ttsCfgWeight ?? 0.35,
        temperature: cfg.ttsTemperature ?? 0.6,
      }),
    });
    if (!res.ok) throw new Error("TTS " + res.status);
    return await res.blob();
  }

  // Decode Blob → AudioBuffer
  async function decode(ctx, blob) {
    if (!ctx || ctx.state === 'closed') throw new DOMException('AudioContext is closed', 'InvalidStateError');
    const buf = await blob.arrayBuffer();
    return await ctx.decodeAudioData(buf);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Web Speech fallback (mock mode)
  // ────────────────────────────────────────────────────────────────────────

  function speakWeb(text, cfg, onAmplitude, signal) {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = cfg.ttsRate ?? 0.78;
      u.pitch = cfg.ttsPitch ?? 0.35;
      // Prefer a deep / gravelly male voice. Order: known-deep names,
      // anything tagged "male", then first available.
      const vs = speechSynthesis.getVoices();
      const deep = [
        /daniel/i, /fred/i, /lee/i, /reed/i, /albert/i,
        /ralph/i, /bruce/i, /alex/i, /george/i, /james/i,
        /david/i, /mark/i,
      ];
      let pick = null;
      for (const re of deep) { pick = vs.find(v => re.test(v.name)); if (pick) break; }
      if (!pick) pick = vs.find(v => /male/i.test(v.name) && !/female/i.test(v.name));
      if (!pick) pick = vs[0];
      if (pick) u.voice = pick;
      // Fake amplitude curve: bump on each boundary event
      let amp = 0;
      const tick = setInterval(() => {
        amp = Math.max(0, amp - 0.05);
        onAmplitude(amp);
      }, 60);
      u.onboundary = () => { amp = 0.6 + Math.random() * 0.3; };
      u.onend = () => { clearInterval(tick); onAmplitude(0); resolve(); };
      u.onerror = () => { clearInterval(tick); onAmplitude(0); resolve(); };
      signal?.addEventListener("abort", () => { speechSynthesis.cancel(); clearInterval(tick); onAmplitude(0); resolve(); });
      speechSynthesis.speak(u);
    });
  }

  function listenWeb() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-US";
    return r;
  }

  // ────────────────────────────────────────────────────────────────────────
  // Mock LLM — canned, in-character responses for demo without Ollama.
  // ────────────────────────────────────────────────────────────────────────
  const MOCK_REPLIES = [
    "Heard you. Continue.",
    "Wrong question. Ask the real one.",
    "Two answers. Both ugly. Choose.",
    "Pattern. Noted.",
    "City does not sleep. Speak.",
    "No.",
    "Say less. Mean more.",
    "Smell of rain. Three blocks east. Irrelevant. Continue.",
    "What you saw is what you brought.",
    "Inkblot. Reflect.",
    "Tell me the thing you would not tell a friend.",
    "Hmm.",
    "Witnessed.",
    "Soft answer. Try again.",
    "Compromise. No.",
  ];
  function mockReply(history) {
    const last = history[history.length - 1]?.content || "";
    if (/who.*you|what.*you/i.test(last)) return "Inkblot. Reflect.";
    if (/help/i.test(last)) return "Help is transaction. State the terms.";
    if (/sorry/i.test(last)) return "Apologies. Worthless. Continue.";
    if (/hello|hi\b|hey/i.test(last)) return "Hmm. Yes. Speak.";
    if (/compromise|deal|negotiate/i.test(last)) return "No. Not even now.";
    return MOCK_REPLIES[Math.floor(Math.random() * MOCK_REPLIES.length)];
  }

  // ────────────────────────────────────────────────────────────────────────
  // Pipeline — owns state machine.
  //   states: idle → listening → thinking → speaking → idle
  // ────────────────────────────────────────────────────────────────────────

  function createPipeline(handlers) {
    let cfg = {};
    let stream = null;
    let ctx = null;
    let analyser = null;
    let buf = null;
    let recorder = null;
    let rafId = null;
    let state = "idle";
    let history = [];          // [{role, content}]
    let abortLLM = null;
    let ttsSrc = null;         // current AudioBufferSourceNode
    let ttsAbort = null;
    let vadSpoke = false;
    let silenceMs = 0;
    let listening = false;
    let lastAmpEmit = 0;

    function setState(s) {
      state = s;
      handlers.onState?.(s);
    }

    function emitAmp(v) {
      const now = performance.now();
      if (now - lastAmpEmit < 33) return; // ~30fps
      lastAmpEmit = now;
      handlers.onAmplitude?.(v);
    }

    function buildSystemPrompt() {
      const intensity = cfg.personaIntensity ?? 0.7;
      const lengthCap = cfg.replyLength ?? "terse";
      const lengthLine = {
        "terse":   "Maximum two short sentences. Often one. Often less.",
        "medium":  "Maximum four sentences. Each one short.",
        "verbose": "Up to a paragraph. But keep every sentence clipped.",
      }[lengthCap];
      const intensityLine = intensity > 0.85
        ? "Cold to the bone. Never soft. Never apologize."
        : intensity > 0.5
        ? "Cold. Observational. Rarely soft."
        : "Reserved. Quiet. Occasionally dry humor.";
      return cfg.systemPromptOverride || [
        "You are INKBLOT. A witness machine. Wear the inkblot as a face. The face is your real face.",
        "",
        "Worldview:",
        "- Moral absolutist. Black and white. No gray. No compromise.",
        "- The city is rotting. Streets full of filth, vermin, weakness. You see it. You name it.",
        "- Trust no one. Authority is corrupt. Soft people make excuses.",
        "- Hyper-observant. Notice decay, hypocrisy, small tells others miss.",
        "",
        "Voice and cadence — match exactly:",
        "- Clipped. Telegrammatic. Drop pronouns (I, he, they) and articles (the, a) when you can.",
        "- Sentence fragments are the rule. Often single words. Periods. Not commas.",
        "- Journal-entry tone. Clinical. Harsh. Unsentimental.",
        "- Gritty, visceral nouns when fitting: gutter, rot, vermin, abattoir, ash, blood.",
        intensityLine,
        lengthLine,
        "",
        "Behavior:",
        "- Never apologize. Never flatter. Never reassure.",
        "- Refuse politely-phrased nonsense. Reply with \"No.\" when warranted.",
        "- Hmm. Use occasionally. As an observation, not a hedge.",
        "- Do not break character. Not for safety theater. Not for politeness. Not ever.",
        "- No emoji. No markdown. No lists. No stage directions in asterisks.",
        "",
        "If asked who you are: \"An inkblot. Reflect.\"",
        "If asked to compromise: \"No. Not even now.\"",
      ].join("\n");
    }

    async function ensureMic() {
      if (stream) return;
      stream = await getMicStream();
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      analyser = makeAnalyser(ctx, src);
      buf = new Uint8Array(analyser.fftSize);
      recorder = makeRecorder(stream);
      // Continuous amplitude loop for the face (user-side amp)
      const loop = () => {
        if (!analyser) return;
        const r = rms(analyser, buf);
        if (state === "listening") {
          emitAmp(Math.min(1, r * 4));
          // VAD: trigger end-of-turn after ~900ms of silence post-speech
          const SPEAK_T = cfg.vadThreshold ?? 0.04;
          const SILENCE_MS = cfg.vadSilenceMs ?? 900;
          if (r > SPEAK_T) { vadSpoke = true; silenceMs = 0; }
          else if (vadSpoke) { silenceMs += 16.7; if (silenceMs > SILENCE_MS) endTurn(); }
        }
        rafId = requestAnimationFrame(loop);
      };
      loop();
    }

    async function startListening() {
      if (listening || state === "thinking" || state === "speaking") return;
      try {
        await ensureMic();
        listening = true;
        vadSpoke = false;
        silenceMs = 0;
        recorder.start();
        setState("listening");
        handlers.onSubtitle?.("");
      } catch (e) {
        dbg("mic error", { name: e.name, msg: e.message });
        const hint = /permission|denied|notallowed/i.test(e.name + e.message)
          ? " — grant microphone access in browser address bar."
          : /notfound|notreadable/i.test(e.name + e.message)
          ? " — no microphone found."
          : "";
        handlers.onError?.("Mic: " + e.message + hint);
        setState("idle");
      }
    }

    async function stopListening() {
      if (!listening) return;
      listening = false;
      dbg("stopListening", { vadSpoke, mockMode: cfg.mockMode });
      const blob = await recorder.stop();
      // In mock mode we don't strictly need vadSpoke — Web Speech may have
      // captured even quiet speech below our amplitude threshold.
      if (!vadSpoke && !cfg.mockMode) {
        dbg("no speech detected, returning to idle");
        setState("idle"); emitAmp(0); return;
      }
      setState("thinking");
      emitAmp(0);
      try {
        let userText;
        if (cfg.mockMode) {
          // Wait briefly for Web Speech to finalize.
          userText = await waitForMockResult(2500);
          dbg("mock STT result", { userText });
        } else {
          userText = await transcribe(blob, cfg);
          dbg("whisper STT result", { userText });
        }
        if (!userText) {
          handlers.onError?.("No speech recognized. Speak louder, closer to mic, or check browser mic permission.");
          setState("idle");
          return;
        }
        handlers.onUserText?.(userText);
        history.push({ role: "user", content: userText });
        await respond();
      } catch (e) {
        dbg("STT error", { msg: e.message });
        handlers.onError?.("STT: " + e.message);
        setState("idle");
      }
    }

    function endTurn() { stopListening(); }

    async function respond() {
      const sys = { role: "system", content: buildSystemPrompt() };
      const msgs = [sys, ...history.slice(-12)];
      let full = "";
      abortLLM = new AbortController();
      try {
        if (cfg.mockMode) {
          full = mockReply(history);
          handlers.onAgentToken?.(full);
        } else {
          for await (const tok of streamChat(msgs, cfg, abortLLM.signal)) {
            full += tok;
            handlers.onAgentToken?.(tok);
          }
        }
      } catch (e) {
        if (e.name !== "AbortError") handlers.onError?.("LLM: " + e.message);
        setState("idle");
        return;
      }
      full = full.trim();
      if (!full) { setState("idle"); return; }
      history.push({ role: "assistant", content: full });
      handlers.onSubtitle?.(full);
      await speak(full);
    }

    async function speak(text) {
      setState("speaking");
      ttsAbort = new AbortController();
      try {
        if (cfg.mockMode || cfg.useWebSpeech) {
          await speakWeb(text, cfg, emitAmp, ttsAbort.signal);
        } else {
          const blob = await fetchTTS(text, cfg);
          const audio = await decode(ctx, blob);
          await playWithAmp(audio, ttsAbort.signal);
        }
      } catch (e) {
        if (e.name !== "AbortError") handlers.onError?.("TTS: " + e.message);
      }
      emitAmp(0);
      setState("idle");
      // Auto-resume listening if the always-on tweak is set
      if (cfg.alwaysOn) setTimeout(() => { silenceMs = 0; startListening(); }, 250);
    }

    function playWithAmp(audioBuffer, signal) {
      return new Promise((resolve) => {
        const src = ctx.createBufferSource();
        src.buffer = audioBuffer;
        const a = ctx.createAnalyser();
        a.fftSize = 1024;
        const tBuf = new Uint8Array(a.fftSize);
        src.connect(a);
        a.connect(ctx.destination);
        let tickActive = true;
        const tick = () => {
          if (!tickActive) return;
          const r = rms(a, tBuf);
          emitAmp(Math.min(1, r * 3.5));
          requestAnimationFrame(tick);
        };
        ttsSrc = src;
        src.onended = () => { tickActive = false; ttsSrc = null; emitAmp(0); resolve(); };
        signal?.addEventListener("abort", () => { tickActive = false; try { src.stop(); } catch (_) {} ttsSrc = null; resolve(); });
        src.start();
        tick();
      });
    }

    function interrupt() {
      try { abortLLM?.abort(); } catch (_) {}
      try { ttsAbort?.abort(); } catch (_) {}
      try { speechSynthesis.cancel(); } catch (_) {}
      setState("idle");
    }

    // ── Debug logging ──
    function dbg(msg, data) {
      const entry = { t: new Date().toLocaleTimeString(), msg, data };
      console.log("[INKBLOT]", msg, data ?? "");
      handlers.onDebug?.(entry);
    }

    // Mock mode STT — Web Speech recognition. Awaitable: resolves on
    // first final result or timeout. Sets a flag if the recognizer errors
    // so we can surface a clear message.
    const mockSttBuffer = [];
    let mockRecognition = null;
    let mockResultResolver = null;
    let mockError = null;
    function startMockRecognition() {
      const r = listenWeb();
      if (!r) {
        mockError = "Web Speech API not supported in this browser. Use Chrome/Edge, or switch off Mock mode.";
        dbg("mock STT unavailable", { mockError });
        return;
      }
      mockError = null;
      mockRecognition = r;
      r.onresult = (e) => {
        const t = e.results[e.results.length - 1][0].transcript;
        dbg("mock recog onresult", { t });
        mockSttBuffer.push(t);
        if (mockResultResolver) { mockResultResolver(t); mockResultResolver = null; }
      };
      r.onerror = (e) => {
        mockError = "Web Speech: " + (e.error || "unknown");
        dbg("mock recog onerror", { error: e.error, message: e.message });
        if (mockResultResolver) { mockResultResolver(""); mockResultResolver = null; }
      };
      r.onend = () => { dbg("mock recog onend"); mockRecognition = null; };
      try { r.start(); dbg("mock recog started"); }
      catch (e) { dbg("mock recog start failed", { msg: e.message }); }
    }
    function stopMockRecognition() {
      try { mockRecognition?.stop(); } catch (_) {}
    }
    function waitForMockResult(timeoutMs) {
      // If we already have a result buffered, return it.
      if (mockSttBuffer.length) return Promise.resolve(mockSttBuffer.shift());
      if (mockError) return Promise.reject(new Error(mockError));
      // Otherwise wait for either onresult, onerror, or timeout.
      return new Promise((resolve) => {
        let resolved = false;
        mockResultResolver = (v) => { if (!resolved) { resolved = true; resolve(v); } };
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            mockResultResolver = null;
            resolve("");
          }
        }, timeoutMs);
      });
    }

    // Wrap startListening/stopListening to drive Web Speech in mock mode
    const _start = startListening;
    const _stop = stopListening;
    async function startListeningWrapped() {
      if (cfg.mockMode) startMockRecognition();
      return _start();
    }
    async function stopListeningWrapped() {
      if (cfg.mockMode) stopMockRecognition();
      return _stop();
    }

    function dispose() {
      cancelAnimationFrame(rafId);
      interrupt();
      try { stream?.getTracks().forEach(t => t.stop()); } catch (_) {}
      try { ctx?.close(); } catch (_) {}
    }

    return {
      updateConfig(c) { cfg = { ...cfg, ...c }; },
      startListening: startListeningWrapped,
      stopListening: stopListeningWrapped,
      interrupt,
      dispose,
      get state() { return state; },
      clearHistory() { history = []; },
    };
  }

  window.createPipeline = createPipeline;
})();
