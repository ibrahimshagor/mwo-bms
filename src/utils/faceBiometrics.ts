import * as faceapi from '@vladmandic/face-api';
import { getBasePath } from '../App';

export interface BiometricProfile {
  id: string;
  name: string;
  photoUrl: string;
  descriptor: Float32Array;
  landmarks?: faceapi.FaceLandmarks68;
}

export interface MatchResult {
  distance: number;
  confidence: number;
  isMatch: boolean;
  status: 'matched' | 'low_confidence' | 'no_match' | 'no_face' | 'missing_profile';
  explanation: string;
}

// Global cached models loading promise to prevent duplicate loading
let modelsPromise: Promise<boolean> | null = null;
let modelsLoaded = false;

/**
 * Load Face-API neural network models from local static assets or fallback CDNs
 */
export async function loadFaceApiModels(
  onProgress?: (percent: number, status: string) => void
): Promise<boolean> {
  if (modelsLoaded) {
    onProgress?.(100, 'Biometric models ready');
    return true;
  }

  if (modelsPromise) {
    return modelsPromise;
  }

  modelsPromise = (async () => {
    const basePath = getBasePath();
    const sources = [
      { name: 'Local Neural Weights', url: `${basePath}/models/`, timeout: 4000 },
      { name: 'Cloud CDN (JSDelivr)', url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/', timeout: 7000 },
      { name: 'Cloud CDN (Unpkg)', url: 'https://unpkg.com/@vladmandic/face-api/model/', timeout: 9000 },
    ];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      try {
        onProgress?.(20 + i * 25, `Connecting to ${source.name}...`);
        
        const loadWithTimeout = async () => {
          // Load fast detector for real-time tracking (TinyFaceDetector)
          await faceapi.nets.tinyFaceDetector.loadFromUri(source.url);
          onProgress?.(40, 'Loaded TinyFace Detector CNN');

          // Load 68-point landmark detector
          await faceapi.nets.faceLandmark68Net.loadFromUri(source.url);
          onProgress?.(65, 'Loaded 68-Point Landmark Net');

          // Optional tiny landmark fallback
          try {
            await faceapi.nets.faceLandmark68TinyNet.loadFromUri(source.url);
          } catch (e) {
            // Optional fallback if tiny landmark exists
          }

          // Load 128D deep vector recognition network
          await faceapi.nets.faceRecognitionNet.loadFromUri(source.url);
          onProgress?.(90, 'Loaded 128D Vector Net');
          // Heavy models (ssdMobilenetv1, age_gender, face_expression) are intentionally omitted for speed & memory efficiency
        };

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${source.name} load timed out`)), source.timeout)
        );

        await Promise.race([loadWithTimeout(), timeoutPromise]);

        modelsLoaded = true;
        onProgress?.(100, 'Neural networks ready');
        console.log(`[Biometrics] Successfully initialized neural weights from ${source.name}`);
        return true;
      } catch (err) {
        console.warn(`[Biometrics] Source ${source.name} failed:`, err);
      }
    }

    // If all failed, return false
    console.error('[Biometrics] All neural weight sources failed to load.');
    return false;
  })();

  return modelsPromise;
}

/**
 * Check if models are currently loaded
 */
export function areModelsLoaded(): boolean {
  return modelsLoaded;
}

/**
 * Extract 128D biometric face descriptor from an image element, video, canvas, or Data URL.
 * Employs multi-tier cascade options so that any photo (even in dim or soft lighting)
 * reliably yields its biometric descriptor vector.
 */
export async function extractFaceDescriptor(
  input: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | string
): Promise<{
  descriptor: Float32Array;
  landmarks: faceapi.FaceLandmarks68;
  box: faceapi.Box;
  score: number;
} | null> {
  if (!modelsLoaded) {
    const loaded = await loadFaceApiModels();
    if (!loaded) return null;
  }

  let element: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

  if (typeof input === 'string') {
    if (!input || input.trim().length === 0 || input === 'MOCK_SELFIE_PIC') {
      return null;
    }
    const img = new Image();
    if (!input.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.src = input;
    await new Promise((resolve) => {
      if (img.complete && img.naturalWidth > 0) {
        resolve(true);
      } else {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
      }
    });
    if (!img.complete || img.naturalWidth === 0) return null;
    element = img;
  } else {
    element = input;
  }

  try {
    if (faceapi.nets.tinyFaceDetector.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
      // Tier 1: Standard high-speed 320 input size with resilient 0.20 score threshold
      let result = await faceapi
        .detectSingleFace(element, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.20 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      // Tier 2: Enhanced detail 416 input size with 0.15 threshold if tier 1 missed
      if (!result) {
        result = await faceapi
          .detectSingleFace(element, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.15 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      // Tier 3: Compact 224 input size fallback for low-res or compressed webcam images
      if (!result) {
        result = await faceapi
          .detectSingleFace(element, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.12 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
      }

      if (result && result.descriptor) {
        return {
          descriptor: result.descriptor,
          landmarks: result.landmarks,
          box: result.detection.box,
          score: result.detection.score,
        };
      }
    }
  } catch (err) {
    console.error('[Biometrics] Face extraction error:', err);
  }

  return null;
}

/**
 * Calculate Eye Aspect Ratio (EAR) for blink detection / anti-spoofing
 * EAR = (||p1 - p5|| + ||p2 - p4||) / (2 * ||p0 - p3||)
 */
export function calculateEyeAspectRatio(eyePoints: faceapi.Point[]): number {
  if (!eyePoints || eyePoints.length < 6) return 0.3;
  const p0 = eyePoints[0];
  const p1 = eyePoints[1];
  const p2 = eyePoints[2];
  const p3 = eyePoints[3];
  const p4 = eyePoints[4];
  const p5 = eyePoints[5];

  const v1 = Math.hypot(p1.x - p5.x, p1.y - p5.y);
  const v2 = Math.hypot(p2.x - p4.x, p2.y - p4.y);
  const h = Math.hypot(p0.x - p3.x, p0.y - p3.y);

  if (h === 0) return 0.3;
  return (v1 + v2) / (2.0 * h);
}

/**
 * Check blink status from 68 facial landmarks
 */
export function evaluateLivenessBlink(landmarks: faceapi.FaceLandmarks68): {
  leftEar: number;
  rightEar: number;
  avgEar: number;
  isBlink: boolean;
} {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const leftEar = calculateEyeAspectRatio(leftEye);
  const rightEar = calculateEyeAspectRatio(rightEye);
  const avgEar = (leftEar + rightEar) / 2;
  const isBlink = avgEar < 0.22;

  return { leftEar, rightEar, avgEar, isBlink };
}

/**
 * Mathematically map Euclidean distance (0.0 to 1.2+) to intuitive human confidence (0% to 100%)
 * 
 * Calibrated biometric thresholds for real-world field conditions:
 * - Distance < 0.50: Confirmed Match (High Confidence, 90% - 100%)
 * - Distance 0.50 - 0.62: Verified Match (68% - 89%)
 * - Distance 0.62 - 0.72: Low Confidence / Mismatch (40% - 67%)
 * - Distance >= 0.72: No Match (< 40%)
 */
export function calculateMatchConfidence(distance: number): number {
  if (distance < 0.0) return 100;
  if (distance < 0.50) {
    // 0.0 to 0.50 -> 100% down to 90%
    const t = distance / 0.50;
    return Math.round(100 - t * 10);
  }
  if (distance <= 0.62) {
    // 0.50 to 0.62 -> 89% down to 68%
    const t = (distance - 0.50) / (0.62 - 0.50);
    return Math.round(89 - t * 21);
  }
  if (distance <= 0.72) {
    // 0.62 to 0.72 -> 67% down to 40%
    const t = (distance - 0.62) / (0.72 - 0.62);
    return Math.round(67 - t * 27);
  }
  // Distance > 0.72: No match down to 0%
  const t = Math.min(1, (distance - 0.72) / 0.28);
  return Math.max(0, Math.round(39 - t * 39));
}

/**
 * Compare two 128D descriptors and return verified biometric match result
 * - Distance < 0.50: Confirmed Match (High Confidence)
 * - Distance 0.50 - 0.62: Verified Match (Field standard)
 * - Distance > 0.62: No Match / Not Verified (অপরিচিত মুখ)
 */
export function compareBiometricVectors(
  liveDesc: Float32Array,
  targetDesc: Float32Array
): MatchResult {
  const distance = faceapi.euclideanDistance(liveDesc, targetDesc);
  const confidence = calculateMatchConfidence(distance);

  let explanation = '';
  let status: MatchResult['status'] = 'no_match';
  let isMatch = false;

  if (distance < 0.50) {
    isMatch = true;
    status = 'matched';
    explanation = `Confirmed Match (High Confidence: ${confidence}%, Distance: ${distance.toFixed(3)} < 0.50). Facial vectors align with high precision.`;
  } else if (distance <= 0.62) {
    isMatch = true;
    status = 'matched';
    explanation = `Verified Biometric Likeness (${confidence}%, Distance: ${distance.toFixed(3)} <= 0.62). Biometric signature verified within acceptable threshold.`;
  } else {
    isMatch = false;
    status = 'no_match';
    explanation = `Not Verified (${confidence}% similarity, Distance: ${distance.toFixed(3)} > 0.62). Face does not match registered profile.`;
  }

  return {
    distance,
    confidence,
    isMatch,
    status,
    explanation,
  };
}

/**
 * Cache and precompute biometric profiles for a list of registered beneficiaries
 * Prioritizes stored 128D faceDescriptor from database for instant zero-latency loading.
 */
export async function precomputeBiometricProfiles(
  beneficiaries: Array<{ id: string; name: string; photo?: string; faceDescriptor?: number[] }>,
  onUpdate?: (profiles: BiometricProfile[]) => void
): Promise<BiometricProfile[]> {
  const profiles: BiometricProfile[] = [];

  for (const b of beneficiaries) {
    // 1. Ultra-fast path: Use pre-stored 128D vector from database
    if (b.faceDescriptor && Array.isArray(b.faceDescriptor) && b.faceDescriptor.length === 128) {
      profiles.push({
        id: b.id,
        name: b.name,
        photoUrl: b.photo || '',
        descriptor: new Float32Array(b.faceDescriptor),
      });
      continue;
    }

    // 2. Fallback path for legacy records without saved descriptor
    if (!b.photo || b.photo.trim().length === 0 || b.photo === 'MOCK_SELFIE_PIC') {
      continue;
    }

    try {
      const extracted = await extractFaceDescriptor(b.photo);
      if (extracted) {
        profiles.push({
          id: b.id,
          name: b.name,
          photoUrl: b.photo,
          descriptor: extracted.descriptor,
          landmarks: extracted.landmarks,
        });
      }
    } catch (err) {
      console.warn(`[Biometrics] Failed to precompile profile for ${b.name}:`, err);
    }
  }

  onUpdate?.(profiles);
  return profiles;
}
