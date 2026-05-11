/* Inkblot generator + per-provider blots.
   Each blot is mirror-symmetric: we render the left half (clipped) with an
   organic displacement filter, then mirror it for the right half.
   Seeds, frequencies, and ellipse clusters give each provider a distinct silhouette.
*/

const InkFilter = ({ id, seed, freq = 0.025, scale = 70 }) => (
  <filter id={id} x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves="3" seed={seed} stitchTiles="stitch" />
    <feDisplacementMap in="SourceGraphic" scale={scale} xChannelSelector="R" yChannelSelector="G" />
    <feGaussianBlur stdDeviation="0.6" />
  </filter>
);

/* Inkblot — symmetrical organic blob from a cluster of ellipses + a turbulence filter.
   `shapes` describes the cluster as ellipse params on the *left half* of the canvas.
   We render those clipped to x<=100, then mirror across x=100. Result is a 200x200 blot.
*/
const InkblotShape = ({ id, seed, shapes, freq, scale, accent, splatter = [] }) => {
  const filterId = `ink-${id}`;
  const clipId = `clip-${id}`;
  const halfId = `half-${id}`;
  return (
    <svg viewBox="0 0 200 200" className="blot" aria-hidden="true">
      <defs>
        <InkFilter id={filterId} seed={seed} freq={freq} scale={scale} />
        <clipPath id={clipId}>
          <rect x="0" y="0" width="101" height="200" />
        </clipPath>
        <g id={halfId}>
          <g clipPath={`url(#${clipId})`} filter={`url(#${filterId})`}>
            {shapes.map((s, i) => (
              <ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry}
                fill={s.accent && accent ? accent : "currentColor"} />
            ))}
          </g>
          {/* Splatter dots — small unfiltered marks for character */}
          {splatter.map((s, i) => (
            <circle key={i} cx={s.cx} cy={s.cy} r={s.r}
              fill={s.accent && accent ? accent : "currentColor"} opacity={s.o ?? 0.85} />
          ))}
        </g>
      </defs>
      <use href={`#${halfId}`} />
      <use href={`#${halfId}`} transform="translate(200,0) scale(-1,1)" />
    </svg>
  );
};

/* Each provider has a hand-tuned cluster recipe. The seed varies the displacement,
   producing a distinct silhouette while keeping bilateral symmetry. */

const PROVIDER_BLOTS = {
  openai: {
    seed: 4, freq: 0.022, scale: 70,
    shapes: [
      { cx: 90, cy: 96, rx: 38, ry: 46 },
      { cx: 78, cy: 70, rx: 18, ry: 22 },
      { cx: 80, cy: 130, rx: 22, ry: 14 },
    ],
    splatter: [{ cx: 64, cy: 60, r: 2 }, { cx: 72, cy: 152, r: 1.5 }, { cx: 136, cy: 60, r: 2 }, { cx: 128, cy: 152, r: 1.5 }],
  },
  anthropic: {
    seed: 11, freq: 0.018, scale: 60,
    shapes: [
      { cx: 92, cy: 100, rx: 32, ry: 56 },
      { cx: 84, cy: 64, rx: 18, ry: 14 },
      { cx: 85, cy: 138, rx: 20, ry: 12 },
    ],
    splatter: [{ cx: 60, cy: 100, r: 2.5, accent: true }, { cx: 140, cy: 100, r: 2.5, accent: true }],
  },
  gemini: {
    seed: 7, freq: 0.028, scale: 80,
    shapes: [
      { cx: 88, cy: 88, rx: 28, ry: 32 },
      { cx: 92, cy: 130, rx: 20, ry: 24 },
      { cx: 76, cy: 64, rx: 14, ry: 18 },
    ],
    splatter: [{ cx: 100, cy: 38, r: 3 }, { cx: 100, cy: 168, r: 2.5 }],
  },
  grok: {
    seed: 19, freq: 0.04, scale: 90,
    shapes: [
      { cx: 88, cy: 100, rx: 30, ry: 50 },
      { cx: 70, cy: 84, rx: 12, ry: 22 },
      { cx: 70, cy: 122, rx: 12, ry: 18 },
    ],
    splatter: [{ cx: 50, cy: 70, r: 1.5 }, { cx: 50, cy: 132, r: 1.5 }, { cx: 100, cy: 50, r: 2 }],
  },
  mistral: {
    seed: 23, freq: 0.02, scale: 50,
    shapes: [
      { cx: 90, cy: 102, rx: 26, ry: 40 },
      { cx: 78, cy: 76, rx: 14, ry: 12 },
      { cx: 100, cy: 56, rx: 8, ry: 10 },
    ],
    splatter: [{ cx: 100, cy: 158, r: 3, accent: true }],
  },
  deepseek: {
    seed: 31, freq: 0.024, scale: 75,
    shapes: [
      { cx: 92, cy: 96, rx: 36, ry: 42 },
      { cx: 80, cy: 140, rx: 18, ry: 22 },
    ],
    splatter: [{ cx: 100, cy: 44, r: 2 }, { cx: 64, cy: 108, r: 1.5 }],
  },
  llama: {
    seed: 41, freq: 0.022, scale: 65,
    shapes: [
      { cx: 86, cy: 100, rx: 32, ry: 44 },
      { cx: 76, cy: 70, rx: 16, ry: 14 },
      { cx: 76, cy: 128, rx: 14, ry: 18 },
    ],
    splatter: [{ cx: 56, cy: 88, r: 1.5 }, { cx: 56, cy: 112, r: 1.5 }],
  },
  ollama: {
    seed: 53, freq: 0.03, scale: 55,
    shapes: [
      { cx: 92, cy: 102, rx: 28, ry: 36 },
      { cx: 92, cy: 64, rx: 18, ry: 14 },
      { cx: 86, cy: 138, rx: 16, ry: 18 },
    ],
    splatter: [{ cx: 100, cy: 44, r: 2.5 }, { cx: 100, cy: 168, r: 2 }],
  },
  lmstudio: {
    seed: 67, freq: 0.026, scale: 60,
    shapes: [
      { cx: 90, cy: 100, rx: 30, ry: 38 },
      { cx: 76, cy: 100, rx: 12, ry: 28 },
    ],
    splatter: [{ cx: 100, cy: 52, r: 2 }, { cx: 100, cy: 148, r: 2 }],
  },
  custom: {
    seed: 89, freq: 0.05, scale: 95,
    shapes: [
      { cx: 92, cy: 100, rx: 24, ry: 28 },
    ],
    splatter: [{ cx: 100, cy: 50, r: 2 }, { cx: 100, cy: 150, r: 2 }, { cx: 60, cy: 100, r: 2 }, { cx: 140, cy: 100, r: 2 }],
  },
};

