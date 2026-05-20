import { createLandmarker }                                    from './landmarker.js';
import { calculateMeasurements, sampleEyeColors, resetEyeColorState } from './measurements.js';
import { render }                                              from './renderer.js';
import { buildPanel, updatePanel }                             from './panel.js';

const video      = document.getElementById('video');
const canvas     = document.getElementById('overlay');
const ctx        = canvas.getContext('2d');
const camView    = document.getElementById('camera-view');
const statusEl   = document.getElementById('status');
const noFaceEl   = document.getElementById('no-face');
const panelEl    = document.getElementById('panel-content');

let landmarker   = null;
let panelRefs    = null;
let lastVideoTime = -1;
let frameCount   = 0;

// Smoothed measurement values (EMA)
const smoothed = {};
const ALPHA = 0.2;

// Last eye colours (updated at a low frame rate)
let eyeColors = null;

// ── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  setStatus('Loading model…');

  try {
    landmarker = await createLandmarker();
  } catch (err) {
    setStatus('Failed to load model');
    console.error(err);
    return;
  }

  setStatus('Requesting camera…');

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    video.srcObject = stream;
  } catch (err) {
    setStatus('Camera access denied');
    console.error(err);
    return;
  }

  panelRefs = buildPanel(panelEl);

  video.addEventListener('loadedmetadata', () => {
    syncCanvasSize();
    setStatus('');
  });

  window.addEventListener('resize', syncCanvasSize);

  requestAnimationFrame(detect);
}

// ── Canvas sizing ─────────────────────────────────────────────────────────────

function syncCanvasSize() {
  if (!video.videoWidth) return;
  // Keep canvas intrinsic size = video natural size for 1:1 landmark mapping
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;

  // Fit the camera view to the available space while preserving aspect ratio
  const aspect   = video.videoHeight / video.videoWidth;
  const maxH     = camView.clientHeight;
  const wantedH  = camView.clientWidth * aspect;
  const finalH   = Math.min(wantedH, maxH);
  const finalW   = finalH / aspect;

  video.style.width  = `${finalW}px`;
  video.style.height = `${finalH}px`;
  canvas.style.width  = `${finalW}px`;
  canvas.style.height = `${finalH}px`;
}

// ── Detection loop ────────────────────────────────────────────────────────────

function detect() {
  requestAnimationFrame(detect);

  if (!landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  frameCount++;

  const results = landmarker.detectForVideo(video, performance.now());
  const lms     = results.faceLandmarks?.[0];

  render(ctx, canvas, lms);

  // Update panel at ~10 fps (every 3rd frame at 30 fps)
  if (frameCount % 3 !== 0) return;

  if (!lms) {
    noFaceEl.classList.add('visible');
    setStatus('No face detected');
    updatePanel(panelRefs, null);
    Object.keys(smoothed).forEach(k => delete smoothed[k]);
    eyeColors = null;
    resetEyeColorState();
    return;
  }

  noFaceEl.classList.remove('visible');
  setStatus('');

  // Eye colour sampled every ~1 s (every 30th frame at 30 fps, but we run 10 fps here so every 10 calls)
  if (frameCount % 30 === 0) {
    eyeColors = sampleEyeColors(video, lms);
  }

  const raw = calculateMeasurements(lms);
  if (!raw) return;

  // Apply EMA smoothing to numeric fields
  for (const key in raw) {
    const v = raw[key];
    if (typeof v === 'number') {
      smoothed[key] = smoothed[key] !== undefined
        ? smoothed[key] * (1 - ALPHA) + v * ALPHA
        : v;
    } else {
      smoothed[key] = v;
    }
  }

  // Inject latest eye colours
  if (eyeColors) {
    smoothed.lEyeColor = eyeColors.left;
    smoothed.rEyeColor = eyeColors.right;
  }

  updatePanel(panelRefs, smoothed);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setStatus(text) {
  statusEl.textContent = text;
}

init();
