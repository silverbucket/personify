import {
  L_BROW_PEAK, R_BROW_PEAK,
  L_BROW_OUTER, R_BROW_OUTER,
  BROW_MID, FACE_TOP, FACE_CHIN,
} from './indices.js';

const offscreen = document.createElement('canvas');
const offCtx    = offscreen.getContext('2d', { willReadFrequently: true });

function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function rgbDist(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function sampleRect(x0, y0, w, h) {
  const cw = offscreen.width;
  const ch = offscreen.height;
  const sx = Math.max(0, Math.round(x0));
  const sy = Math.max(0, Math.round(y0));
  const ex = Math.min(cw, Math.round(x0 + w));
  const ey = Math.min(ch, Math.round(y0 + h));
  const pw = ex - sx;
  const ph = ey - sy;
  if (pw <= 0 || ph <= 0) return null;

  const data = offCtx.getImageData(sx, sy, pw, ph).data;
  let R = 0, G = 0, B = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    R += data[i]; G += data[i + 1]; B += data[i + 2]; n++;
  }
  if (n === 0) return null;
  return { r: R / n, g: G / n, b: B / n };
}

const NUM_COLS = 7;

/**
 * detectHairline(video, lms)
 * Returns { height, shape, confidence, points } or null.
 */
export function detectHairline(video, lms) {
  if (!lms || lms.length < 468) return null;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  offscreen.width  = vw;
  offscreen.height = vh;
  offCtx.drawImage(video, 0, 0);

  const g = (i) => lms[i];

  const faceTopY  = g(FACE_TOP).y;
  const faceChinY = g(FACE_CHIN).y;
  const faceH     = faceChinY - faceTopY;
  if (faceH <= 0) return null;

  const faceHpx = faceH * vh;

  // Brow midpoint: consistent scan start for all columns.
  const browY  = (g(L_BROW_PEAK).y + g(R_BROW_PEAK).y) / 2;
  const browMX = (g(L_BROW_PEAK).x + g(R_BROW_PEAK).x) / 2;

  // Skin reference: 24×10 patch at mid-forehead (between brow peaks and BROW_MID).
  const refNormY   = (browY + g(BROW_MID).y) / 2;
  const skinSample = sampleRect(browMX * vw - 12, refNormY * vh - 5, 24, 10);
  if (!skinSample) return null;

  const { r: skinR, g: skinG, b: skinB } = skinSample;
  const skinLum = luminance(skinR, skinG, skinB);
  if (skinLum < 15) return null;

  // Columns: 7 evenly spaced across the brow outer-point span.
  // This keeps every column in the forehead region and avoids the cheek/temple
  // level where the original face-oval side landmarks (127, 356) sat — which caused
  // the scan to pass through the eyebrow region and mistake it for hair.
  const xL = g(L_BROW_OUTER).x;
  const xR = g(R_BROW_OUTER).x;
  const colXs = Array.from({ length: NUM_COLS }, (_, i) =>
    xL + (xR - xL) * i / (NUM_COLS - 1)
  );

  // Skip zone: first 8% of face height above the brow line is still the eyebrow /
  // brow shadow area. Only start detection after clearing that.
  const skipPx = faceHpx * 0.08;
  // Search up to 50% of face height above the brow (covers even very high hairlines).
  const maxScanPx = faceHpx * 0.50;

  const LUMA_THRESH   = 0.18;
  const COL_THRESH    = 32;
  const CONSEC_NEEDED = 2;

  const foundPoints = [];
  const allY        = [];

  for (let ci = 0; ci < NUM_COLS; ci++) {
    const normX  = colXs[ci];
    const px     = normX * vw;
    const startY = browY * vh;

    let foundNormY  = null;
    let consecCount = 0;
    let candidateY  = null;

    for (let dy = Math.ceil(skipPx); dy <= maxScanPx; dy++) {
      const py = startY - dy;
      if (py < 0) break;

      const sample = sampleRect(px - 3, py - 0.5, 7, 1);
      if (!sample) { consecCount = 0; candidateY = null; continue; }

      const lum     = luminance(sample.r, sample.g, sample.b);
      const lumDrop = skinLum > 0 ? (skinLum - lum) / skinLum : 0;
      const colDist = rgbDist(sample.r, sample.g, sample.b, skinR, skinG, skinB);

      if (lumDrop > LUMA_THRESH || colDist > COL_THRESH) {
        if (consecCount === 0) candidateY = py;
        consecCount++;
        if (consecCount >= CONSEC_NEEDED) {
          foundNormY = candidateY / vh;
          break;
        }
      } else {
        consecCount = 0;
        candidateY  = null;
      }
    }

    allY.push(foundNormY);
    if (foundNormY !== null) {
      foundPoints.push({ x: normX, y: foundNormY });
    }
  }

  const numFound   = foundPoints.length;
  const confidence = Math.round((numFound / NUM_COLS) * 100);
  if (numFound < 4) return null;

  const avgHairlineY = foundPoints.reduce((s, p) => s + p.y, 0) / foundPoints.length;
  // browY − avgHairlineY: positive because hairline is above brow (smaller y).
  const heightNorm = browY - avgHairlineY;
  const height     = Math.round((heightNorm / faceH) * 1000) / 10;

  // ── Shape classification ───────────────────────────────────────────────────
  // All scans start from the same browY, so allY values are comparable directly.
  // In normalised y: LARGER value = lower on screen = hairline closer to the face.
  //
  // Widow's peak: centre hairline dips toward face → centreAvg > leftAvg & rightAvg.
  // M-shape:      temple hairline dips toward face → leftAvg & rightAvg > centreAvg.

  const avgGroup = (indices) => {
    const vals = indices.map(i => allY[i]).filter(v => v !== null);
    if (vals.length === 0) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  // Columns 0-1: left side, 2-3: centre-left, 3: centre, 3-4: centre-right, 5-6: right side
  const leftAvg   = avgGroup([0, 1, 2]);
  const centreAvg = avgGroup([2, 3, 4]);
  const rightAvg  = avgGroup([4, 5, 6]);

  let shape = 'uneven';

  if (leftAvg !== null && centreAvg !== null && rightAvg !== null) {
    const centreVsLeft  = (centreAvg - leftAvg)  / faceH;
    const centreVsRight = (centreAvg - rightAvg) / faceH;
    const leftVsCentre  = (leftAvg   - centreAvg) / faceH;
    const rightVsCentre = (rightAvg  - centreAvg) / faceH;

    if (centreVsLeft > 0.05 && centreVsRight > 0.05) {
      shape = 'widowsPeak';
    } else if (leftVsCentre > 0.04 && rightVsCentre > 0.04) {
      shape = 'mShape';
    } else {
      const spread = Math.max(
        Math.abs(centreAvg - leftAvg),
        Math.abs(centreAvg - rightAvg),
        Math.abs(leftAvg   - rightAvg),
      ) / faceH;
      shape = heightNorm / faceH < 0.15
        ? 'receding'
        : spread <= 0.04 ? 'straight' : 'uneven';
    }
  }

  return { height, shape, confidence, points: foundPoints };
}

export function resetHairlineState() {
  // no-op
}