const ProviderBlot = ({ provider, accent, className }) => {
  const cfg = PROVIDER_BLOTS[provider];
  if (!cfg) return null;
  return (
    <span className={`blot ${className || ""}`} style={{ display: "inline-block", color: "var(--ink)" }}>
      <InkblotShape id={provider} accent={accent || "var(--rust)"} {...cfg} />
    </span>
  );
};

/* Brand mark — a smaller, more iconic Rorschach blot for the app logo */
const BrandMark = () => {
  const uid = React.useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true">
      <defs>
        <filter id={`brand-ink-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="60" />
        </filter>
        <clipPath id={`brand-clip-${uid}`}><rect x="0" y="0" width="101" height="200" /></clipPath>
        <g id={`brand-half-${uid}`}>
          <g clipPath={`url(#brand-clip-${uid})`} filter={`url(#brand-ink-${uid})`}>
            <ellipse cx="92" cy="100" rx="32" ry="48" fill="currentColor" />
            <ellipse cx="78" cy="72" rx="14" ry="14" fill="currentColor" />
            <ellipse cx="80" cy="134" rx="14" ry="16" fill="currentColor" />
          </g>
        </g>
      </defs>
      <use href={`#brand-half-${uid}`} />
      <use href={`#brand-half-${uid}`} transform="translate(200,0) scale(-1,1)" />
    </svg>
  );
};

/* Big atmospheric inkblot for hero/empty states */
const HeroBlot = ({ seed = 5 }) => (
  <svg viewBox="0 0 400 400" style={{ width: "100%", height: "100%" }} aria-hidden="true">
    <defs>
      <filter id={`hero-ink-${seed}`} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed={seed} />
        <feDisplacementMap in="SourceGraphic" scale="120" />
      </filter>
      <clipPath id={`hero-clip-${seed}`}><rect x="0" y="0" width="201" height="400" /></clipPath>
      <g id={`hero-half-${seed}`}>
        <g clipPath={`url(#hero-clip-${seed})`} filter={`url(#hero-ink-${seed})`}>
          <ellipse cx="180" cy="200" rx="60" ry="100" fill="currentColor" />
          <ellipse cx="160" cy="140" rx="28" ry="24" fill="currentColor" />
          <ellipse cx="160" cy="270" rx="32" ry="28" fill="currentColor" />
          <ellipse cx="120" cy="200" rx="14" ry="40" fill="currentColor" />
        </g>
      </g>
    </defs>
    <use href={`#hero-half-${seed}`} />
    <use href={`#hero-half-${seed}`} transform="translate(400,0) scale(-1,1)" />
  </svg>
);

window.ProviderBlot = ProviderBlot;
window.BrandMark = BrandMark;
window.HeroBlot = HeroBlot;
window.PROVIDER_BLOTS = PROVIDER_BLOTS;
