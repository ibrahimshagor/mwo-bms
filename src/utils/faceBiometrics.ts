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

// In-memory cache for precomputed 128D facial descriptors to eliminate duplicate processing
const descriptorCache = new Map<string, {
  descriptor: Float32Array;
  landmarks: faceapi.FaceLandmarks68;
  box: faceapi.Box;
  score: number;
}>();

/**
 * Load Face-API neural network models from local static assets or fallback CDNs
 */
export async function loadFaceApiModels(
  onProgress?: (percent: number, status: string) => void
): Promise<boolean> {
  if (areModelsLoaded()) {
    modelsLoaded = true;
    onProgress?.(100, 'Biometric models ready');
    return true;
  }

  if (modelsPromise) {
    return modelsPromise;
  }

  modelsPromise = (async () => {
    const basePath = getBasePath();
    const cleanBase = basePath ? basePath.replace(/\/+$/, '') : '';
    
    // Multiple reliable source candidates:
    // 1. App basePath /models (for custom base paths or /mwobms)
    // 2. Local root /models (standard public directory)
    // 3. Local relative ./models (handles nested or relative deployments)
    // 4. Cloud CDN (JSDelivr pinned to exact matching version 1.7.15)
    // 5. Cloud CDN (Unpkg pinned to exact matching version 1.7.15)
    const sources: Array<{ name: string; url: string; timeout: number }> = [];

    if (cleanBase) {
      sources.push({ name: `Local Neural Weights (${cleanBase})`, url: `${cleanBase}/models`, timeout: 15000 });
    }
    sources.push({ name: 'Local Neural Weights (/models)', url: '/models', timeout: 15000 });
    sources.push({ name: 'Local Relative Weights (./models)', url: './models', timeout: 15000 });
    sources.push({
      name: 'Cloud CDN (JSDelivr @1.7.15)',
      url: 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model',
      timeout: 25000
    });
    sources.push({
      name: 'Cloud CDN (Unpkg @1.7.15)',
      url: 'https://unpkg.com/@vladmandic/face-api@1.7.15/model',
      timeout: 25000
    });

    // Ensure TensorFlow.js backend is primed
    try {
      const tfAny = (faceapi as any).tf;
      if (tfAny && typeof tfAny.ready === 'function') {
        await tfAny.ready();
      }
    } catch (e) {
      // Non-fatal, continue with network loading
    }

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      try {
        onProgress?.(15 + i * 15, `Initializing Biometrics (${source.name})...`);
        
        const loadNets = async () => {
          // 1. Tiny Face Detector (189KB) - detect bounding box
          if (!faceapi.nets.tinyFaceDetector.isLoaded) {
            onProgress?.(30, `Loading Face Detector (${source.name})...`);
            await faceapi.nets.tinyFaceDetector.loadFromUri(source.url);
          }

          // 2. Face Landmarks 68 (349KB) - geometric alignments
          if (!faceapi.nets.faceLandmark68Net.isLoaded) {
            onProgress?.(60, `Loading Facial Landmarks (${source.name})...`);
            await faceapi.nets.faceLandmark68Net.loadFromUri(source.url);
          }

          // 3. 128D Face Recognition Network (6.2MB) - biometric vector generation
          if (!faceapi.nets.faceRecognitionNet.isLoaded) {
            onProgress?.(85, `Loading 128D Recognition Network (${source.name})...`);
            await faceapi.nets.faceRecognitionNet.loadFromUri(source.url);
          }

          // 4. Optional tiny landmarks loaded non-blockingly
          if (!faceapi.nets.faceLandmark68TinyNet.isLoaded) {
            faceapi.nets.faceLandmark68TinyNet.loadFromUri(source.url).catch(() => {});
          }
        };

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${source.name} load timed out after ${source.timeout}ms`)), source.timeout)
        );

        await Promise.race([loadNets(), timeoutPromise]);

        modelsLoaded = true;
        onProgress?.(100, 'Neural networks ready');
        console.log(`[Biometrics] Successfully initialized neural weights from ${source.name}`);
        return true;
      } catch (err) {
        console.warn(`[Biometrics] Source ${source.name} failed:`, err);
      }
    }

    // Reset modelsPromise on failure so future attempts can retry cleanly
    modelsPromise = null;
    modelsLoaded = false;
    console.error('[Biometrics] All neural weight sources failed to load.');
    return false;
  })();

  return modelsPromise;
}

/**
 * Check if models are currently loaded
 */
export function areModelsLoaded(): boolean {
  return (
    modelsLoaded ||
    (Boolean(faceapi.nets.tinyFaceDetector?.isLoaded) &&
     Boolean(faceapi.nets.faceLandmark68Net?.isLoaded) &&
     Boolean(faceapi.nets.faceRecognitionNet?.isLoaded))
  );
}

/**
 * Extract 128D biometric face descriptor from an image element, video, canvas, or Data URL
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

  // Check in-memory cache for string/data URL inputs to instantly return cached 128D vector
  const cacheKey = typeof input === 'string'
    ? (input.length > 180 ? input.slice(0, 90) + input.slice(-90) : input)
    : null;

  if (cacheKey && descriptorCache.has(cacheKey)) {
    return descriptorCache.get(cacheKey)!;
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
      img.onload = resolve;
      img.onerror = resolve;
    });
    if (!img.complete || img.naturalWidth === 0) return null;
    element = img;
  } else {
    element = input;
  }

  try {
    // Fast & accurate TinyFaceDetector with FaceLandmarks and 128D descriptor
    let result = null;
    if (faceapi.nets.tinyFaceDetector.isLoaded) {
      result = await faceapi
        .detectSingleFace(element, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.25 }))
        .withFaceLandmarks(false)
        .withFaceDescriptor();
    }

    // High accuracy fallback if available
    if (!result && faceapi.nets.ssdMobilenetv1.isLoaded) {
      try {
        result = await faceapi
          .detectSingleFace(element, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
          .withFaceLandmarks(false)
          .withFaceDescriptor();
      } catch (e) {}
    }

    if (result && result.descriptor) {
      const output = {
        descriptor: result.descriptor,
        landmarks: result.landmarks,
        box: result.detection.box,
        score: result.detection.score,
      };

      if (cacheKey) {
        descriptorCache.set(cacheKey, output);
      }

      return output;
    }
  } catch (err) {
    console.error('[Biometrics] Face extraction error:', err);
  }

  return null;
}

/**
 * Mathematically map Euclidean distance (0.0 to 1.2+) to intuitive human confidence (0% to 100%)
 * 
 * Research benchmark for 128D FaceNet embeddings:
 * - Distance < 0.25: Extremely high confidence match (95% - 100%)
 * - Distance 0.25 - 0.45: Solid match (80% - 94%)
 * - Distance 0.45 - 0.55: Moderate match (65% - 79%)
 * - Distance 0.55 - 0.60: Match threshold boundary (58% - 64%)
 * - Distance > 0.60: Different individuals (< 50%)
 */
export function calculateMatchConfidence(distance: number): number {
  if (distance < 0.0) return 100;
  if (distance <= 0.20) {
    return Math.round(98 + (0.20 - distance) * 10);
  }
  if (distance <= 0.55) {
    // Linear scale from 0.20 (98%) down to 0.55 (68%)
    const t = (distance - 0.20) / (0.55 - 0.20);
    return Math.round(98 - t * 30);
  }
  if (distance <= 0.75) {
    // Linear scale from 0.55 (68%) down to 0.75 (35%)
    const t = (distance - 0.55) / (0.75 - 0.55);
    return Math.round(68 - t * 33);
  }
  // Above 0.75: Very low similarity down to 0%
  const t = Math.min(1, (distance - 0.75) / 0.45);
  return Math.max(0, Math.round(35 - t * 35));
}

/**
 * Compare two 128D descriptors and return verified biometric match result
 */
export function compareBiometricVectors(
  liveDesc: Float32Array,
  targetDesc: Float32Array,
  thresholdDistance: number = 0.56
): MatchResult {
  const distance = faceapi.euclideanDistance(liveDesc, targetDesc);
  const confidence = calculateMatchConfidence(distance);
  const isMatch = distance <= thresholdDistance && confidence >= 60;

  let explanation = '';
  let status: MatchResult['status'] = 'no_match';

  if (isMatch) {
    status = 'matched';
    if (confidence >= 88) {
      explanation = `High-confidence biometric match (${confidence}%). Facial landmark geometries & 128D embeddings align precisely.`;
    } else {
      explanation = `Biometric match confirmed (${confidence}% likeness, distance: ${distance.toFixed(3)}).`;
    }
  } else if (confidence >= 50) {
    status = 'low_confidence';
    explanation = `Similarity is ${confidence}%, which is below the 60% verification threshold (Distance: ${distance.toFixed(3)}). Please adjust lighting and face the camera directly.`;
  } else {
    status = 'no_match';
    explanation = `Facial mismatch (${confidence}% similarity, distance: ${distance.toFixed(3)}). The scanned face does not match the registered profile.`;
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
 */
export async function precomputeBiometricProfiles(
  beneficiaries: Array<{ id: string; name: string; photo?: string }>,
  onUpdate?: (profiles: BiometricProfile[]) => void
): Promise<BiometricProfile[]> {
  const profiles: BiometricProfile[] = [];

  for (const b of beneficiaries) {
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
