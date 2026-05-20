import * as I from './indices.js';

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function perpDist(point, lineA, lineB) {
  const dx = lineB.x - lineA.x;
  const dy = lineB.y - lineA.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return 0;
  return Math.abs((dy * point.x - dx * point.y + lineB.x * lineA.y - lineB.y * lineA.x) / len);
}

function browAngleDeg(inner, outer) {
  const dx = Math.abs(outer.x - inner.x);
  const dy = inner.y - outer.y; // positive = outer is higher than inner
  return Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
}

export function calculateMeasurements(lms) {
  if (!lms || lms.length < 468) return null;

  const g = (i) => lms[i];

  const faceH = dist(g(I.FACE_TOP), g(I.FACE_CHIN));
  if (faceH === 0) return null;

  // Convert any distance to % of face height, 1 decimal place
  const pct = (d) => Math.round((d / faceH) * 1000) / 10;

  // Midpoint between brow peaks = proxy for brow line
  const browMidY = (g(I.L_BROW_PEAK).y + g(I.R_BROW_PEAK).y) / 2;
  const browMidX = (g(I.L_BROW_PEAK).x + g(I.R_BROW_PEAK).x) / 2;
  const browLinePoint = { x: browMidX, y: browMidY };

  const lBrowArch = perpDist(g(I.L_BROW_PEAK), g(I.L_BROW_OUTER), g(I.L_BROW_INNER));
  const rBrowArch = perpDist(g(I.R_BROW_PEAK), g(I.R_BROW_OUTER), g(I.R_BROW_INNER));

  return {
    // Face
    faceRatio:    Math.round((dist(g(I.FACE_L_CHEEK), g(I.FACE_R_CHEEK)) / faceH) * 100) / 100,
    cheekWidth:   pct(dist(g(I.FACE_L_CHEEK), g(I.FACE_R_CHEEK))),

    // Forehead
    foreheadH:    pct(dist(g(I.FACE_TOP), browLinePoint)),
    interBrow:    pct(dist(g(I.L_BROW_INNER), g(I.R_BROW_INNER))),

    // Eyebrows
    lBrowLen:     pct(dist(g(I.L_BROW_OUTER), g(I.L_BROW_INNER))),
    rBrowLen:     pct(dist(g(I.R_BROW_OUTER), g(I.R_BROW_INNER))),
    lBrowArch:    pct(lBrowArch),
    rBrowArch:    pct(rBrowArch),
    lBrowAngle:   browAngleDeg(g(I.L_BROW_INNER), g(I.L_BROW_OUTER)),
    rBrowAngle:   browAngleDeg(g(I.R_BROW_INNER), g(I.R_BROW_OUTER)),

    // Eyes
    lEyeWidth:    pct(dist(g(I.L_EYE_OUTER), g(I.L_EYE_INNER))),
    rEyeWidth:    pct(dist(g(I.R_EYE_INNER), g(I.R_EYE_OUTER))),
    lEyeOpen:     pct(dist(g(I.L_EYE_TOP), g(I.L_EYE_BOT))),
    rEyeOpen:     pct(dist(g(I.R_EYE_TOP), g(I.R_EYE_BOT))),
    interEye:     pct(dist(g(I.L_EYE_INNER), g(I.R_EYE_INNER))),

    // Nose
    noseWidth:    pct(dist(g(I.NOSE_L_WING), g(I.NOSE_R_WING))),
    noseLen:      pct(dist(g(I.NOSE_BRIDGE), g(I.NOSE_TIP))),

    // Lips
    mouthWidth:   pct(dist(g(I.MOUTH_L), g(I.MOUTH_R))),
    upperLipH:    pct(dist(g(I.UPPER_LIP_TOP), g(I.UPPER_LIP_BOT))),
    lowerLipH:    pct(dist(g(I.LOWER_LIP_TOP), g(I.LOWER_LIP_BOT))),

    // Jaw
    jawWidth:     pct(dist(g(I.FACE_L_JAW), g(I.FACE_R_JAW))),
    jawRatio:     Math.round((dist(g(I.FACE_L_JAW), g(I.FACE_R_JAW)) / dist(g(I.FACE_L_CHEEK), g(I.FACE_R_CHEEK))) * 100),

    // Eye color (populated separately by sampleEyeColors)
    lEyeColor:    null,
    rEyeColor:    null,
  };
}

// ── Eye colour sampling ────────────────────────────────────────────────────────
// Camera white balance shifts all colours warm (R > G > B even for blue irises).
// We normalise against the sclera to cancel the camera's warm cast.
// Each eye's ratio is noisy independently, so we pool BOTH eyes' smoothed ratios
// before classifying. One reliable eye outweighs one noisy eye in the average.

const offscreen = document.createElement('canvas');
const offCtx    = offscreen.getContext('2d', { willReadFrequently: true });

const EYE_EMA = 0.45; // higher = faster convergence (~4 samples to 95%)
function makeSlot() { return { relR: null, relG: null, relB: null }; }
const eyeSlots = [makeSlot(), makeSlot()]; // [left, right]

export function resetEyeColorState() {
  eyeSlots[0] = makeSlot();
  eyeSlots[1] = makeSlot();
}

