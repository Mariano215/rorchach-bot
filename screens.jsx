/* Screens — The Plates, The Couch, The Diagnosis, The Notes, The Vault */

const ScreenHead = ({ eyebrow, title, blurb, actions }) => (
  <header className="screen-head">
    <div>
      <div className="screen-eyebrow">{eyebrow}</div>
      <h1 className="screen-title">{title}</h1>
      <p className="screen-blurb">{blurb}</p>
    </div>
    {actions && <div style={{ display: "flex", gap: 8 }}>{actions}</div>}
  </header>
);

/* ------------------------------------------------------------------ THE PLATES */
const PlatesScreen = ({ onOpenChat, onOpenVault }) => {
  const [selected, setSelected] = React.useState("ollama");
  return (
    <>
      <ScreenHead
        eyebrow="I · The Plates"
        title="Ten cards, one conversation."
        blurb="Each provider is a Rorschach plate. Hover to read it. Tap to make it your default. The active card is whichever one you're listening to right now."
        actions={<>
          <button className="btn ghost" onClick={onOpenVault}>Manage Keys</button>
          <button className="btn primary" onClick={onOpenChat}>Open Couch</button>
        </>}
      />
      <div className="grid c5">
        {PROVIDERS.map((p, i) => (
          <article
            key={p.id}
            className={`plate provider ${p.status === "off" ? "disabled" : ""} ${selected === p.id ? "selected" : ""}`}
            onClick={() => setSelected(p.id)}
          >
            <span className="plate-tag">{`PLATE ${String(i + 1).padStart(2, "0")}`}</span>
            <span className="plate-corner">
              <span className={`dot ${p.status === "live" ? "live" : p.status === "warm" ? "warm" : "dim"}`} />
              {p.status}
            </span>
            <div className="provider-blot">
              <ProviderBlot provider={p.id} />
            </div>
            <div>
              <div className="provider-name">{p.name}</div>
              <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 14, marginTop: 2 }}>
                {p.note}
              </div>
            </div>
            <div className="provider-meta">
              <span>{p.models.length} models</span>
              <span>{p.latency ? `${p.latency}ms` : "—"} · {p.cost}</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ THE COUCH */
const ModelPicker = ({ value, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef(null);
  const provider = PROVIDERS.find(p => p.id === value.providerId);

  React.useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (containerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="model-picker" ref={containerRef} onClick={() => setOpen(o => !o)}>
      <span className="blot"><ProviderBlot provider={provider.id} /></span>
      <div>
        <div className="pname">{provider.name}</div>
        <div className="pmodel">{value.model}</div>
      </div>
      <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)", marginLeft: 8 }}>▾</span>
      {open && (
        <div className="picker-pop" onClick={e => e.stopPropagation()}>
          {PROVIDERS.flatMap(p => p.models.map(m => (
            <div key={`${p.id}-${m}`} className="picker-row"
              onClick={() => { onChange({ providerId: p.id, model: m }); setOpen(false); }}>
              <span className="blot"><ProviderBlot provider={p.id} /></span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{p.name}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>{m}</div>
              </div>
              <span className="tag">{p.cost}</span>
            </div>
          )))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ THE COUCH (Inkblot voice chatbot) */

const TAILSCALE_IP = "100.120.203.53";

const REAL_CFG = {
  ttsUrl:            "http://localhost:8080/chatterbox",
  ttsPath:           "/v1/tts",
  ttsVoice:          "Rorchach",
  whisperUrl:        "http://localhost:8080/whisper",
  ollamaUrl:         `http://${TAILSCALE_IP}:11434`,
  ollamaModel:       "qwen2.5:7b",
  ttsReferenceAudio: "voice-ref/Rorschach.mp3",
  ttsExaggeration:   0.7,
  ttsCfgWeight:      0.35,
  ttsTemperature:    0.6,
  temperature:       0.7,
  maxTokens:         400,
  replyLength:       "medium",
};

const MOCK_CFG = {
  ttsUrl:      "speech",
  whisperUrl:  `http://${TAILSCALE_IP}:8010`,
  ollamaUrl:   `http://${TAILSCALE_IP}:11434`,
  ollamaModel: "qwen2.5:7b",
  temperature: 0.7,
  maxTokens:   120,
};

// Map voice state to face card index (0–9 available)
const STATE_CARD = { idle: 0, listening: 2, thinking: 5, speaking: 8 };

const CouchScreen = () => {
  const pipeRef    = React.useRef(null);
  const [voiceState, setVoiceState] = React.useState("idle");
  const [amplitude, setAmplitude]   = React.useState(0);
  const [subtitle,  setSubtitle]    = React.useState("");
  const [userLine,  setUserLine]    = React.useState("");
  const [err,       setErr]         = React.useState("");
  const [mockMode,  setMockMode]    = React.useState(false);

  // Init pipeline once
  React.useEffect(() => {
    if (!window.createPipeline) {
      setErr("voice.js not loaded.");
      return;
    }
    const pipe = window.createPipeline({
      onState:      setVoiceState,
      onAmplitude:  setAmplitude,
      onSubtitle:   (t) => { if (t) setSubtitle(t); },
      onUserText:   (t) => setUserLine(t),
      onAgentToken: () => {},
      onError:      (e) => { setErr(e); setTimeout(() => setErr(""), 8000); },
    });
    pipe.updateConfig(MOCK_CFG);   // default: mock mode
    pipeRef.current = pipe;
    return () => pipe.dispose();
  }, []);

  // Switch config when mock toggle changes
  React.useEffect(() => {
    pipeRef.current?.updateConfig(mockMode ? MOCK_CFG : REAL_CFG);
  }, [mockMode]);

  const toggle = () => {
    const pipe = pipeRef.current;
    if (!pipe) return;
    setErr("");
    if (voiceState === "listening")                        pipe.stopListening();
    else if (voiceState === "idle")                        pipe.startListening();
    else                                                   pipe.interrupt();
  };

  const MIC_LABEL = {
    idle:      "◎  Speak",
    listening: "●  Listening — click to send",
    thinking:  "◌  Thinking…",
    speaking:  "▶  Speaking — click to interrupt",
  };

  const faceReady = typeof window.InkblotFace !== "undefined";

  return (
    <>
      <ScreenHead
        eyebrow="II · The Couch"
        title="What do you see?"
        blurb="The inkblot listens. Speak — it answers in character."
      />

      {/* ── Face viewport ── */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: "var(--pad-md)", paddingBottom: "var(--pad-lg)",
      }}>

        {/* Animated face */}
        <div style={{
          width: "min(480px, 90vw)", aspectRatio: "1",
          borderRadius: 8, overflow: "hidden",
          boxShadow: "0 4px 40px rgba(0,0,0,0.35)",
        }}>
          {faceReady
            ? <window.InkblotFace
                cardIndex={STATE_CARD[voiceState] ?? 0}
                amplitude={amplitude}
                state={voiceState}
                palette="mask"
                morphSpeed={1}
                inkBleed={1}
              />
            : <div style={{
                width: "100%", height: "100%",
                background: "#08080a", display: "flex",
                alignItems: "center", justifyContent: "center",
                fontFamily: "var(--font-mono)", fontSize: 12,
                color: "rgba(255,255,255,0.3)",
              }}>
                face.jsx not loaded
              </div>
          }
        </div>

        {/* Subtitle / user line */}
        <div style={{
          minHeight: 48, width: "min(480px, 90vw)",
          textAlign: "center",
        }}>
          {userLine && (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", marginBottom: 4 }}>
              You: {userLine}
            </div>
          )}
          {subtitle && (
            <div style={{
              fontFamily: "var(--font-display)", fontStyle: "italic",
              fontSize: 16, color: "var(--ink-1)", lineHeight: 1.5,
            }}>
              {subtitle}
            </div>
          )}
        </div>

        {/* Error strip */}
        {err && (
          <div style={{
            width: "min(480px, 90vw)",
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--rust)", padding: "6px 10px",
            background: "var(--paper-2)", borderLeft: "2px solid var(--rust)",
          }}>
            {err}
          </div>
        )}

        {/* Mic button */}
        <button
          className={`btn ${voiceState === "idle" ? "primary" : "ghost"}`}
          style={{ width: "min(480px, 90vw)", padding: "14px 0", fontSize: 15 }}
          onClick={toggle}
        >
          {MIC_LABEL[voiceState] ?? voiceState}
        </button>

        {/* Mode + model row */}
        <div style={{
          width: "min(480px, 90vw)", display: "flex",
          alignItems: "center", gap: 12,
          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)",
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
            <input type="checkbox" checked={mockMode}
              onChange={e => setMockMode(e.target.checked)} />
            MOCK MODE
          </label>
          <span style={{ color: "var(--rule)" }}>|</span>
          {mockMode
            ? <span>Web Speech API · mock LLM replies</span>
            : <span>{TAILSCALE_IP} · Whisper :8010 · Ollama :11434 · Chatterbox :8095</span>
          }
        </div>

        {!mockMode && (
          <div style={{
            width: "min(480px, 90vw)",
            fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)",
            lineHeight: 1.8,
          }}>
            MODEL: {REAL_CFG.ollamaModel} · REF AUDIO: {REAL_CFG.ttsReferenceAudio}
          </div>
        )}
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ THE DIAGNOSIS */
const DiagnosisScreen = () => (
  <>
    <ScreenHead
      eyebrow="III · The Diagnosis"
      title="Routes & fallbacks."
      blurb="Define which plate gets read first, and which one catches the prompt if the first refuses, errors, or runs out of budget."
      actions={<button className="btn primary">+ New Route</button>}
    />
    <div className="routes">
      {ROUTES.map(route => (
        <div className="route" key={route.name}>
          <div>
            <div className="route-name">{route.name}</div>
            <div className="route-cond">{route.cond}</div>
          </div>
          <div className="chain">
            {route.chain.map((id, i) => {
              const p = PROVIDERS.find(x => x.id === id);
              return (
                <React.Fragment key={id}>
                  <div className="chain-node">
                    <span className="blot"><ProviderBlot provider={id} /></span>
                    <div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 15, lineHeight: 1 }}>{p.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--ink-3)" }}>
                        {i === 0 ? "PRIMARY" : `FALLBACK ${i}`}
                      </div>
                    </div>
                  </div>
                  {i < route.chain.length - 1 && <span className="chain-arrow">→</span>}
                </React.Fragment>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button className="btn ghost">Edit</button>
            <span className="tag">{route.name === "Air-Gapped" ? "PRIORITY" : "ACTIVE"}</span>
          </div>
        </div>
      ))}
    </div>
  </>
);

/* ------------------------------------------------------------------ THE NOTES */
const NotesScreen = () => {
  const days = 30;
  const bars = Array.from({ length: days }, (_, i) => {
    const v = 30 + Math.abs(Math.sin(i * 0.7) * 50) + (i % 7 === 6 ? -25 : 0) + (i > 22 ? 15 : 0);
    return { v, today: i === days - 1 };
  });
  return (
    <>
      <ScreenHead
        eyebrow="IV · The Notes"
        title="Session log."
        blurb="Every plate read leaves a trace. Tokens, latency, refusals, cost. The clinician's notebook."
        actions={<button className="btn ghost">Export CSV</button>}
      />
      <div className="grid c4" style={{ marginBottom: "var(--pad-md)" }}>
        <div className="stat"><div className="stat-lbl">Tokens · 30d</div><div className="stat-val">14.2M</div><div className="stat-delta up">▲ 22% wow</div></div>
        <div className="stat"><div className="stat-lbl">Spend · 30d</div><div className="stat-val">$284.16</div><div className="stat-delta">▼ 4% wow</div></div>
        <div className="stat"><div className="stat-lbl">Refusals</div><div className="stat-val">1.4%</div><div className="stat-delta">19 of 1,342</div></div>
        <div className="stat"><div className="stat-lbl">Avg latency</div><div className="stat-val">412ms</div><div className="stat-delta">p95 · 1.2s</div></div>
      </div>
      <div className="usage-grid">
        <div>
          <div className="bar-chart">
            {bars.map((b, i) => (
              <div key={i} className={`bar ${b.today ? "rust" : ""}`} style={{ height: `${b.v}%` }} title={`Day ${i + 1}`} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>
            <span>30 DAYS AGO</span><span>TODAY</span>
          </div>
        </div>
        <div className="plate" style={{ padding: "var(--pad-md)" }}>
          <div className="screen-eyebrow" style={{ marginBottom: 12 }}>BY PROVIDER</div>
          {PROVIDERS.filter(p => p.status !== "off").map(p => {
            const pct = Math.round(8 + Math.abs(Math.sin(p.name.length)) * 40);
            return (
              <div key={p.id} style={{ display: "grid", gridTemplateColumns: "30px 1fr 50px", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px dashed var(--rule)" }}>
                <span className="blot" style={{ width: 30, height: 30 }}><ProviderBlot provider={p.id} /></span>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 15 }}>{p.name}</div>
                  <div style={{ height: 4, background: "var(--paper-3)", marginTop: 4 }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: p.id === "anthropic" ? "var(--rust)" : "var(--ink)" }} />
                  </div>
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)", textAlign: "right" }}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ THE VAULT */
const VaultScreen = () => {
  const nameRef = React.useRef(null);
  const urlRef = React.useRef(null);
  const keyRef = React.useRef(null);
  return (
    <>
      <ScreenHead
        eyebrow="V · The Vault"
        title="Keys & endpoints."
        blurb="Credentials never leave the server. Local providers are auto-discovered on the network — no key needed."
        actions={<button className="btn primary">+ Connect Endpoint</button>}
      />

      <div className="grid c2" style={{ marginBottom: "var(--pad-lg)", alignItems: "start" }}>
        <div className="plate" style={{ padding: 0 }}>
          <div style={{ padding: "var(--pad-md)", borderBottom: "1px solid var(--rule)" }}>
            <div className="screen-eyebrow">Hosted providers</div>
          </div>
          {PROVIDERS.filter(p => !p.local).map(p => (
            <div className="vault-row" key={p.id}>
              <span className="blot"><ProviderBlot provider={p.id} /></span>
              <div>
                <div className="vault-name">{p.name}</div>
                <div className="vault-host">{p.host}</div>
              </div>
              <div className="vault-key">
                {p.status === "off" ? "—" : `sk-…${p.id.slice(0, 4)}…${p.id.slice(-3)}`}
              </div>
              <button className="btn ghost">{p.status === "off" ? "Add" : "Rotate"}</button>
            </div>
          ))}
        </div>

        <div className="plate" style={{ padding: 0 }}>
          <div style={{ padding: "var(--pad-md)", borderBottom: "1px solid var(--rule)" }}>
            <div className="screen-eyebrow">Local servers</div>
          </div>
          {PROVIDERS.filter(p => p.local && p.id !== "custom").map(p => (
            <div className="vault-row" key={p.id}>
              <span className="blot"><ProviderBlot provider={p.id} /></span>
              <div>
                <div className="vault-name">{p.name}</div>
                <div className="vault-host">{p.host} · {p.models.length} models</div>
              </div>
              <div className="vault-key" style={{ background: "var(--paper-2)" }}>
                <span className={`dot ${p.status === "live" ? "live" : "warm"}`} style={{ marginRight: 8 }} />
                {p.status === "live" ? "responding" : "idle"}
              </div>
              <button className="btn ghost">Inspect</button>
            </div>
          ))}
          <div style={{ padding: "var(--pad-md)" }}>
            <div className="discover">
              <div className="pulse" />
              <div className="screen-eyebrow">Scanning local network</div>
              <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", color: "var(--ink-2)", marginTop: 6 }}>
                Looking for OpenAI-compatible servers on common ports…
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em", marginTop: 8 }}>
                :11434 · :1234 · :8080 · :5000
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="plate" style={{ padding: "var(--pad-lg)" }}>
        <div className="screen-eyebrow" style={{ marginBottom: "var(--pad-md)" }}>Add custom endpoint</div>
        <div className="grid c3">
          <label className="field"><span className="lbl">Display name</span><input className="input" ref={nameRef} defaultValue="My vLLM box" /></label>
          <label className="field"><span className="lbl">Base URL</span><input className="input" ref={urlRef} defaultValue="http://10.0.0.42:8000/v1" /></label>
          <label className="field"><span className="lbl">API key (optional)</span><input className="input" type="password" ref={keyRef} defaultValue="••••••••" /></label>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: "var(--pad-md)" }}>
          <button className="btn ghost">Test connection</button>
          <button className="btn primary">Save endpoint</button>
        </div>
      </div>
    </>
  );
};

window.PlatesScreen = PlatesScreen;
window.CouchScreen = CouchScreen;
window.DiagnosisScreen = DiagnosisScreen;
window.NotesScreen = NotesScreen;
window.VaultScreen = VaultScreen;
