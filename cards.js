// cards.js — procedural symmetric inkblot generator.
//
// TWO modes:
//   • "blot"  — single organic body (classic Rorschach card)
//   • "mask"  — multi-component composition (central spine, eye-blobs,
//               cheek lobes, mouth band, satellite specks). Suggests a
//               face when read symmetrically. All parts are mirrored
//               across x=0 so the silhouette is always bilateral.
//
// Each card returns an array of "parts", each part has its own ring of
// points and a closed bezier path. We morph parts independently and
// composite them with a single ink filter for cohesion.

(function () {
  function rng(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function smoothClosedPath(pts) {
    const n = pts.length;
    if (n < 3) return "";
    const tension = 0.22;
    let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)} `;
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      const c1x = p1[0] + (p2[0] - p0[0]) * tension;
      const c1y = p1[1] + (p2[1] - p0[1]) * tension;
      const c2x = p2[0] - (p3[0] - p1[0]) * tension;
      const c2y = p2[1] - (p3[1] - p1[1]) * tension;
      d += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} `;
    }
    return d + "Z";
  }

  // Generate an organic ring of N points symmetric across x=0.
  // Centered on (cx, cy), radii scaled by (rx, ry).
  function makeSymmetricRing(seed, opts) {
    const r = rng(seed);
    const HALF = opts.halfPoints ?? 7;
    const cx = opts.cx ?? 0;
    const cy = opts.cy ?? 0;
    const rx = opts.rx ?? 100;
    const ry = opts.ry ?? 100;
    const variance = opts.variance ?? 0.35;
    const wobOctaves = opts.wobOctaves ?? 3;
    const tipTaper = opts.tipTaper ?? 0.7;
    const onAxisOnly = opts.onAxisOnly; // if true, top/bottom snap exactly to x=0

    const right = [];
    for (let i = 0; i < HALF; i++) {
      const t = i / (HALF - 1);
      const theta = Math.PI / 2 - t * Math.PI;
      let wob = 0;
      const seedOff = r() * 6.28;
      for (let o = 1; o <= wobOctaves; o++) {
        wob += Math.sin(t * Math.PI * (1 + o * 1.7) + seedOff + o) * (1 / o);
      }
      wob += (r() - 0.5) * 0.5;
      let radFactor = Math.max(0.1, 1 + wob * variance);
      if (i === 0 || i === HALF - 1) radFactor *= tipTaper * (0.85 + r() * 0.3);
      right.push([
        cx + Math.cos(theta) * rx * radFactor,
        cy + -Math.sin(theta) * ry * radFactor,
      ]);
    }
    if (onAxisOnly) {
      right[0][0] = cx;
      right[HALF - 1][0] = cx;
    }
    const left = [];
    for (let i = HALF - 1; i >= 0; i--) {
      const [x, y] = right[i];
      if (i === 0 || i === HALF - 1) continue;
      left.push([2 * cx - x, y]);
    }
    return right.concat(left);
  }

  // BLOT card — single body, lots of edge wobble.
  function makeBlotCard(seed, i) {
    const r = rng(seed);
    const baseR = 175 + (i % 3) * 12;
    const points = makeSymmetricRing(seed, {
      halfPoints: 9,
      cx: 0, cy: 0,
      rx: baseR * (0.85 + ((i * 0.13) % 0.45)),
      ry: baseR * (0.85 + ((i * 0.19) % 0.45)),
      variance: 0.4 + ((i * 0.04) % 0.3),
      wobOctaves: 3,
      tipTaper: 0.7,
      onAxisOnly: true,
    });
    const speckCount = Math.floor(r() * 3);
    const specks = [];
    for (let s = 0; s < speckCount; s++) {
      const sx = baseR * (0.9 + r() * 0.6);
      const sy = (r() - 0.5) * baseR * 1.6;
      const sr = baseR * (0.06 + r() * 0.12);
      specks.push({ cx: sx, cy: sy, r: sr });
      specks.push({ cx: -sx, cy: sy, r: sr });
    }
    return {
      mode: "blot",
      seed,
      parts: [{
        points,
        path: smoothClosedPath(points),
      }],
      specks,
    };
  }

  // MASK card — multi-component face composition.
  //
  // Layout (in svg-ish units, blot centered at 0,0):
  //   • Central spine: tall narrow body running -300..+300 on Y, ~80 wide.
  //     Acts like a vertical "nose ridge". Always present.
  //   • Eye region: two horizontal lobes near y = -90..-30, offset ±x.
  //   • Cheek region: two diagonal lobes at y = +40..+140, offset ±x further out.
  //   • Mouth band: narrow horizontal smear at y = +180..+220.
  //   • Specks: small flanking dots.
  //
  // Each card varies the proportions, intensity, connectedness.
  function makeMaskCard(seed, i) {
    const r = rng(seed);
    // Per-card style variations
    const eyeY    = -90 - r() * 30;          // -90..-120
    const eyeRx   = 95 + r() * 35;           //  95..130
    const eyeRy   = 55 + r() * 25;           //  55..80
    const eyeOff  = 95 + r() * 30;           //  95..125 (distance from axis)
    const cheekY  = 70 + r() * 50;           //  70..120
    const cheekRx = 85 + r() * 40;           //  85..125
    const cheekRy = 70 + r() * 35;           //  70..105
    const cheekOff = 130 + r() * 35;         // 130..165
    const mouthY  = 200 + r() * 30;          // 200..230
    const mouthRx = 160 + r() * 80;          // 160..240
    const mouthRy = 18 + r() * 22;           //  18..40
    const spineH  = 280 + r() * 60;          // half-height of central spine
    const spineW  = 55 + r() * 35;           //  55..90 wide (half-width)
    const browY   = -210 - r() * 40;
    const browRx  = 100 + r() * 60;
    const browRy  = 32 + r() * 20;
    const browOff = 70 + r() * 20;

    const parts = [];

    // 1. Central spine — taller ellipse with wobble
    parts.push(buildPart(seed + 11, {
      halfPoints: 11,
      cx: 0, cy: 0,
      rx: spineW, ry: spineH,
      variance: 0.42,
      wobOctaves: 4,
      tipTaper: 0.55,
      onAxisOnly: true,
    }));

    // 2. Brow band (one connected horizontal lobe across the top)
    parts.push(buildPart(seed + 22, {
      halfPoints: 9,
      cx: 0, cy: browY,
      rx: browOff + browRx * 0.6, ry: browRy,
      variance: 0.6,
      wobOctaves: 4,
      tipTaper: 0.4,
      onAxisOnly: true,
    }));

    // 3. Eye lobes — left + right
    parts.push(buildPart(seed + 33, {
      halfPoints: 8,
      cx: eyeOff, cy: eyeY,
      rx: eyeRx, ry: eyeRy,
      variance: 0.5,
      wobOctaves: 3,
      tipTaper: 0.55,
    }));
    parts.push(mirrorPart(parts[parts.length - 1]));

    // 4. Cheek lobes — diagonal flanks
    parts.push(buildPart(seed + 44, {
      halfPoints: 8,
      cx: cheekOff, cy: cheekY,
      rx: cheekRx, ry: cheekRy,
      variance: 0.55,
      wobOctaves: 3,
      tipTaper: 0.55,
    }));
    parts.push(mirrorPart(parts[parts.length - 1]));

    // 5. Mouth band — wide thin smear
    parts.push(buildPart(seed + 55, {
      halfPoints: 11,
      cx: 0, cy: mouthY,
      rx: mouthRx, ry: mouthRy,
      variance: 0.7,
      wobOctaves: 4,
      tipTaper: 0.35,
      onAxisOnly: true,
    }));

    // Speckles around the rim
    const specks = [];
    const sN = 2 + Math.floor(r() * 3);
    for (let k = 0; k < sN; k++) {
      const sx = 180 + r() * 80;
      const sy = -180 + r() * 360;
      const sr = 6 + r() * 14;
      specks.push({ cx: sx, cy: sy, r: sr });
      specks.push({ cx: -sx, cy: sy, r: sr });
    }

    return {
      mode: "mask",
      seed,
      parts,
      specks,
    };
  }

  function buildPart(seed, opts) {
    const points = makeSymmetricRing(seed, opts);
    return { points, path: smoothClosedPath(points) };
  }
  function mirrorPart(part) {
    const pts = part.points.map(([x, y]) => [-x, y]);
    return { points: pts, path: smoothClosedPath(pts) };
  }

  function lerpPoints(a, b, t) {
    const out = [];
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
      out.push([a[i][0] + (b[i][0] - a[i][0]) * t, a[i][1] + (b[i][1] - a[i][1]) * t]);
    }
    return out;
  }

  function pulsePoints(pts, amplitude, phase, intensity = 0.14) {
    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const factor = 1 + amplitude * intensity * (0.7 + 0.3 * Math.sin(phase * 2 + i * 0.7));
      out[i] = [x * factor, y * factor];
    }
    return out;
  }

  // Idle drift — micro wobble independent of voice, for "always alive" feel.
  function driftPoints(pts, phase, magnitude = 1.5) {
    const out = new Array(pts.length);
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const dx = Math.sin(phase * 0.7 + i * 0.9) * magnitude;
      const dy = Math.cos(phase * 0.6 + i * 1.3) * magnitude * 0.7;
      out[i] = [x + dx, y + dy];
    }
    return out;
  }

  function buildDeck(count = 10, mode = "mask") {
    const cards = [];
    const seedOffsets = [3, 17, 41, 73, 97, 131, 167, 211, 257, 313];
    for (let i = 0; i < count; i++) {
      const seed = seedOffsets[i % seedOffsets.length] + i * 1009;
      cards.push(mode === "mask" ? makeMaskCard(seed, i) : makeBlotCard(seed, i));
    }
    return cards;
  }

  window.Inkblot = {
    rng,
    smoothClosedPath,
    buildDeck,
    lerpPoints,
    pulsePoints,
    driftPoints,
  };
})();
