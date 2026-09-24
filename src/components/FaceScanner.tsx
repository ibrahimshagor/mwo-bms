import { useEffect, useRef, useState, useCallback, ChangeEvent } from 'react';
import { 
  Camera, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, UserPlus, 
  X, Sparkles, UserCheck, ShieldAlert, Scan, ArrowRight, ArrowLeft, Eye, VideoOff,
  SlidersHorizontal, Check, Upload, ExternalLink, HelpCircle
} from 'lucide-react';
import { Beneficiary } from '../types';
import * as faceapi from '@vladmandic/face-api';
import { 
  loadFaceApiModels, 
  areModelsLoaded, 
  extractFaceDescriptor, 
  compareBiometricVectors,
  calculateMatchConfidence,
  BiometricProfile,
  MatchResult 
} from '../utils/faceBiometrics';

interface FaceScannerProps {
  beneficiaries: Beneficiary[];
  onMatchFound: (beneficiary: Beneficiary, similarity: number) => void;
  onNoMatchFound: (capturedPhotoDataUrl: string) => void;
  onClose?: () => void;
  targetBeneficiary?: Beneficiary;
}

export default function FaceScanner({
  beneficiaries,
  onMatchFound,
  onNoMatchFound,
  onClose,
  targetBeneficiary
}: FaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRunningRef = useRef<boolean>(true);
  const lastAnalysisTimeRef = useRef<number>(0);

  // System states
  const [modelsLoading, setModelsLoading] = useState(!areModelsLoaded());
  const [modelsProgress, setModelsProgress] = useState(areModelsLoaded() ? 100 : 10);
  const [modelsStatusText, setModelsStatusText] = useState('Initializing biometric neural networks...');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Precomputed registry profiles
  const [registeredProfiles, setRegisteredProfiles] = useState<BiometricProfile[]>([]);
  const [targetProfile, setTargetProfile] = useState<BiometricProfile | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<string>('');

  // Live real-time detection state
  const [faceDetected, setFaceDetected] = useState(false);
  const [liveMatchResult, setLiveMatchResult] = useState<{
    beneficiary: Beneficiary | null;
    confidence: number;
    distance: number;
    isMatch: boolean;
  } | null>(null);
  
  // Auto-lock counter
  const [autoLockProgress, setAutoLockProgress] = useState(0);
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Snapshot / manual review state
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [deepScanResult, setDeepScanResult] = useState<MatchResult | null>(null);
  const [isDeepScanning, setIsDeepScanning] = useState(false);

  // Confidence sensitivity threshold (default 60% standard)
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(60);
  const [showSettings, setShowSettings] = useState(false);

  // 1. Initialize Neural Models
  useEffect(() => {
    let mounted = true;
    isRunningRef.current = true;

    const initModels = async () => {
      if (areModelsLoaded()) {
        setModelsLoading(false);
        setModelsProgress(100);
        return;
      }

      setModelsLoading(true);
      const success = await loadFaceApiModels((percent, text) => {
        if (mounted) {
          setModelsProgress(percent);
          setModelsStatusText(text);
        }
      });

      if (mounted) {
        setModelsLoading(false);
        if (!success) {
          setModelsStatusText('Neural engine failed to initialize. Please check network connectivity.');
        }
      }
    };

    initModels();

    return () => {
      mounted = false;
      isRunningRef.current = false;
    };
  }, []);

  const retryInitModels = async () => {
    setModelsLoading(true);
    setModelsProgress(10);
    setModelsStatusText('Connecting to biometric neural weight sources...');
    const success = await loadFaceApiModels((percent, text) => {
      setModelsProgress(percent);
      setModelsStatusText(text);
    });
    setModelsLoading(false);
    if (!success) {
      setModelsStatusText('Neural engine failed to initialize. Please check network connectivity.');
    }
  };

  // 2. Precompute 128D Face Descriptors for all registered beneficiaries with photos
  useEffect(() => {
    let active = true;

    const precompute = async () => {
      if (modelsLoading) return;

      setIndexingStatus('Compiling biometric indices from beneficiary database...');
      const profiles: BiometricProfile[] = [];

      // Sort so targetBeneficiary is indexed first for instantaneous match response
      const sortedBeneficiaries = targetBeneficiary
        ? [targetBeneficiary, ...beneficiaries.filter((b) => b.id !== targetBeneficiary.id)]
        : beneficiaries;

      for (const b of sortedBeneficiaries) {
        if (!active) break;
        if (b.photo && b.photo.trim().length > 0 && b.photo !== 'MOCK_SELFIE_PIC') {
          try {
            const extracted = await extractFaceDescriptor(b.photo);
            if (extracted && active) {
              const prof: BiometricProfile = {
                id: b.id,
                name: b.name,
                photoUrl: b.photo,
                descriptor: extracted.descriptor,
                landmarks: extracted.landmarks,
              };
              profiles.push(prof);
              if (targetBeneficiary && targetBeneficiary.id === b.id) {
                setTargetProfile(prof);
              }
            }
          } catch (err) {
            console.warn(`[Biometrics] Signature indexing failed for ${b.name}:`, err);
          }
        }
      }

      if (active) {
        setRegisteredProfiles(profiles);
        setIndexingStatus(
          profiles.length > 0
            ? `${profiles.length} beneficiary face signatures cached in memory.`
            : 'No beneficiary portraits found in database yet.'
        );
      }
    };

    precompute();

    return () => {
      active = false;
    };
  }, [modelsLoading, beneficiaries, targetBeneficiary]);

  // 3. Start Webcam MediaStream
  const startCamera = useCallback(async (mode: 'user' | 'environment') => {
    setCameraError(null);
    setIsPermissionDenied(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Camera API (getUserMedia) not supported or inaccessible in this browser/frame context.');
      setIsPermissionDenied(true);
      setCameraError(
        'Camera access is not supported or is restricted in this frame environment. You can upload a photo below or open the app in a new tab.'
      );
      setCameraActive(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: { ideal: mode },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setIsPermissionDenied(false);
    } catch (err: any) {
      console.warn('Initial camera constraint failed, attempting generic video fallback:', err?.message || err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraActive(true);
        setIsPermissionDenied(false);
      } catch (fallbackErr: any) {
        console.warn('Camera access unavailable or declined by permission:', fallbackErr?.message || fallbackErr);
        const denied = 
          fallbackErr?.name === 'NotAllowedError' || 
          fallbackErr?.name === 'PermissionDeniedError' || 
          fallbackErr?.message?.toLowerCase().includes('permission') ||
          fallbackErr?.message?.toLowerCase().includes('denied');

        setIsPermissionDenied(denied);
        setCameraError(
          denied
            ? 'Camera access permission was denied. Please allow camera permissions in your browser or upload a photo below for instant face recognition.'
            : 'Unable to access camera hardware. Please ensure your camera is connected or upload a photo below.'
        );
        setCameraActive(false);
      }
    }
  }, []);

  useEffect(() => {
    // Start camera stream immediately on mount so the user sees their camera in ~200-400ms
    startCamera(facingMode);

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facingMode, startCamera]);

  // 4. Continuous Real-Time Video Face Detection & Live Matching Loop
  useEffect(() => {
    if (!cameraActive || modelsLoading || capturedSnapshot) return;

    let animId: number;
    isRunningRef.current = true;

    const runLiveLoop = async () => {
      if (!isRunningRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === 4 && canvas) {
        const now = performance.now();
        // Throttle deep descriptor matching to every 160ms for silky smooth 60fps rendering
        const shouldRunDescriptor = now - lastAnalysisTimeRef.current > 160;

        try {
          const displayWidth = video.clientWidth || 400;
          const displayHeight = video.clientHeight || 300;

          if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
            canvas.width = displayWidth;
            canvas.height = displayHeight;
          }

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Fast TinyFace detection for real-time tracking with landmarks and optional descriptor
            let detection: any = null;
            try {
              if (shouldRunDescriptor && faceapi.nets.faceRecognitionNet.isLoaded) {
                lastAnalysisTimeRef.current = now;
                detection = await faceapi
                  .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.35 }))
                  .withFaceLandmarks(false)
                  .withFaceDescriptor();
              } else {
                detection = await faceapi
                  .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 256, scoreThreshold: 0.35 }))
                  .withFaceLandmarks(false);
              }
            } catch (err) {
              // Gracefully handle any transient frame error
              detection = null;
            }

            if (detection) {
              setFaceDetected(true);
              const resized = faceapi.resizeResults(detection, { width: displayWidth, height: displayHeight });
              const { x, y, width, height } = resized.detection.box;

              // Run 128D descriptor comparison if available
              if (detection.descriptor) {
                const liveDescriptor: Float32Array = detection.descriptor;
                if (targetBeneficiary && targetProfile) {
                  // Scenario A: Target Verification Mode
                  const dist = faceapi.euclideanDistance(liveDescriptor, targetProfile.descriptor);
                  const conf = calculateMatchConfidence(dist);
                  const isMatch = conf >= confidenceThreshold;

                  setLiveMatchResult({
                    beneficiary: targetBeneficiary,
                    confidence: conf,
                    distance: dist,
                    isMatch,
                  });
                } else if (registeredProfiles.length > 0) {
                  // Scenario B: General Search across whole registry
                  let bestProfile: BiometricProfile | null = null;
                  let minDistance = Infinity;

                  for (const prof of registeredProfiles) {
                    const dist = faceapi.euclideanDistance(liveDescriptor, prof.descriptor);
                    if (dist < minDistance) {
                      minDistance = dist;
                      bestProfile = prof;
                    }
                  }

                  if (bestProfile) {
                    const conf = calculateMatchConfidence(minDistance);
                    const isMatch = conf >= confidenceThreshold;
                    const matchBeneficiary = beneficiaries.find((b) => b.id === bestProfile?.id) || null;

                    setLiveMatchResult({
                      beneficiary: matchBeneficiary,
                      confidence: conf,
                      distance: minDistance,
                      isMatch,
                    });
                  }
                } else {
                  setLiveMatchResult(null);
                }
              }

              // Determine HUD Styling based on live match status
              const isConfirmedMatch = liveMatchResult?.isMatch;
              const boxColor = isConfirmedMatch ? '#10B981' : liveMatchResult ? '#F59E0B' : '#06B6D4';

              // Draw bounding corner brackets
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 3;
              const cornerLength = Math.min(24, width * 0.2);

              // Top-left
              ctx.beginPath();
              ctx.moveTo(x, y + cornerLength);
              ctx.lineTo(x, y);
              ctx.lineTo(x + cornerLength, y);
              ctx.stroke();

              // Top-right
              ctx.beginPath();
              ctx.moveTo(x + width - cornerLength, y);
              ctx.lineTo(x + width, y);
              ctx.lineTo(x + width, y + cornerLength);
              ctx.stroke();

              // Bottom-left
              ctx.beginPath();
              ctx.moveTo(x, y + height - cornerLength);
              ctx.lineTo(x, y + height);
              ctx.lineTo(x + cornerLength, y + height);
              ctx.stroke();

              // Bottom-right
              ctx.beginPath();
              ctx.moveTo(x + width - cornerLength, y + height);
              ctx.lineTo(x + width, y + height);
              ctx.lineTo(x + width, y + height - cornerLength);
              ctx.stroke();

              // Draw subtle inner guide border
              ctx.strokeStyle = `${boxColor}55`;
              ctx.lineWidth = 1;
              ctx.strokeRect(x, y, width, height);

              // Draw 68 Glowing Facial Landmarks
              const landmarks = resized.landmarks.positions;
              ctx.fillStyle = boxColor;
              landmarks.forEach((pt) => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 1.4, 0, 2 * Math.PI);
                ctx.fill();
              });

              // Draw Cybernetic HUD Badge on Top
              const badgeText = isConfirmedMatch
                ? `LOCK: ${liveMatchResult?.beneficiary?.name?.toUpperCase()} (${liveMatchResult?.confidence}%)`
                : liveMatchResult && liveMatchResult.confidence > 35
                ? `EVALUATING: ${liveMatchResult.confidence}% LIKENESS`
                : 'FACIAL GEOMETRY DETECTED';

              ctx.font = 'bold 9.5px monospace';
              const textMetrics = ctx.measureText(badgeText);
              const badgeWidth = textMetrics.width + 14;
              const badgeHeight = 18;
              const badgeX = x + Math.max(0, (width - badgeWidth) / 2);
              const badgeY = Math.max(10, y - badgeHeight - 4);

              // Badge background
              ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
              ctx.beginPath();
              ctx.roundRect?.(badgeX, badgeY, badgeWidth, badgeHeight, 4) || ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
              ctx.fill();
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 1;
              ctx.stroke();

              // Badge text
              ctx.fillStyle = boxColor;
              ctx.fillText(badgeText, badgeX + 7, badgeY + 12.5);
            } else {
              setFaceDetected(false);
              setLiveMatchResult(null);
            }
          }
        } catch (loopErr) {
          // Continue gracefully
        }
      }

      if (isRunningRef.current) {
        animId = requestAnimationFrame(runLiveLoop);
      }
    };

    animId = requestAnimationFrame(runLiveLoop);

    return () => {
      isRunningRef.current = false;
      cancelAnimationFrame(animId);
    };
  }, [cameraActive, modelsLoading, capturedSnapshot, targetBeneficiary, targetProfile, registeredProfiles, beneficiaries, liveMatchResult?.isMatch, confidenceThreshold]);

  // 5. Automatic Hold-To-Confirm (When confident match is maintained continuously)
  useEffect(() => {
    if (liveMatchResult?.isMatch && liveMatchResult.beneficiary && !capturedSnapshot) {
      if (!autoLockTimerRef.current) {
        let currentProgress = 0;
        const interval = setInterval(() => {
          currentProgress += 10;
          setAutoLockProgress(currentProgress);
          if (currentProgress >= 100) {
            clearInterval(interval);
            autoLockTimerRef.current = null;
            // Execute Match Found
            handleConfirmMatch(liveMatchResult.beneficiary!, liveMatchResult.confidence);
          }
        }, 120);
        autoLockTimerRef.current = interval;
      }
    } else {
      if (autoLockTimerRef.current) {
        clearInterval(autoLockTimerRef.current);
        autoLockTimerRef.current = null;
      }
      setAutoLockProgress(0);
    }

    return () => {
      if (autoLockTimerRef.current) {
        clearInterval(autoLockTimerRef.current);
        autoLockTimerRef.current = null;
      }
    };
  }, [liveMatchResult?.isMatch, liveMatchResult?.beneficiary, capturedSnapshot]);

  // Handle manual or automatic match confirmation
  const handleConfirmMatch = (matchedBeneficiary: Beneficiary, confidence: number) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    onMatchFound(matchedBeneficiary, confidence);
  };

  // Deep Biometric Verification on an image data URL (from camera snapshot or file upload)
  const runDeepScanOnDataUrl = async (photoDataUrl: string) => {
    setIsDeepScanning(true);
    setCapturedSnapshot(photoDataUrl);

    try {
      const extracted = await extractFaceDescriptor(photoDataUrl);
      if (!extracted) {
        // Fallback: Attempt server-side Gemini Biometric Match if local models are unavailable or missed face
        try {
          const candidatesWithPhotos = (targetBeneficiary ? [targetBeneficiary] : beneficiaries)
            .filter((b) => b.photo && b.photo.length > 50 && b.photo !== 'MOCK_SELFIE_PIC')
            .map((b) => ({ id: b.id, name: b.name, photo: b.photo }));

          if (candidatesWithPhotos.length > 0) {
            const resp = await fetch('/api/face-match', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                capturedPhoto: photoDataUrl,
                candidates: candidatesWithPhotos,
              }),
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data && typeof data.match === 'boolean') {
                const matchedCandidate = data.matchedId ? beneficiaries.find((b) => b.id === data.matchedId) : null;
                const result: MatchResult = {
                  distance: data.match ? (1 - (data.confidence || 85) / 100) : 1.0,
                  confidence: data.confidence || (data.match ? 85 : 0),
                  isMatch: Boolean(data.match && matchedCandidate),
                  status: data.match && matchedCandidate ? 'matched' : 'no_match',
                  explanation: data.reasoning || (data.match ? 'Biometrically verified via Multimodal AI.' : 'No matching facial profile found.'),
                };
                setDeepScanResult(result);
                if (result.isMatch && matchedCandidate) {
                  setLiveMatchResult({
                    beneficiary: matchedCandidate,
                    confidence: result.confidence,
                    distance: result.distance,
                    isMatch: true,
                  });
                }
                setIsDeepScanning(false);
                return;
              }
            }
          }
        } catch (serverErr) {
          console.warn('Server face-match fallback warning:', serverErr);
        }

        setDeepScanResult({
          distance: 1.0,
          confidence: 0,
          isMatch: false,
          status: 'no_face',
          explanation: 'No clear face detected in the image. Please ensure face is centered with good lighting.',
        });
        setIsDeepScanning(false);
        return;
      }

      if (targetBeneficiary && targetProfile) {
        const result = compareBiometricVectors(extracted.descriptor, targetProfile.descriptor, 0.58);
        setDeepScanResult(result);
      } else if (registeredProfiles.length > 0) {
        let bestProfile: BiometricProfile | null = null;
        let minDistance = Infinity;

        for (const prof of registeredProfiles) {
          const dist = faceapi.euclideanDistance(extracted.descriptor, prof.descriptor);
          if (dist < minDistance) {
            minDistance = dist;
            bestProfile = prof;
          }
        }

        if (bestProfile) {
          const result = compareBiometricVectors(extracted.descriptor, bestProfile.descriptor, 0.58);
          setDeepScanResult(result);
          if (result.isMatch) {
            const found = beneficiaries.find((b) => b.id === bestProfile?.id);
            if (found) {
              setLiveMatchResult({
                beneficiary: found,
                confidence: result.confidence,
                distance: result.distance,
                isMatch: true,
              });
            }
          }
        }
      } else {
        setDeepScanResult({
          distance: 1.0,
          confidence: 0,
          isMatch: false,
          status: 'missing_profile',
          explanation: 'No registered beneficiary portraits exist in database to match against.',
        });
      }
    } catch (err: any) {
      console.warn('Deep biometric photo analysis warning:', err);
    } finally {
      setIsDeepScanning(false);
    }
  };

  // 6. Capture High-Resolution Snapshot for Deep Analysis
  const captureSnapshot = async () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    await runDeepScanOnDataUrl(photoDataUrl);
  };

  // Upload or select a photo file directly for face recognition
  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result as string;
        if (dataUrl) {
          await runDeepScanOnDataUrl(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    }
    // reset input
    e.target.value = '';
  };

  const retakeCamera = () => {
    setCapturedSnapshot(null);
    setDeepScanResult(null);
  };

  // Toggle Camera
  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleCloseOrBack = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (onClose) {
      onClose();
    } else {
      window.history.back();
    }
  }, [onClose]);

  const targetHasPhoto = targetBeneficiary ? !!targetBeneficiary.photo && targetBeneficiary.photo.trim().length > 0 : true;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header Bar */}
        <div className="bg-slate-900/95 border-b border-slate-800 px-3.5 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Primary Back Button */}
            <button
              onClick={handleCloseOrBack}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer shrink-0 shadow-sm"
              title="Return to previous screen"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-400" />
              <span className="font-sans">Back</span>
            </button>

            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 hidden sm:flex">
              <Scan className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2 truncate">
                <span>Face Biometrics</span>
                <span className="text-[9px] sm:text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded shrink-0">
                  128D AI
                </span>
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-400 truncate">
                {targetBeneficiary
                  ? `Verifying: ${targetBeneficiary.name}`
                  : `Scanning against ${registeredProfiles.length} registered profiles`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Biometric Settings"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
            <button
              onClick={handleCloseOrBack}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Threshold Settings Drawer */}
        {showSettings && (
          <div className="bg-slate-850 border-b border-slate-750 px-4 py-2.5 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-200">Matching Confidence Threshold:</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="45"
                  max="85"
                  value={confidenceThreshold}
                  onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                  className="accent-emerald-500 cursor-pointer w-28"
                />
                <span className="font-mono font-bold text-emerald-400">{confidenceThreshold}%</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400">
              Profiles with photos: <strong className="text-white">{registeredProfiles.length}</strong> / {beneficiaries.length}
            </span>
          </div>
        )}

        {/* Neural Models Loading Non-blocking Indicator */}
        {modelsLoading && (
          <div className="bg-slate-850/95 border-b border-emerald-900/40 px-3.5 py-1.5 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
              <span className="font-semibold text-white truncate text-[11px]">{modelsStatusText || 'Initializing Biometric Neural Nets...'}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-20 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-200 rounded-full"
                  style={{ width: `${modelsProgress}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400">{modelsProgress}%</span>
            </div>
          </div>
        )}

        {/* Neural Models Failure Notice with Direct Retry Action */}
        {!modelsLoading && !areModelsLoaded() && (
          <div className="bg-amber-950/80 border-b border-amber-800/60 px-3.5 py-2 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-semibold text-amber-200 truncate text-[11px]">
                {modelsStatusText || 'Neural weights could not be loaded. Camera is active, but offline biometrics requires neural weights.'}
              </span>
            </div>
            <button
              onClick={retryInitModels}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[11px] font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer shadow-sm"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Loading</span>
            </button>
          </div>
        )}

        {/* Main Scanner Body - Mounts immediately so camera starts instantly */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-0 overflow-y-auto flex-1">
            
            {/* Left: Camera & Canvas Viewport (7 cols on md) */}
            <div className="md:col-span-7 bg-black flex flex-col items-center justify-center relative min-h-[300px] sm:min-h-[360px] border-b md:border-b-0 md:border-r border-slate-800">
              
              {cameraError ? (
                <div className="p-6 text-center max-w-md my-auto flex flex-col items-center">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${
                    isPermissionDenied ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-slate-800 border border-slate-700'
                  }`}>
                    <VideoOff className={`w-7 h-7 ${isPermissionDenied ? 'text-amber-400' : 'text-slate-400'}`} />
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">
                    {isPermissionDenied ? 'Camera Access Permission Required' : 'Camera Hardware Unavailable'}
                  </h4>
                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                    {cameraError}
                  </p>

                  {/* Browser permission guidance */}
                  {isPermissionDenied && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 mb-4 text-left w-full text-[11px] text-slate-300 space-y-1.5">
                      <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>How to enable camera access:</span>
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-slate-400 pl-1">
                        <li>Click the <strong>camera / lock</strong> icon in your browser URL address bar.</li>
                        <li>Change permission for this site to <strong>Allow</strong>.</li>
                        <li>Click <strong>Retry Camera</strong> below, or upload a photo directly.</li>
                      </ol>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center justify-center gap-2 w-full">
                    <button
                      onClick={() => startCamera(facingMode)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry Camera
                    </button>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition border border-slate-700 shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      Upload Photo
                    </button>

                    <button
                      onClick={() => window.open(window.location.href, '_blank')}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold px-3.5 py-2 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition border border-slate-700"
                      title="Open app in a new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in New Tab
                    </button>
                  </div>

                  {/* Quick test with registered portraits if any exist */}
                  {registeredProfiles.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 w-full">
                      <span className="text-[10px] uppercase font-mono text-slate-400 block mb-2 font-bold">
                        Or test biometric matching with registered portrait:
                      </span>
                      <div className="flex flex-wrap justify-center gap-2 max-h-24 overflow-y-auto">
                        {registeredProfiles.slice(0, 3).map((prof) => (
                          <button
                            key={prof.id}
                            type="button"
                            onClick={() => runDeepScanOnDataUrl(prof.photoUrl)}
                            className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 cursor-pointer transition"
                          >
                            <img src={prof.photoUrl} alt="" className="w-4 h-4 rounded-full object-cover" />
                            <span className="truncate max-w-[100px]">{prof.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : capturedSnapshot ? (
                // Snapshot Preview
                <div className="relative w-full h-full flex items-center justify-center">
                  <img
                    src={capturedSnapshot}
                    alt="Captured Scan Frame"
                    className="max-h-[360px] w-full object-contain"
                  />
                  <div className="absolute top-3 left-3 bg-slate-900/90 text-white text-[11px] font-mono px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    High-Res Frozen Snapshot
                  </div>
                </div>
              ) : (
                // Live Video & Canvas Overlay
                <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full max-h-[360px] object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                  />
                  <canvas
                    ref={canvasRef}
                    className={`absolute inset-0 w-full h-full pointer-events-none ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                  />

                  {/* Live Status Overlay Pill */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold shadow-md ${
                      liveMatchResult?.isMatch
                        ? 'bg-emerald-600 text-white border border-emerald-400 animate-pulse'
                        : faceDetected
                        ? 'bg-amber-600/90 text-white border border-amber-400'
                        : 'bg-slate-900/90 text-slate-300 border border-slate-700'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        liveMatchResult?.isMatch ? 'bg-white' : faceDetected ? 'bg-amber-300' : 'bg-slate-400'
                      }`} />
                      {liveMatchResult?.isMatch
                        ? `MATCH: ${liveMatchResult.confidence}%`
                        : modelsLoading
                        ? 'WARMING UP AI...'
                        : faceDetected
                        ? 'TRACKING FACE...'
                        : 'ALIGN FACE IN FRAME'}
                    </span>
                  </div>

                  {/* Camera flip button */}
                  <button
                    onClick={toggleFacingMode}
                    className="absolute top-3 right-3 bg-slate-900/80 hover:bg-slate-800 text-white p-2 rounded-full border border-slate-700 transition cursor-pointer shadow-md"
                    title="Switch Camera (Front/Back)"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Auto-Lock Progress Bar across bottom of video */}
                  {autoLockProgress > 0 && (
                    <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 p-2 flex items-center justify-between text-xs text-white">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        Verifying Match... Hold steady
                      </div>
                      <div className="w-32 bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-100"
                          style={{ width: `${autoLockProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Viewport Control Bar */}
              <div className="w-full bg-slate-950 border-t border-slate-800 p-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {capturedSnapshot ? (
                    <button
                      onClick={retakeCamera}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Resume Live Camera
                    </button>
                  ) : (
                    <button
                      onClick={captureSnapshot}
                      disabled={!cameraActive}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Capture Snapshot
                    </button>
                  )}

                  {/* Direct Photo File Upload */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                    title="Upload photo of beneficiary for biometric matching"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Upload Photo</span>
                  </button>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                </div>

                <span className="text-[10px] text-slate-400 font-mono">
                  {cameraActive ? '● Live 30FPS Stream' : capturedSnapshot ? '● Snapshot Loaded' : 'Camera Offline'}
                </span>
              </div>
            </div>

            {/* Right: Verification Analytics & Confirmation Desk (5 cols on md) */}
            <div className="md:col-span-5 bg-slate-900 p-4 flex flex-col justify-between gap-4">
              
              <div className="space-y-4">
                
                {/* Target Profile Card (When Verifying a Specific Person) */}
                {targetBeneficiary && (
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                        Target Verification Profile:
                      </span>
                      <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                        UID: {targetBeneficiary.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-14 h-16 rounded-lg bg-slate-700 border border-slate-600 overflow-hidden shrink-0 flex items-center justify-center">
                        {targetBeneficiary.photo ? (
                          <img
                            src={targetBeneficiary.photo}
                            alt={targetBeneficiary.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center p-1">
                            <Eye className="w-5 h-5 text-slate-500 mx-auto" />
                            <span className="text-[8px] text-slate-400 block mt-0.5">No Photo</span>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-white truncate">{targetBeneficiary.name}</h4>
                        <p className="text-[11px] text-slate-400 truncate">NID: {targetBeneficiary.nidOrBirthCert}</p>
                        <p className="text-[11px] text-slate-400 truncate">{targetBeneficiary.address}</p>

                        {!targetHasPhoto && (
                          <span className="inline-block mt-1 text-[9px] bg-amber-950 text-amber-300 border border-amber-800 px-1.5 py-0.5 rounded font-semibold">
                            ⚠️ Missing Registered Portrait
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Match Evaluation Result Box */}
                <div className="bg-slate-850 border border-slate-750 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                      Real-Time Likeness Matrix:
                    </span>
                    <span className={`text-xs font-mono font-bold ${
                      (liveMatchResult?.confidence || deepScanResult?.confidence || 0) >= confidenceThreshold
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                    }`}>
                      {liveMatchResult?.confidence !== undefined
                        ? `${liveMatchResult.confidence}%`
                        : deepScanResult?.confidence !== undefined
                        ? `${deepScanResult.confidence}%`
                        : '0%'}
                    </span>
                  </div>

                  {/* Animated Confidence Meter Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-200 ${
                        (liveMatchResult?.confidence || deepScanResult?.confidence || 0) >= confidenceThreshold
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                          : 'bg-gradient-to-r from-amber-500 to-rose-400'
                      }`}
                      style={{
                        width: `${Math.max(
                          4,
                          liveMatchResult?.confidence || deepScanResult?.confidence || 0
                        )}%`,
                      }}
                    />
                  </div>

                  {/* Status Text & Dynamic Guidance */}
                  <div className="pt-1">
                    {liveMatchResult?.isMatch || deepScanResult?.isMatch ? (
                      <div className="flex items-start gap-2 text-emerald-400 text-xs">
                        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-white">Biometric Identity Verified</strong>
                          <span className="text-slate-300 text-[11px]">
                            Live facial vectors align with {liveMatchResult?.beneficiary?.name || targetBeneficiary?.name} with high mathematical precision.
                          </span>
                        </div>
                      </div>
                    ) : faceDetected ? (
                      <div className="flex items-start gap-2 text-amber-400 text-xs">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-white">Evaluating Live Biometrics</strong>
                          <span className="text-slate-300 text-[11px]">
                            {targetBeneficiary
                              ? `Likeness with ${targetBeneficiary.name} is ${liveMatchResult?.confidence || 0}% (Threshold: ${confidenceThreshold}%).`
                              : liveMatchResult?.beneficiary
                              ? `Closest record: ${liveMatchResult.beneficiary.name} (${liveMatchResult.confidence}%).`
                              : 'Face detected in video. Comparing with registered database...'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-slate-400 text-xs">
                        <Eye className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>Position face directly in front of camera with normal lighting.</span>
                      </div>
                    )}
                  </div>

                  {/* Deep scan explanation if available */}
                  {deepScanResult?.explanation && (
                    <p className="text-[10px] font-mono text-slate-400 bg-slate-900 p-2 rounded border border-slate-800">
                      {deepScanResult.explanation}
                    </p>
                  )}
                </div>

                {/* General Scan: Detected Best Candidate Preview */}
                {!targetBeneficiary && liveMatchResult?.beneficiary && (
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-slate-700 overflow-hidden shrink-0 border border-slate-600">
                        {liveMatchResult.beneficiary.photo ? (
                          <img
                            src={liveMatchResult.beneficiary.photo}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <UserCheck className="w-5 h-5 text-slate-400 m-auto mt-2" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[9px] font-mono uppercase text-emerald-400 font-bold block">
                          Identified Member:
                        </span>
                        <h5 className="text-xs font-bold text-white truncate">
                          {liveMatchResult.beneficiary.name}
                        </h5>
                        <span className="text-[10px] text-slate-400 font-mono">
                          UID: {liveMatchResult.beneficiary.id}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleConfirmMatch(liveMatchResult.beneficiary!, liveMatchResult.confidence)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-2 rounded-lg shrink-0 cursor-pointer shadow-sm transition flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Select
                    </button>
                  </div>
                )}
              </div>

              {/* Action & Verification Decision Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                
                {/* Primary Action Button */}
                {(liveMatchResult?.isMatch || deepScanResult?.isMatch) && (
                  <button
                    onClick={() => {
                      const match = targetBeneficiary || liveMatchResult?.beneficiary;
                      if (match) {
                        handleConfirmMatch(match, liveMatchResult?.confidence || deepScanResult?.confidence || 95);
                      }
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 cursor-pointer transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Confirm & Approve Match ({(liveMatchResult?.confidence || deepScanResult?.confidence || 95)}%)
                  </button>
                )}

                {/* If Not Matched / Register New */}
                {capturedSnapshot && !deepScanResult?.isMatch && (
                  <button
                    onClick={() => onNoMatchFound(capturedSnapshot)}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-2 border border-slate-700 cursor-pointer transition"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
                    Register New Beneficiary with this Snapshot
                  </button>
                )}

                {/* Operator Staff Bypass Dropdown / Button (For emergency manual staff clearance) */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] uppercase font-bold text-slate-400 font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      Staff Operator Manual Override:
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">Field Authorization</span>
                  </div>

                  {targetBeneficiary ? (
                    <button
                      type="button"
                      onClick={() => handleConfirmMatch(targetBeneficiary, 100)}
                      className="w-full bg-slate-800 hover:bg-amber-700 hover:text-white text-amber-300 font-semibold text-xs py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer border border-amber-900/50"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
                      Manual Staff Clearance for {targetBeneficiary.name}
                    </button>
                  ) : (
                    <select
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-sans outline-none cursor-pointer"
                      defaultValue=""
                      onChange={(e) => {
                        const selectedId = e.target.value;
                        if (selectedId) {
                          const chosen = beneficiaries.find((b) => b.id === selectedId);
                          if (chosen) {
                            handleConfirmMatch(chosen, 100);
                          }
                        }
                      }}
                    >
                      <option value="" disabled>
                        -- Select registered member to manually approve --
                      </option>
                      {beneficiaries.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} (UID: {b.id})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Return / Close Scanner Button */}
                <button
                  type="button"
                  onClick={handleCloseOrBack}
                  className="w-full bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4 text-emerald-400" />
                  <span>Return to Previous Page</span>
                </button>

              </div>

            </div>

          </div>

      </div>
    </div>
  );
}