export function sampleEyeColors(video, lms) {
  if (!lms || lms.length < 478) return null;

  offscreen.width  = video.videoWidth;
  offscreen.height = video.videoHeight;
  offCtx.drawImage(video, 0, 0);

  const vw = video.videoWidth;
  const vh = video.videoHeight;

  // Update each eye's smoothed slot; return the sampled hex colour
  const processEye = (slotIdx, centerIdx, rimIdxs, innerIdx, outerIdx) => {
    const cLm    = lms[centerIdx];
    const rimLms = rimIdxs.map(i => lms[i]);

    const irisR = Math.max(
      rimLms.reduce((s, r) =>
        s + Math.hypot((r.x - cLm.x) * vw, (r.y - cLm.y) * vh), 0
      ) / rimLms.length,
      6
    );

    const iris = sampleDisc(cLm.x * vw, cLm.y * vh, irisR * 0.30, irisR * 0.75, vw, vh);
    if (!iris) return null;

    const innerLm = lms[innerIdx];
    const outerLm = lms[outerIdx];
    const sc1 = sampleDisc(((innerLm.x + cLm.x) / 2) * vw, cLm.y * vh, 0, 6, vw, vh);
    const sc2 = sampleDisc(((outerLm.x + cLm.x) / 2) * vw, cLm.y * vh, 0, 6, vw, vh);
    const lumOf = s => s ? s.R + s.G + s.B : 0;
    const sclera = lumOf(sc1) >= lumOf(sc2) ? sc1 : sc2;

    if (sclera && sclera.R > 30 && sclera.G > 15 && sclera.B > 10) {
      const rR = iris.R / sclera.R;
      const rG = iris.G / sclera.G;
      const rB = iris.B / sclera.B;
      const slot = eyeSlots[slotIdx];
      const ema  = (p, n) => p === null ? n : p * (1 - EYE_EMA) + n * EYE_EMA;
      slot.relR = ema(slot.relR, rR);
      slot.relG = ema(slot.relG, rG);
      slot.relB = ema(slot.relB, rB);
    }

    return toHex(iris.R, iris.G, iris.B);
  };

  const leftHex  = processEye(0, I.L_IRIS, I.L_IRIS_RIM, I.L_EYE_INNER, I.L_EYE_OUTER);
  const rightHex = processEye(1, I.R_IRIS, I.R_IRIS_RIM, I.R_EYE_INNER, I.R_EYE_OUTER);

  // Classify once from the POOLED average of both eyes' smoothed ratios.
  // A noisy eye and a clear eye average out; one reliable eye is enough to win.
  const name = classifyFromPooledSlots();
  console.log(`[pool] relR=${pooled().relR?.toFixed(3)} relG=${pooled().relG?.toFixed(3)} relB=${pooled().relB?.toFixed(3)} → ${name}`);

  return {
    left:  leftHex  ? { hex: leftHex,  name } : null,
    right: rightHex ? { hex: rightHex, name } : null,
  };
}

function pooled() {
  const [s0, s1] = eyeSlots;
  const has0 = s0.relR !== null, has1 = s1.relR !== null;
  if (has0 && has1) return {
    relR: (s0.relR + s1.relR) / 2,
    relG: (s0.relG + s1.relG) / 2,
    relB: (s0.relB + s1.relB) / 2,
  };
  if (has0) return s0;
  if (has1) return s1;
  return {};
}

function classifyFromPooledSlots() {
  const { relR, relG, relB } = pooled();
  if (relR === undefined) return 'unknown';
  if (relB >= relR && relB >= relG) return 'blue';
  if (relG >  relR && relG >  relB) return 'green';
  if (relG >  relB && relG > relR - 0.03) return 'hazel';
  return 'brown';
}

// Sample an annular region (innerR < d < outerR), skipping very dark pixels.
// Returns { R, G, B, n } or null.
function sampleDisc(cx, cy, innerR, outerR, vw, vh) {
  const x0 = Math.max(0, Math.floor(cx - outerR));
  const y0 = Math.max(0, Math.floor(cy - outerR));
  const x1 = Math.min(vw, Math.ceil(cx + outerR));
  const y1 = Math.min(vh, Math.ceil(cy + outerR));
  const pw = x1 - x0, ph = y1 - y0;
  if (pw <= 0 || ph <= 0) return null;

  const data = offCtx.getImageData(x0, y0, pw, ph).data;
  let R = 0, G = 0, B = 0, n = 0;

  for (let py = 0; py < ph; py++) {
    for (let px = 0; px < pw; px++) {
      const d = Math.hypot(px + x0 - cx, py + y0 - cy);
      if (d < innerR || d > outerR) continue;
      const idx = (py * pw + px) * 4;
      const pr = data[idx], pg = data[idx + 1], pb = data[idx + 2];
      if (pr + pg + pb < 90) continue; // skip very dark (pupil / lashes)
      R += pr; G += pg; B += pb; n++;
    }
  }

  if (n < 4) return null;
  return { R: Math.round(R / n), G: Math.round(G / n), B: Math.round(B / n), n };
}

function toHex(r, g, b) {
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}
