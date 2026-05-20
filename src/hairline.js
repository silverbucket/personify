// Hairline detection via pixel-scanning upward from the face oval top band.
// The MediaPipe 478-point model has no hairline landmarks, so we find the
// skin→hair transition by comparing pixel luminance/colour to a forehead skin reference.

import { L_BROW_PEAK, R_BROW_PEAK, NOSE_TIP, BROW_MID, FACE_TOP, FACE_CHIN } from './indices.js';

// Module-level offscreen canvas (separate from the one in measurements.js)
const offscreen = document.createElement('canvas');
const offCtx    = offscreen.getContext('2d', { willReadFrequently: true });

// Landmark indices for the top forehead band, left to right across the face.
// Chosen from the face oval top arc to span left temple → centre → right temple.
const TOP_BAND_INDICES = [127, 103, 67, 10, 297, 332, 356];

function luminance(r, g, b) {
  // Perceived luminance (BT.601)
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function rgbDist(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

// Sample a small rectangular region and return the average RGB, or null.
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

/**
 * detectHairline(video, lms)
 * Returns { height, shape, confidence, points } or null.
 *
 * height      — distance from brow line to hairline as % of face height
 * shape       — 'widowsPeak' | 'mShape' | 'receding' | 'straight' | 'uneven'
 * confidence  — 0–100 integer (fraction of scan columns that found a transition)
 * points      — array of { x, y } in normalised 0-1 coordinates
 */
export function detectHairline(video, lms) {
  if (!lms || lms.length < 468) return null;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  // Draw current video frame into the offscreen canvas
  offscreen.width  = vw;
  offscreen.height = vh;
  offCtx.drawImage(video, 0, 0);

  const g = (i) => lms[i];

  // ── Face metrics ─────────────────────────────────────────────────────────────
  const faceTopY  = g(FACE_TOP).y;
  const faceChinY = g(FACE_CHIN).y;
  const faceH     = faceChinY - faceTopY; // normalised
  if (faceH <= 0) return null;

  // ── Skin reference: 10×10 patch at midpoint between BROW_MID (9) and NOSE_TIP (4) ──
  const refNormX = (g(BROW_MID).x + g(NOSE_TIP).x) / 2;
  const refNormY = (g(BROW_MID).y + g(NOSE_TIP).y) / 2;
  const refPx    = refNormX * vw;
  const refPy    = refNormY * vh;
  const skinSample = sampleRect(refPx - 5, refPy - 5, 10, 10);
  if (!skinSample) return null;

  const skinR   = skinSample.r;
  const skinG   = skinSample.g;
  const skinB   = skinSample.b;
  const skinLum = luminance(skinR, skinG, skinB);
  if (skinLum < 10) return null; // too dark to be a reliable reference

  // ── Scan columns ─────────────────────────────────────────────────────────────
  // For each landmark in TOP_BAND_INDICES, start scanning from its y position
  // upward, looking for the skin→hair transition.

  const faceHpx     = faceH * vh;              // face height in pixels
  const maxScanPx   = faceHpx * 0.25;          // scan up to 25% of face height above start
  const LUMA_THRESH = 0.25;                    // luminance drop fraction
  const COL_THRESH  = 40;                      // Euclidean RGB distance threshold

  // Brow line y (normalised) — midpoint of left and right brow peaks
  const browY = (g(L_BROW_PEAK).y + g(R_BROW_PEAK).y) / 2;

  const foundPoints = []; // { normX, normY } for each column (nulls excluded)
  const allY        = []; // parallel to TOP_BAND_INDICES; null if not found

  for (const idx of TOP_BAND_INDICES) {
    const lm    = g(idx);
    const normX = lm.x;
    const startNormY = lm.y;

    const px    = normX * vw;
    const startY = startNormY * vh;

    let foundNormY = null;

    for (let dy = 0; dy <= maxScanPx; dy++) {
      const py = startY - dy;
      if (py < 0) break;

      // Sample a 3-pixel-wide column at this y
      const sample = sampleRect(px - 1, py - 0.5, 3, 1);
      if (!sample) continue;

      const lum  = luminance(sample.r, sample.g, sample.b);
      const lumDrop = skinLum > 0 ? (skinLum - lum) / skinLum : 0;
      const colDist = rgbDist(sample.r, sample.g, sample.b, skinR, skinG, skinB);

      if (lumDrop > LUMA_THRESH || colDist > COL_THRESH) {
        foundNormY = py / vh;
        break;
      }
    }

    allY.push(foundNormY);

    if (foundNormY !== null) {
      foundPoints.push({ x: normX, y: foundNormY });
    }
  }

  // ── Confidence ───────────────────────────────────────────────────────────────
  const numFound  = foundPoints.length;
  const confidence = Math.round((numFound / TOP_BAND_INDICES.length) * 100);

  if (numFound < 4) return null;

  // ── Height ───────────────────────────────────────────────────────────────────
  // Average hairline y (normalised), then compute distance from brow line.
  const avgHairlineY = foundPoints.reduce((s, p) => s + p.y, 0) / foundPoints.length;
  // In normalised coords, smaller y = higher on screen = higher up the head.
  // Forehead height = browY - avgHairlineY (positive when hairline is above brow).
  const heightNorm   = browY - avgHairlineY;
  const height       = Math.round((heightNorm / faceH) * 1000) / 10; // % of face height

  // ── Shape classification ──────────────────────────────────────────────────────
  // allY has 7 entries corresponding to TOP_BAND_INDICES [127,103,67,10,297,332,356].
  // Left third: indices 0,1,2 → landmarks 127,103,67
  // Centre:     indices 2,3,4 → landmarks 67,10,297  (overlap intentional for 7-point case)
  // Right third: indices 4,5,6 → landmarks 297,332,356
  // Use index groups: left=[0,1,2], centre=[2,3,4], right=[4,5,6]

  const avgGroup = (indices) => {
    const vals = indices.map(i => allY[i]).filter(v => v !== null);
    if (vals.length === 0) return null;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  const leftAvg   = avgGroup([0, 1, 2]);
  const centreAvg = avgGroup([2, 3, 4]);
  const rightAvg  = avgGroup([4, 5, 6]);

  let shape = 'uneven';

  if (leftAvg !== null && centreAvg !== null && rightAvg !== null) {
    // In normalised coords: LOWER y value = HIGHER on the head = hairline comes DOWN more.
    // "Centre dips toward forehead" means centreAvg > leftAvg and centreAvg > rightAvg
    // (larger y = lower on screen = closer to forehead).
    const centreVsLeft  = (centreAvg - leftAvg)  / faceH;
    const centreVsRight = (centreAvg - rightAvg) / faceH;
    const leftVsCentre  = (leftAvg  - centreAvg) / faceH;
    const rightVsCentre = (rightAvg - centreAvg) / faceH;

    const heightPct = heightNorm / faceH; // 0–1 fraction

    if (centreVsLeft > 0.08 && centreVsRight > 0.08) {
      // Centre hairline is significantly lower (closer to forehead) than both sides
      shape = 'widowsPeak';
    } else if (leftVsCentre > 0.05 && rightVsCentre > 0.05) {
      // Left and right are lower (temple regions come forward)
      shape = 'mShape';
    } else if (heightPct < 0.15) {
      // All positions are very high — small forehead, could be receding
      shape = 'receding';
    } else {
      // Check if sides and centre are within 4% of each other
      const spread = Math.max(
        Math.abs(centreAvg - leftAvg),
        Math.abs(centreAvg - rightAvg),
        Math.abs(leftAvg   - rightAvg),
      ) / faceH;
      shape = spread <= 0.04 ? 'straight' : 'uneven';
    }
  }

  return {
    height,
    shape,
    confidence,
    points: foundPoints,
  };
}

/**
 * resetHairlineState()
 * Reserved for future smoothing state; currently a no-op.
 */
export function resetHairlineState() {
  // no-op
}
