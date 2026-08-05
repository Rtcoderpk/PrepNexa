/**
 * MediaPipe Face Landmarker (468 landmarks) index constants, ported from the
 * reference InterviewAnalyser repository and the canonical MediaPipe papers.
 * See https://storage.googleapis.com/mediapipe-assets/documentation/face_landmarks.pdf
 */

export const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144] as const;
export const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380] as const;

// 8-point mouth ring for MAR.
export const MOUTH_INDICES = [61, 81, 311, 291, 308, 324, 78, 95, 88, 178] as const;

export const LEFT_EYE_CENTER_IDX = 159;
export const LEFT_BROW_CENTER_IDX = 105;

export const LEFT_IRIS_IDX = 468;
export const RIGHT_IRIS_IDX = 473;

export const LEFT_EYE_CORNER = [33, 133] as const;
export const RIGHT_EYE_CORNER = [362, 263] as const;