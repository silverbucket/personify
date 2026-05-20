// MediaPipe FaceLandmarker landmark indices (478-point model: 468 face + 10 iris)

// Face extremes
export const FACE_TOP     = 10;
export const FACE_CHIN    = 152;
export const FACE_L_CHEEK = 234;   // widest left point
export const FACE_R_CHEEK = 454;   // widest right point
export const FACE_L_JAW   = 172;   // lower jaw left
export const FACE_R_JAW   = 397;   // lower jaw right
export const BROW_MID     = 9;     // center forehead between brows

// Left eyebrow  (face's left; image's right in a mirrored/selfie view)
// Landmark loop: 46-53-52-65-55-70-63-105-66-107-46
export const L_BROW_OUTER = 46;
export const L_BROW_INNER = 107;
export const L_BROW_PEAK  = 105;
export const L_BROW_PTS   = [46, 53, 52, 65, 55, 70, 63, 105, 66, 107];

// Right eyebrow
// Landmark loop: 276-283-282-295-285-300-293-334-296-336-276
export const R_BROW_OUTER = 276;
export const R_BROW_INNER = 336;
export const R_BROW_PEAK  = 334;
export const R_BROW_PTS   = [276, 283, 282, 295, 285, 300, 293, 334, 296, 336];

// Left eye
export const L_EYE_OUTER = 33;
export const L_EYE_INNER = 133;
export const L_EYE_TOP   = 159;
export const L_EYE_BOT   = 145;
export const L_EYE_PTS   = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];

// Right eye
export const R_EYE_INNER = 362;
export const R_EYE_OUTER = 263;
export const R_EYE_TOP   = 386;
export const R_EYE_BOT   = 374;
export const R_EYE_PTS   = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

// Iris (indices 468–477, present when using the full face_landmarker model)
// Center + 4 cardinal rim points (right, top, left, bottom)
export const L_IRIS     = 468;
export const L_IRIS_RIM = [469, 470, 471, 472];
export const R_IRIS     = 473;
export const R_IRIS_RIM = [474, 475, 476, 477];

// Nose
export const NOSE_BRIDGE = 6;
export const NOSE_TIP    = 4;
export const NOSE_L_WING = 129;
export const NOSE_R_WING = 358;

// Mouth / lips
export const MOUTH_L       = 61;
export const MOUTH_R       = 291;
export const UPPER_LIP_TOP = 0;
export const UPPER_LIP_BOT = 13;
export const LOWER_LIP_TOP = 14;
export const LOWER_LIP_BOT = 17;

// Face oval (ordered, for drawing the outline)
export const FACE_OVAL_PTS = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

// Overlay colors per feature category
export const COLORS = {
  face:   '#f59e0b',
  brows:  '#a78bfa',
  eyes:   '#38bdf8',
  nose:   '#34d399',
  lips:   '#fb7185',
  jaw:    '#fb923c',
};
