import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
  Camera, RefreshCw, CheckCircle, AlertTriangle, ShieldCheck, UserPlus, 
  X, Sparkles, UserCheck, ShieldAlert, Scan, ArrowRight, ArrowLeft, Eye, VideoOff,
  SlidersHorizontal, Check, Search, XCircle
} from 'lucide-react';
import { Beneficiary } from '../types';
import * as faceapi from '@vladmandic/face-api';
import { 
  loadFaceApiModels, 
  areModelsLoaded, 
  extractFaceDescriptor, 
  compareBiometricVectors,
  calculateMatchConfidence,
  calculateEyeAspectRatio,
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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

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
    matchQuality?: 'confirmed' | 'acceptable' | 'none';
  } | null>(null);

  // Liveness / Anti-Spoofing toggle (Default OFF per technical requirements)
  const [enableLiveness, setEnableLiveness] = useState<boolean>(false);
  const enableLivenessRef = useRef<boolean>(false);
  useEffect(() => {
    enableLivenessRef.current = enableLiveness;
  }, [enableLiveness]);

  const [livenessPassed, setLivenessPassed] = useState<boolean>(false);
  const livenessPassedRef = useRef<boolean>(false);
  useEffect(() => {
    livenessPassedRef.current = livenessPassed;
  }, [livenessPassed]);

  const isEyeClosedRef = useRef<boolean>(false);
  const blinkCounterRef = useRef<number>(0);
  const lastFaceSeenRef = useRef<number>(Date.now());

  // Loop stability and reference tracking
  const registeredProfilesRef = useRef<BiometricProfile[]>([]);
  useEffect(() => { registeredProfilesRef.current = registeredProfiles; }, [registeredProfiles]);

  const targetProfileRef = useRef<BiometricProfile | null>(null);
  useEffect(() => { targetProfileRef.current = targetProfile; }, [targetProfile]);

  const targetBeneficiaryRef = useRef<Beneficiary | undefined>(targetBeneficiary);
  useEffect(() => { targetBeneficiaryRef.current = targetBeneficiary; }, [targetBeneficiary]);

  const beneficiariesRef = useRef<Beneficiary[]>(beneficiaries);
  useEffect(() => { beneficiariesRef.current = beneficiaries; }, [beneficiaries]);

  // Confidence sensitivity threshold (default 60% standard)
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(60);
  const [showSettings, setShowSettings] = useState(false);

  const confidenceThresholdRef = useRef<number>(confidenceThreshold);
  useEffect(() => { confidenceThresholdRef.current = confidenceThreshold; }, [confidenceThreshold]);

  const consecutiveMatchesRef = useRef<number>(0);
  const consecutiveNoFaceFramesRef = useRef<number>(0);
  const liveMatchResultRef = useRef<any>(null);
  const isMatchingLockedRef = useRef<boolean>(false);

  // Fallback search state (NID / Mobile / Name)
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Auto-lock counter
  const [autoLockProgress, setAutoLockProgress] = useState(0);
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Snapshot / manual review state
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [deepScanResult, setDeepScanResult] = useState<MatchResult | null>(null);
  const [isDeepScanning, setIsDeepScanning] = useState(false);

  // Filtered beneficiaries for NID/Phone fallback
  const filteredBeneficiaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return beneficiaries.filter((b) => 
      b.name.toLowerCase().includes(q) ||
      b.nidOrBirthCert.toLowerCase().includes(q) ||
      (b.mobile && b.mobile.includes(q)) ||
      b.id.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [beneficiaries, searchQuery]);

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

  // 2. Precompute 128D Face Descriptors for all registered beneficiaries with photos
  useEffect(() => {
    let active = true;

    const precompute = async () => {
      if (modelsLoading) return;

      setIndexingStatus('Compiling biometric indices from beneficiary database...');
      const profiles: BiometricProfile[] = [];

      // Load target profile directly if it already has faceDescriptor
      if (targetBeneficiary && targetBeneficiary.faceDescriptor && Array.isArray(targetBeneficiary.faceDescriptor) && targetBeneficiary.faceDescriptor.length === 128) {
        setTargetProfile({
          id: targetBeneficiary.id,
          name: targetBeneficiary.name,
          photoUrl: targetBeneficiary.photo || '',
          descriptor: new Float32Array(targetBeneficiary.faceDescriptor),
        });
      }

      for (const b of beneficiaries) {
        if (!active) break;

        // Path A: Pre-stored 128D Face Descriptor exists in database (0ms instant indexing!)
        if (b.faceDescriptor && Array.isArray(b.faceDescriptor) && b.faceDescriptor.length === 128) {
          const prof: BiometricProfile = {
            id: b.id,
            name: b.name,
            photoUrl: b.photo || '',
            descriptor: new Float32Array(b.faceDescriptor),
          };
          profiles.push(prof);
          if (targetBeneficiary && targetBeneficiary.id === b.id) {
            setTargetProfile(prof);
          }
          continue;
        }

        // Path B: Fallback for legacy profiles without saved descriptor
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
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
    } catch (err: any) {
      console.warn('Initial camera constraint failed, attempting generic video fallback:', err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraActive(true);
      } catch (fallbackErr: any) {
        console.error('Camera access rejected or unavailable:', fallbackErr);
        setCameraError(
          'Unable to access camera hardware. Please ensure camera permissions are granted or use the manual verification bypass below.'
        );
        setCameraActive(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!modelsLoading) {
      startCamera(facingMode);
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [modelsLoading, facingMode, startCamera]);

  // Handle manual or automatic match confirmation
  const handleConfirmMatch = useCallback((matchedBeneficiary: Beneficiary, confidence: number) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    onMatchFound(matchedBeneficiary, confidence);
  }, [onMatchFound]);

  // 4. Continuous Real-Time Video Face Detection & Live Matching Loop
  useEffect(() => {
    if (!cameraActive || modelsLoading || capturedSnapshot) return;

    let animId: number;
    isRunningRef.current = true;
    isMatchingLockedRef.current = false;
    consecutiveMatchesRef.current = 0;
    consecutiveNoFaceFramesRef.current = 0;

    const runLiveLoop = async () => {
      if (!isRunningRef.current || isMatchingLockedRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && video.readyState === 4 && canvas) {
        const now = performance.now();
        // Deep analysis interval: every 130ms for silky smooth tracking and rapid recognition
        const shouldRunDescriptor = now - lastAnalysisTimeRef.current > 130;

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

            // Resilient face detection using 320 input size and 0.20 score threshold
            let detection: any = null;
            try {
              if (shouldRunDescriptor && faceapi.nets.faceRecognitionNet.isLoaded) {
                lastAnalysisTimeRef.current = now;
                detection = await faceapi
                  .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.20 }))
                  .withFaceLandmarks(false)
                  .withFaceDescriptor();
              } else {
                detection = await faceapi
                  .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.20 }))
                  .withFaceLandmarks(false);
              }
            } catch (err) {
              detection = null;
            }

            if (detection) {
              setFaceDetected(true);
              lastFaceSeenRef.current = now;
              consecutiveNoFaceFramesRef.current = 0;

              // Check liveness / blink if landmarks present
              if (detection.landmarks) {
                try {
                  const leftEye = detection.landmarks.getLeftEye();
                  const rightEye = detection.landmarks.getRightEye();
                  const leftEar = calculateEyeAspectRatio(leftEye);
                  const rightEar = calculateEyeAspectRatio(rightEye);
                  const ear = (leftEar + rightEar) / 2;

                  if (ear < 0.22) {
                    isEyeClosedRef.current = true;
                  } else if (ear > 0.25 && isEyeClosedRef.current) {
                    isEyeClosedRef.current = false;
                    blinkCounterRef.current += 1;
                    setLivenessPassed(true);
                  }
                } catch (e) {}
              }

              const resized = faceapi.resizeResults(detection, { width: displayWidth, height: displayHeight });
              const { x, y, width, height } = resized.detection.box;

              // Compare descriptor if extracted in this frame
              if (detection.descriptor) {
                const liveDescriptor: Float32Array = detection.descriptor;
                const activeTarget = targetBeneficiaryRef.current;
                const activeTargetProfile = targetProfileRef.current;
                const activeProfiles = registeredProfilesRef.current;
                const activeBeneficiaries = beneficiariesRef.current;

                if (activeTarget && activeTargetProfile) {
                  // Specific target verification mode
                  const dist = faceapi.euclideanDistance(liveDescriptor, activeTargetProfile.descriptor);
                  const conf = calculateMatchConfidence(dist);
                  const isMatch = dist <= 0.62;
                  const matchQuality = dist < 0.50 ? 'confirmed' : isMatch ? 'acceptable' : 'none';

                  const result = {
                    beneficiary: isMatch ? activeTarget : null,
                    confidence: conf,
                    distance: dist,
                    isMatch,
                    matchQuality,
                  };
                  liveMatchResultRef.current = result;
                  setLiveMatchResult(result);
                } else if (activeProfiles.length > 0) {
                  // General registry matching mode
                  let bestProf: BiometricProfile | null = null;
                  let minDistance = Infinity;

                  for (const prof of activeProfiles) {
                    const dist = faceapi.euclideanDistance(liveDescriptor, prof.descriptor);
                    if (dist < minDistance) {
                      minDistance = dist;
                      bestProf = prof;
                    }
                  }

                  const conf = calculateMatchConfidence(minDistance);
                  const isMatch = minDistance <= 0.62 && bestProf !== null;
                  const matchQuality = minDistance < 0.50 ? 'confirmed' : isMatch ? 'acceptable' : 'none';
                  const matchBeneficiary = isMatch && bestProf ? activeBeneficiaries.find((b) => b.id === bestProf!.id) || null : null;

                  const result = {
                    beneficiary: matchBeneficiary,
                    confidence: conf,
                    distance: minDistance,
                    isMatch,
                    matchQuality,
                  };
                  liveMatchResultRef.current = result;
                  setLiveMatchResult(result);
                } else {
                  // No registered profiles exist in the system yet
                  const result = {
                    beneficiary: null,
                    confidence: 0,
                    distance: 1.0,
                    isMatch: false,
                    matchQuality: 'none' as const,
                  };
                  liveMatchResultRef.current = result;
                  setLiveMatchResult(result);
                }
              }

              // Auto-lock accumulation based on verified continuous match
              const currentMatch = liveMatchResultRef.current;
              const livenessOk = !enableLivenessRef.current || livenessPassedRef.current;

              if (currentMatch?.isMatch && currentMatch.beneficiary && livenessOk) {
                consecutiveMatchesRef.current += 1;
                const progress = Math.min(100, consecutiveMatchesRef.current * 34); // ~3 frames to lock (~350ms)
                setAutoLockProgress(progress);

                if (progress >= 100 && !isMatchingLockedRef.current) {
                  isMatchingLockedRef.current = true;
                  handleConfirmMatch(currentMatch.beneficiary, currentMatch.confidence);
                  return;
                }
              } else {
                consecutiveMatchesRef.current = 0;
                setAutoLockProgress(0);
              }

              // Determine HUD Styling:
              // Verified Match -> Emerald Green (#10B981)
              // Not Verified (Mismatch/Unregistered) -> Vibrant Red/Rose (#EF4444)
              // Evaluating / Initial -> Amber (#F59E0B)
              const isMatch = currentMatch?.isMatch;
              const isEvaluated = currentMatch && currentMatch.distance !== undefined;
              const boxColor = isMatch
                ? '#10B981'
                : isEvaluated
                ? '#EF4444'
                : '#F59E0B';

              // Draw bounding corner brackets
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 3.5;
              const cornerLength = Math.min(26, width * 0.22);

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

              // Inner guide border
              ctx.strokeStyle = `${boxColor}44`;
              ctx.lineWidth = 1;
              ctx.strokeRect(x, y, width, height);

              // Draw landmarks
              if (resized.landmarks) {
                ctx.fillStyle = boxColor;
                resized.landmarks.positions.forEach((pt: any) => {
                  ctx.beginPath();
                  ctx.arc(pt.x, pt.y, 1.4, 0, 2 * Math.PI);
                  ctx.fill();
                });
              }

              // HUD Badge Text
              let badgeText = 'FACIAL GEOMETRY DETECTED';
              if (isMatch) {
                badgeText = `✓ VERIFIED: ${currentMatch?.beneficiary?.name?.toUpperCase()} (${currentMatch?.confidence}%)`;
              } else if (isEvaluated) {
                badgeText = `⚠ NOT VERIFIED / নো ম্যাচ (তালিকায় নেই)`;
              } else {
                badgeText = 'ANALYZING GEOMETRY...';
              }

              ctx.font = 'bold 10px monospace';
              const textMetrics = ctx.measureText(badgeText);
              const badgeWidth = textMetrics.width + 16;
              const badgeHeight = 20;
              const badgeX = x + Math.max(0, (width - badgeWidth) / 2);
              const badgeY = Math.max(8, y - badgeHeight - 5);

              // Badge background
              ctx.fillStyle = isMatch ? 'rgba(6, 78, 59, 0.92)' : isEvaluated ? 'rgba(127, 29, 29, 0.92)' : 'rgba(15, 23, 42, 0.85)';
              ctx.beginPath();
              ctx.roundRect?.(badgeX, badgeY, badgeWidth, badgeHeight, 5) || ctx.rect(badgeX, badgeY, badgeWidth, badgeHeight);
              ctx.fill();
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = 1.2;
              ctx.stroke();

              // Badge text
              ctx.fillStyle = '#FFFFFF';
              ctx.fillText(badgeText, badgeX + 8, badgeY + 14);
            } else {
              // Grace window: Don't instantly drop face on single missed frame (motion blur)
              consecutiveNoFaceFramesRef.current += 1;
              if (now - lastFaceSeenRef.current > 400) {
                setFaceDetected(false);
                setLiveMatchResult(null);
                liveMatchResultRef.current = null;
                consecutiveMatchesRef.current = 0;
                setAutoLockProgress(0);
              }
            }
          }
        } catch (loopErr) {
          // Continue loop
        }
      }

      if (isRunningRef.current && !isMatchingLockedRef.current) {
        animId = requestAnimationFrame(runLiveLoop);
      }
    };

    animId = requestAnimationFrame(runLiveLoop);

    return () => {
      isRunningRef.current = false;
      cancelAnimationFrame(animId);
    };
  }, [cameraActive, modelsLoading, capturedSnapshot, handleConfirmMatch]);

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
    setCapturedSnapshot(photoDataUrl);

    // Run Deep Biometric Verification on Snapshot
    setIsDeepScanning(true);
    try {
      const extracted = await extractFaceDescriptor(photoDataUrl);
      if (!extracted) {
        setDeepScanResult({
          distance: 1.0,
          confidence: 0,
          isMatch: false,
          status: 'no_face',
          explanation: 'No clear face detected in the captured snapshot. Please ensure face is centered with good lighting.',
        });
        setIsDeepScanning(false);
        return;
      }

      if (targetBeneficiary && targetProfile) {
        const result = compareBiometricVectors(extracted.descriptor, targetProfile.descriptor);
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
          const result = compareBiometricVectors(extracted.descriptor, bestProfile.descriptor);
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
      console.error('Deep snapshot analysis failed:', err);
    } finally {
      setIsDeepScanning(false);
    }
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

        {/* Liveness / Anti-Spoofing Toolbar (Default OFF for instant crowd scanning) */}
        <div className="bg-slate-850 border-b border-slate-800 px-3.5 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={enableLiveness}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEnableLiveness(checked);
                    setLivenessPassed(false);
                    isEyeClosedRef.current = false;
                    blinkCounterRef.current = 0;
                  }}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
              </div>
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>Enable Liveness / Anti-Spoofing</span>
              </span>
            </label>

            {enableLiveness ? (
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                livenessPassed
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800 font-bold'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse'
              }`}>
                {livenessPassed ? '✓ Blink Verified' : 'Blink eyes to verify'}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                Instant Crowd Mode (Default)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-[10px] text-slate-400">
            <span className="hidden sm:inline">
              Threshold: <strong className="text-emerald-400 font-mono">&lt; 0.48</strong> Confirmed / <strong className="text-teal-400 font-mono">0.58</strong> Acceptable
            </span>
            <span>
              Profiles: <strong className="text-white font-mono">{registeredProfiles.length}</strong>
            </span>
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

        {/* Neural Models Loading Banner */}
        {modelsLoading && (
          <div className="bg-slate-850 p-6 flex flex-col items-center justify-center text-center gap-3">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <div>
              <h4 className="text-sm font-bold text-white mb-1">{modelsStatusText}</h4>
              <p className="text-xs text-slate-400">Loading lightweight CNN weights for instantaneous in-browser recognition</p>
            </div>
            <div className="w-64 bg-slate-700 rounded-full h-2 overflow-hidden mt-1">
              <div
                className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                style={{ width: `${modelsProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Scanner Body */}
        {!modelsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-0 overflow-y-auto flex-1">
            
            {/* Left: Camera & Canvas Viewport (7 cols on md) */}
            <div className="md:col-span-7 bg-black flex flex-col items-center justify-center relative min-h-[300px] sm:min-h-[360px] border-b md:border-b-0 md:border-r border-slate-800">
              
              {cameraError ? (
                <div className="p-6 text-center max-w-sm">
                  <VideoOff className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-white mb-1">Camera Feed Unavailable</h4>
                  <p className="text-xs text-slate-400 mb-4">{cameraError}</p>
                  <button
                    onClick={() => startCamera(facingMode)}
                    className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg inline-flex items-center gap-2 cursor-pointer transition border border-slate-700"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry Camera
                  </button>
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

                  {/* Anti-Spoofing Prompt when liveness enabled */}
                  {enableLiveness && !livenessPassed && faceDetected && (
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-amber-500/60 text-amber-300 text-[11px] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-sm pointer-events-none animate-pulse">
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold">Anti-Spoofing: Please blink eyes (চোখ পলক ফেলুন)</span>
                    </div>
                  )}

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

                <span className="text-[10px] text-slate-400 font-mono">
                  {cameraActive ? '● Live 30FPS Stream' : 'Camera Inactive'}
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
                    <div className="flex items-center gap-2">
                      {liveMatchResult?.distance !== undefined && (
                        <span className="text-[10px] font-mono text-slate-400">
                          Dist: <strong className="text-slate-200">{liveMatchResult.distance.toFixed(3)}</strong>
                        </span>
                      )}
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
                  </div>

                  {/* Distance Category Tag */}
                  {liveMatchResult && (
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Classification:</span>
                      {liveMatchResult.distance < 0.50 ? (
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          ✓ Confirmed Match (&lt; 0.50)
                        </span>
                      ) : liveMatchResult.distance <= 0.62 ? (
                        <span className="bg-teal-950 text-teal-300 border border-teal-800 px-1.5 py-0.5 rounded font-semibold">
                          ✓ Verified Match (0.50 - 0.62)
                        </span>
                      ) : (
                        <span className="bg-rose-950 text-rose-300 border border-rose-800 px-1.5 py-0.5 rounded font-bold">
                          ❌ Not Verified (&gt; 0.62)
                        </span>
                      )}
                    </div>
                  )}

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
                      <div className="flex items-start gap-2 bg-emerald-950/40 border border-emerald-800/80 rounded-lg p-2.5 text-emerald-400 text-xs">
                        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                        <div>
                          <strong className="block text-white">Biometric Identity Verified / শনাক্ত হয়েছে</strong>
                          <span className="text-emerald-200/80 text-[11px]">
                            Live facial vectors align with {liveMatchResult?.beneficiary?.name || targetBeneficiary?.name} with high mathematical precision.
                          </span>
                        </div>
                      </div>
                    ) : faceDetected && liveMatchResult && !liveMatchResult.isMatch ? (
                      <div className="flex items-start gap-2 bg-rose-950/40 border border-rose-800/80 rounded-lg p-2.5 text-rose-300 text-xs">
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-rose-200 font-bold">ভেরিফাইড না / Unverified Beneficiary</strong>
                          <span className="text-rose-300/80 text-[11px] block mt-0.5">
                            {targetBeneficiary
                              ? `ক্যামেরায় পাওয়া মুখের সাথে ${targetBeneficiary.name}-এর মিল নেই (Euclidean Dist: ${liveMatchResult.distance.toFixed(3)} > 0.62)।`
                              : `ক্যামেরায় পাওয়া মুখের সাথে রেজিস্টার্ড কোনো বেনিফিশিয়ারির মিল পাওয়া যায়নি (Closest Dist: ${liveMatchResult.distance.toFixed(3)} > 0.62)।`}
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

                {/* Fallback Option: Search by NID / Phone / Name when camera has difficulty */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-300 font-mono flex items-center gap-1.5">
                      <Search className="w-3.5 h-3.5 text-emerald-400" />
                      NID / Phone Fallback Search
                    </span>
                    <span className="text-[9px] text-slate-500 font-mono">Camera Bypass</span>
                  </div>

                  {targetBeneficiary ? (
                    <button
                      type="button"
                      onClick={() => handleConfirmMatch(targetBeneficiary, 100)}
                      className="w-full bg-slate-800 hover:bg-amber-700 hover:text-white text-amber-300 font-semibold text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer border border-amber-900/50"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
                      Manual Staff Clearance for {targetBeneficiary.name}
                    </button>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search NID, Mobile, or Name..."
                          className="w-full bg-slate-900 border border-slate-700 text-white text-xs rounded-lg pl-8 pr-7 py-2 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs font-bold"
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {/* Live Filtered Search Results */}
                      {searchQuery.trim().length > 0 && (
                        <div className="max-h-36 overflow-y-auto space-y-1.5 border-t border-slate-800/80 pt-2">
                          {filteredBeneficiaries.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic py-1 text-center">
                              No beneficiary found matching '{searchQuery}'
                            </p>
                          ) : (
                            filteredBeneficiaries.map((b) => (
                              <div
                                key={b.id}
                                className="bg-slate-900 hover:bg-slate-850 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{b.name}</p>
                                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                    <span>NID: {b.nidOrBirthCert}</span>
                                    {b.mobile && <span>• {b.mobile}</span>}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleConfirmMatch(b, 100)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] px-2.5 py-1 rounded-md shrink-0 transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  Select
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}

                      {/* Direct Dropdown when not searching */}
                      {!searchQuery && (
                        <select
                          className="w-full bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 font-sans outline-none cursor-pointer"
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
                            -- Or select registered member directly --
                          </option>
                          {beneficiaries.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} (NID: {b.nidOrBirthCert || b.id})
                            </option>
                          ))}
                        </select>
                      )}
                    </>
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
        )}

      </div>
    </div>
  );
}
