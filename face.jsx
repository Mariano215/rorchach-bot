// face.jsx — multi-part morphing inkblot/mask face.
//
// Each card has N "parts", each with its own point ring. We render one
// <path> per part inside a single ink-bleed filter <g> so they read as
// one coherent blot. Every frame:
//   • Lerp each part's points between fromCard.parts[i] and toCard.parts[i]
//   • Apply slow idle drift (always — "always moving")
//   • Apply amplitude pulse (voice-driven outward push)
//   • Apply processing-state shimmer (high-freq jitter)
//   • Smoothstep eased card transition

const { useEffect, useRef, useMemo } = React;

function InkblotFace({
  cardIndex = 0,
  amplitude = 0,
  state = "idle",
  palette = "mono",
  morphSpeed = 1,
  inkBleed = 1,
  faceMode = "mask",
}) {
  // When the skull-mask is active, the ink should be ONE flowing organic
  // body bleeding through the mask material — not the multi-part face
  // composition. So we override faceMode → blot when palette === "mask".
  const effectiveMode = palette === "mask" ? "blot" : faceMode;
  const deck = useMemo(() => window.Inkblot.buildDeck(10, effectiveMode), [effectiveMode]);
  const partRefs = useRef([]);
  const groupRef = useRef(null);
  const filterScaleRef = useRef(null);
  const turbRef = useRef(null);

  // Live prop refs — avoid re-creating the rAF loop per prop change.
  const ampRef = useRef(amplitude);
  const morphSpeedRef = useRef(morphSpeed);
  const inkBleedRef = useRef(inkBleed);
  const stateRef = useRef(state);
  useEffect(() => { ampRef.current = amplitude; }, [amplitude]);
  useEffect(() => { morphSpeedRef.current = morphSpeed; }, [morphSpeed]);
  useEffect(() => { inkBleedRef.current = inkBleed; }, [inkBleed]);
  useEffect(() => { stateRef.current = state; }, [state]);

  const animRef = useRef({
    fromIdx: 0,
    toIdx: 0,
    progress: 1,
    amp: 0,
    phase: 0,        // breathing phase
    drift: 0,        // slow idle phase
    proc: 0,         // processing intensity (0..1)
  });

  useEffect(() => {
    const a = animRef.current;
    a.fromIdx = a.toIdx;
    a.toIdx = cardIndex;
    a.progress = 0;
  }, [cardIndex]);

  // Animation loop
  useEffect(() => {
    let raf;
    let last = performance.now();

    // Initial paint
    const initial = deck[0];
    initial.parts.forEach((p, i) => {
      if (partRefs.current[i]) partRefs.current[i].setAttribute("d", p.path);
    });

    const tick = (now) => {
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      const a = animRef.current;
      const s = stateRef.current;

      // Smoothed amplitude
      const targetAmp = Math.max(0, Math.min(1, ampRef.current));
      const smoothing = targetAmp > a.amp ? 0.4 : 0.06;
      a.amp += (targetAmp - a.amp) * smoothing;

      // Card morph progress
      a.progress = Math.min(1, a.progress + dt * 0.45 * morphSpeedRef.current);

      // Slow always-on drift (independent of speech)
      a.drift += dt * 0.45;

      // Breathing — slightly faster when speaking, lung-like when idle
      const breatheRate = s === "speaking" ? 1.2 + a.amp * 0.8 : 0.5;
      a.phase += dt * breatheRate;

      // Processing state ramps up an internal "proc" intensity
      const procTarget = s === "thinking" ? 1 : 0;
      a.proc += (procTarget - a.proc) * 0.08;

      const fromCard = deck[a.fromIdx];
      const toCard = deck[a.toIdx];
      const tEased = a.progress * a.progress * (3 - 2 * a.progress);

      // Per-part deformation
      const nParts = Math.min(fromCard.parts.length, toCard.parts.length);
      for (let i = 0; i < nParts; i++) {
        const fp = fromCard.parts[i].points;
        const tp = toCard.parts[i].points;
        let pts = window.Inkblot.lerpPoints(fp, tp, tEased);
        // Idle drift — always moving
        pts = window.Inkblot.driftPoints(pts, a.drift + i * 0.7, 1.8);
        // Voice pulse
        if (a.amp > 0.01) {
          pts = window.Inkblot.pulsePoints(pts, a.amp, a.phase + i * 0.5, 0.18);
        }
        // Processing shimmer — small high-freq jitter
        if (a.proc > 0.01) {
          const j = a.proc * 4;
          for (let k = 0; k < pts.length; k++) {
            pts[k] = [
              pts[k][0] + (Math.sin(now * 0.04 + k * 1.3 + i) * j),
              pts[k][1] + (Math.cos(now * 0.045 + k * 1.7 + i) * j),
            ];
          }
        }
        const d = window.Inkblot.smoothClosedPath(pts);
        if (partRefs.current[i]) partRefs.current[i].setAttribute("d", d);
      }

      // Group transform — breathing scale + processing rotation wobble
      const breathe = 1 + Math.sin(a.phase * 0.9) * 0.012 + a.amp * 0.04;
      const procRot = a.proc * Math.sin(now * 0.012) * 1.2;
      if (groupRef.current) {
        groupRef.current.setAttribute(
          "transform",
          `translate(500,500) scale(${breathe.toFixed(4)}) rotate(${procRot.toFixed(3)})`
        );
      }

      // Ink filter intensity — louder voice or processing => more bleed
      if (filterScaleRef.current) {
        const sc = (4 + a.amp * 22 + a.proc * 14) * inkBleedRef.current;
        filterScaleRef.current.setAttribute("scale", sc.toFixed(2));
      }
      // Animate filter seed during processing for visible churn
      if (turbRef.current && a.proc > 0.05) {
        turbRef.current.setAttribute("seed", String(Math.floor(now * 0.02) % 100));
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [deck]);

  const palettes = {
    mono: { bg: "#0a0a0b", ink: "#f3efe6", glow: "rgba(255,255,255,0.04)", mask: null },
    sepia: { bg: "#0d0a06", ink: "#d9c39a", glow: "rgba(217,195,154,0.05)", mask: null },
    redbleed: { bg: "#0a0606", ink: "#e64a36", glow: "rgba(230,74,54,0.06)", mask: null },
    paper: { bg: "#efece4", ink: "#0a0a0b", glow: "rgba(0,0,0,0.04)", mask: null },
    // White mask with black ink — the "skull mask" treatment.
    mask: {
      bg: "#08080a",
      ink: "#0a0a0b",
      glow: "rgba(255,255,255,0.03)",
      mask: { fill: "#f1ede4", shadow: "#cfc9bc", deep: "#3a3530" },
    },
  };
  const pal = palettes[palette] || palettes.mono;
  const showMask = !!pal.mask;
  const specks = deck[cardIndex]?.specks || [];
  const card0 = deck[0];

  // When the mask layer is active, the blot is concentrated in the upper face
  // area (ref image: blot sits over the brow/eyes/nose, not the chin).
  // We translate the blot up and scale it down a bit to match.
  const blotTransform = showMask
    ? "translate(500,460) scale(0.78)"
    : "translate(500,500) scale(1)";

  return (
    <svg
      className="inkblot-svg"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="xMidYMid meet"
      style={{ background: pal.bg }}
    >
      <defs>
        <filter id="ink-bleed" x="-30%" y="-30%" width="160%" height="160%" filterUnits="objectBoundingBox">
          <feTurbulence ref={turbRef} type="fractalNoise" baseFrequency="0.013 0.02" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap ref={filterScaleRef} in="SourceGraphic" in2="noise" scale="6" xChannelSelector="R" yChannelSelector="G" result="disp" />
          <feGaussianBlur in="disp" stdDeviation="0.7" />
        </filter>
        {/* Heavier "bleed-through-mask" filter: more turbulence + soft edge */}
        <filter id="ink-soak" x="-40%" y="-40%" width="180%" height="180%" filterUnits="objectBoundingBox">
          <feTurbulence type="fractalNoise" baseFrequency="0.018 0.026" numOctaves="4" seed="11" result="n2" />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale="14" xChannelSelector="R" yChannelSelector="G" result="d2" />
          <feGaussianBlur in="d2" stdDeviation="2.4" result="b2" />
          <feComponentTransfer in="b2">
            <feFuncA type="gamma" amplitude="1" exponent="0.85" offset="0" />
          </feComponentTransfer>
        </filter>
        <radialGradient id="vignette" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0%" stopColor={pal.glow} />
          <stop offset="60%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
        </radialGradient>
        <radialGradient id="floor-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(0,0,0,0.45)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        {showMask && (
          <>
            {/* Mask body: warm off-white with side shading */}
            <radialGradient id="mask-body" cx="0.5" cy="0.42" r="0.55">
              <stop offset="0%" stopColor={pal.mask.fill} />
              <stop offset="70%" stopColor={pal.mask.fill} />
              <stop offset="100%" stopColor={pal.mask.shadow} />
            </radialGradient>
            {/* Subtle eye-socket darkening (sells skull form) */}
            <radialGradient id="mask-socket-l" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="rgba(58,53,48,0.55)" />
              <stop offset="100%" stopColor="rgba(58,53,48,0)" />
            </radialGradient>
          </>
        )}
      </defs>

      <rect width="1000" height="1000" fill="url(#vignette)" />
      <ellipse cx="500" cy="900" rx="220" ry="18" fill="url(#floor-shadow)" />

      {showMask && (
        <g>
          {/* Skull-mask silhouette: tall oval, slightly narrowed at the chin.
              Drawn as a single path so the egg→jaw transition is smooth. */}
          <path
            d="M 500 130
               C 660 130, 760 270, 760 470
               C 760 640, 700 790, 580 870
               C 540 898, 460 898, 420 870
               C 300 790, 240 640, 240 470
               C 240 270, 340 130, 500 130 Z"
            fill="url(#mask-body)"
            stroke={pal.mask.shadow}
            strokeWidth="1.5"
          />
          {/* eye-socket faint hollows */}
          <ellipse cx="420" cy="445" rx="60" ry="42" fill="url(#mask-socket-l)" />
          <ellipse cx="580" cy="445" rx="60" ry="42" fill="url(#mask-socket-l)" />
          {/* Specular highlight on the temple */}
          <ellipse cx="380" cy="280" rx="55" ry="90" fill="rgba(255,255,255,0.35)" />
          <ellipse cx="610" cy="260" rx="35" ry="60" fill="rgba(255,255,255,0.2)" />
          {/* Soft chin shadow */}
          <ellipse cx="500" cy="820" rx="160" ry="50" fill={pal.mask.shadow} opacity="0.35" />
        </g>
      )}

      <g ref={groupRef} transform={blotTransform}>
        <g filter={showMask ? "url(#ink-soak)" : "url(#ink-bleed)"}
           opacity={showMask ? 0.92 : 1}
           style={showMask ? { mixBlendMode: "multiply" } : null}>
          {!showMask && specks.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={pal.ink} opacity="0.9" />
          ))}
          {card0.parts.map((p, i) => (
            <path
              key={i}
              ref={el => (partRefs.current[i] = el)}
              d={p.path}
              fill={showMask ? "#0a0807" : pal.ink}
            />
          ))}
        </g>
      </g>
    </svg>
  );
}

window.InkblotFace = InkblotFace;
