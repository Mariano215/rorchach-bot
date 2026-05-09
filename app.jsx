/* App shell — sidebar nav + active screen */

const NAV = [
  { id: "plates",    num: "I",   label: "The Plates",    Screen: () => <PlatesScreen onOpenChat={() => setRoute("couch")} onOpenVault={() => setRoute("vault")} /> },
  { id: "couch",     num: "II",  label: "The Couch",     Screen: () => <CouchScreen /> },
  { id: "diagnosis", num: "III", label: "The Diagnosis", Screen: () => <DiagnosisScreen /> },
  { id: "notes",     num: "IV",  label: "The Notes",     Screen: () => <NotesScreen /> },
  { id: "vault",     num: "V",   label: "The Vault",     Screen: () => <VaultScreen /> },
];

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "density": "default",
  "palette": "vermillion"
}/*EDITMODE-END*/;

function App() {
  const [route, setRoute] = React.useState("plates");
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
    document.documentElement.setAttribute("data-density", tweaks.density);
    document.documentElement.setAttribute("data-palette", tweaks.palette);
  }, [tweaks]);

  const Screen = (() => {
    switch (route) {
      case "plates":    return <PlatesScreen onOpenChat={() => setRoute("couch")} onOpenVault={() => setRoute("vault")} />;
      case "couch":     return <CouchScreen />;
      case "diagnosis": return <DiagnosisScreen />;
      case "notes":     return <NotesScreen />;
      case "vault":     return <VaultScreen />;
      default: return null;
    }
  })();

  return (
    <div className="app">
      <aside className="rail" data-screen-label="rail">
        <div>
          <div className="brand">
            <div className="brand-mark"><BrandMark /></div>
            <div>
              <div className="brand-name">Rorschach</div>
              <div className="brand-sub">Multi-Plate Hub · v0.1</div>
            </div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map(n => (
            <button key={n.id}
              className={`nav-item ${route === n.id ? "active" : ""}`}
              onClick={() => setRoute(n.id)}>
              <span className="nav-num">{n.num}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="rail-foot">
          <div>{PROVIDERS.filter(p => p.status === "live").length} plates live</div>
          <div>{PROVIDERS.filter(p => p.local && p.status !== "off").length} on local net</div>
          <div style={{ marginTop: 6 }}>What do you see?</div>
        </div>
      </aside>

      <main className="main" data-screen-label={`${NAV.findIndex(n => n.id === route) + 1} ${NAV.find(n => n.id === route).label}`}>
        {Screen}
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Theme">
          <TweakRadio
            value={tweaks.theme}
            options={[{ value: "paper", label: "Paper" }, { value: "midnight", label: "Midnight" }]}
            onChange={v => setTweak("theme", v)}
          />
        </TweakSection>
        <TweakSection title="Density">
          <TweakRadio
            value={tweaks.density}
            options={[{ value: "compact", label: "Compact" }, { value: "default", label: "Default" }, { value: "roomy", label: "Roomy" }]}
            onChange={v => setTweak("density", v)}
          />
        </TweakSection>
        <TweakSection title="Accent">
          <TweakColor
            value={tweaks.palette}
            options={[
              { value: "vermillion", color: "#b03126" },
              { value: "indigo", color: "#2c3e91" },
              { value: "moss", color: "#4a6b3a" },
              { value: "amber", color: "#b47312" },
            ]}
            onChange={v => setTweak("palette", v)}
          />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
