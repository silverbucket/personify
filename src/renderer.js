import * as I from './indices.js';
import { COLORS, FACE_OVAL_PTS, L_BROW_PTS, R_BROW_PTS, L_EYE_PTS, R_EYE_PTS } from './indices.js';

// ── Primitives ──────────────────────────────────────────────────────────────

function toCanvas(lm, cw, ch) {
  // landmarks are in 0-1 normalized coords; canvas may be any size
  return { x: lm.x * cw, y: lm.y * ch };
}

function polyline(ctx, pts, closed = false) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (closed) ctx.closePath();
  ctx.stroke();
}

function caliper(ctx, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const nx = (-dy / len) * 5;
  const ny = ( dx / len) * 5;

  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(a.x - nx, a.y - ny); ctx.lineTo(a.x + nx, a.y + ny);
  ctx.moveTo(b.x - nx, b.y - ny); ctx.lineTo(b.x + nx, b.y + ny);
  ctx.stroke();
}

function dot(ctx, p, r = 2.5) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
}

// ── Main render ─────────────────────────────────────────────────────────────

export function render(ctx, canvas, lms) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!lms || lms.length < 468) return;

  const cw = canvas.width;
  const ch = canvas.height;
  const G  = (i) => toCanvas(lms[i], cw, ch);
  const GP = (pts) => pts.map(i => G(i));

  // ── Face outline ──
  ctx.save();
  ctx.strokeStyle = COLORS.face;
  ctx.lineWidth   = 1;
  ctx.globalAlpha = 0.3;
  polyline(ctx, GP(FACE_OVAL_PTS), true);
  ctx.globalAlpha = 0.8;
  ctx.lineWidth   = 1.5;
  caliper(ctx, G(I.FACE_L_CHEEK), G(I.FACE_R_CHEEK));
  caliper(ctx, G(I.FACE_TOP), G(I.FACE_CHIN));
  ctx.restore();

  // ── Eyebrows ──
  ctx.save();
  ctx.strokeStyle = COLORS.brows;
  ctx.fillStyle   = COLORS.brows;
  ctx.lineWidth   = 1;
  ctx.globalAlpha = 0.35;
  polyline(ctx, GP(L_BROW_PTS), true);
  polyline(ctx, GP(R_BROW_PTS), true);
  ctx.globalAlpha = 0.85;
  ctx.lineWidth   = 1.5;
  // Length calipers
  caliper(ctx, G(I.L_BROW_OUTER), G(I.L_BROW_INNER));
  caliper(ctx, G(I.R_BROW_OUTER), G(I.R_BROW_INNER));
  // Inter-brow gap
  caliper(ctx, G(I.L_BROW_INNER), G(I.R_BROW_INNER));
  // Arch dashed lines (peak → chord midpoint)
  ctx.setLineDash([3, 4]);
  ctx.lineWidth = 1;
  const lMid = midPt(G(I.L_BROW_OUTER), G(I.L_BROW_INNER));
  const rMid = midPt(G(I.R_BROW_OUTER), G(I.R_BROW_INNER));
  ctx.beginPath();
  ctx.moveTo(G(I.L_BROW_PEAK).x, G(I.L_BROW_PEAK).y); ctx.lineTo(lMid.x, lMid.y);
  ctx.moveTo(G(I.R_BROW_PEAK).x, G(I.R_BROW_PEAK).y); ctx.lineTo(rMid.x, rMid.y);
  ctx.stroke();
  ctx.setLineDash([]);
  dot(ctx, G(I.L_BROW_PEAK), 2.5);
  dot(ctx, G(I.R_BROW_PEAK), 2.5);
  ctx.restore();

  // ── Eyes ──
  ctx.save();
  ctx.strokeStyle = COLORS.eyes;
  ctx.fillStyle   = COLORS.eyes;
  ctx.lineWidth   = 1;
  ctx.globalAlpha = 0.35;
  polyline(ctx, GP(L_EYE_PTS), true);
  polyline(ctx, GP(R_EYE_PTS), true);
  ctx.globalAlpha = 0.85;
  ctx.lineWidth   = 1.5;
  // Width calipers
  caliper(ctx, G(I.L_EYE_OUTER), G(I.L_EYE_INNER));
  caliper(ctx, G(I.R_EYE_INNER), G(I.R_EYE_OUTER));
  // Openness calipers
  caliper(ctx, G(I.L_EYE_TOP), G(I.L_EYE_BOT));
  caliper(ctx, G(I.R_EYE_TOP), G(I.R_EYE_BOT));
  // Inter-eye distance
  caliper(ctx, G(I.L_EYE_INNER), G(I.R_EYE_INNER));
  // Iris centres + sampling-circle debug ring
  if (lms.length >= 478) {
    dot(ctx, G(I.L_IRIS), 3.5);
    dot(ctx, G(I.R_IRIS), 3.5);

    // Draw the area that colour sampling actually reads from
    const irisCircle = (centerIdx, rimIdxs) => {
      const c = G(centerIdx);
      const rimR = rimIdxs.reduce((sum, ri) => {
        const r = G(ri);
        return sum + Math.hypot(r.x - c.x, r.y - c.y);
      }, 0) / rimIdxs.length;
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(rimR * 0.95, 6), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    };
    irisCircle(I.L_IRIS, I.L_IRIS_RIM);
    irisCircle(I.R_IRIS, I.R_IRIS_RIM);
  }
  ctx.restore();

  // ── Nose ──
  ctx.save();
  ctx.strokeStyle = COLORS.nose;
  ctx.fillStyle   = COLORS.nose;
  ctx.lineWidth   = 1.5;
  ctx.globalAlpha = 0.85;
  caliper(ctx, G(I.NOSE_BRIDGE), G(I.NOSE_TIP));
  caliper(ctx, G(I.NOSE_L_WING), G(I.NOSE_R_WING));
  dot(ctx, G(I.NOSE_TIP), 3);
  ctx.restore();

  // ── Lips ──
  ctx.save();
  ctx.strokeStyle = COLORS.lips;
  ctx.lineWidth   = 1.5;
  ctx.globalAlpha = 0.85;
  caliper(ctx, G(I.MOUTH_L), G(I.MOUTH_R));
  caliper(ctx, G(I.UPPER_LIP_TOP), G(I.UPPER_LIP_BOT));
  caliper(ctx, G(I.LOWER_LIP_TOP), G(I.LOWER_LIP_BOT));
  ctx.restore();

  // ── Jaw ──
  ctx.save();
  ctx.strokeStyle = COLORS.jaw;
  ctx.lineWidth   = 1.5;
  ctx.globalAlpha = 0.85;
  caliper(ctx, G(I.FACE_L_JAW), G(I.FACE_R_JAW));
  ctx.restore();
}

function midPt(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ── Hairline overlay ─────────────────────────────────────────────────────────

const HAIRLINE_COLOR = '#a78bfa';

/**
 * renderHairline(ctx, canvas, hairlineResult)
 * Draws detected hairline points and a connecting polyline.
 * hairlineResult is the object returned by detectHairline(), or null.
 */
export function renderHairline(ctx, canvas, hairlineResult) {
  if (!hairlineResult || !hairlineResult.points || hairlineResult.points.length < 2) return;

  const cw = canvas.width;
  const ch = canvas.height;

  const pts = hairlineResult.points.map(p => ({ x: p.x * cw, y: p.y * ch }));

  ctx.save();

  // Connecting polyline at 40% opacity
  ctx.strokeStyle  = HAIRLINE_COLOR;
  ctx.lineWidth    = 1.5;
  ctx.globalAlpha  = 0.4;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();

  // Dots at each point at full opacity
  ctx.fillStyle   = HAIRLINE_COLOR;
  ctx.globalAlpha = 1;
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
