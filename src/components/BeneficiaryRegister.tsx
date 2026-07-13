import { useState, useRef, useEffect, ChangeEvent, FormEvent } from 'react';
import { User, Beneficiary, BeneficiaryType, NationalityType, GenderType } from '../types';
import SignaturePad from './SignaturePad';
import { Camera, Image as ImageIcon, Save, UserPlus, FileWarning, Trash2, RefreshCw } from 'lucide-react';

interface BeneficiaryRegisterProps {
  currentUser: User;
  onSave: (beneficiary: Beneficiary) => void;
  onCancel?: () => void;
  editingBeneficiary?: Beneficiary | null;
}

export default function BeneficiaryRegister({
  currentUser,
  onSave,
  onCancel,
  editingBeneficiary
}: BeneficiaryRegisterProps) {
  // Generate editable automatic ID
  const generateNewId = () => {
    const rNum = Math.floor(10000 + Math.random() * 90000);
    return `MWO-BEN-${rNum}`;
  };

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<BeneficiaryType>('General');
  const [nationality, setNationality] = useState<NationalityType>('Bangladeshi');
  const [dob, setDob] = useState('');
  const [nid, setNid] = useState('');
  const [mobile, setMobile] = useState('');
  const [gender, setGender] = useState<GenderType>('Male');
  const [address, setAddress] = useState('');
  const [photo, setPhoto] = useState('');
  const [signature, setSignature] = useState('');
  const [creatorAdmin, setCreatorAdmin] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Camera capture states
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize form
  useEffect(() => {
    if (editingBeneficiary) {
      setId(editingBeneficiary.id);
      setName(editingBeneficiary.name);
      setType(editingBeneficiary.type);
      setNationality(editingBeneficiary.nationality);
      setDob(editingBeneficiary.dob);
      setNid(editingBeneficiary.nidOrBirthCert);
      setMobile(editingBeneficiary.mobile);
      setGender(editingBeneficiary.gender);
      setAddress(editingBeneficiary.address);
      setPhoto(editingBeneficiary.photo);
      setSignature(editingBeneficiary.signature);
      setCreatorAdmin(editingBeneficiary.createdAdmin);
    } else {
      setId(generateNewId());
      setName('');
      setType('General');
      setNationality('Bangladeshi');
      setDob('');
      setNid('');
      setMobile('');
      setGender('Male');
      setAddress('');
      setPhoto('');
      setSignature('');
      setCreatorAdmin(currentUser.name || currentUser.id);
    }
  }, [editingBeneficiary, currentUser]);

  // Handle webcam activation for photo capture
  const startCameraWithMode = async (mode: 'user' | 'environment') => {
    setCameraError('');
    setCameraActive(true);
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: mode }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error starting registration camera', err);
      setCameraError(`Webcam failed to start in '${mode}' mode. Please verify camera clearances or fallback to local photo upload.`);
      setCameraActive(false);
    }
  };

  const startCamera = async () => {
    await startCameraWithMode(facingMode);
  };

  const toggleFacingModeAndRotate = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    if (cameraActive) {
      await startCameraWithMode(nextMode);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 480; // 1:1.2 vertical portrait ratio - high resolution for accurate face recognition
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Draw reversed image mirror effect only if using front/profile selfie camera
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUri = canvas.toDataURL('image/jpeg', 0.9);
      setPhoto(dataUri);
      stopCamera();
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setPhoto(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) { setFormError('Beneficiary full name is required.'); return; }
    if (!nid.trim()) { setFormError('National ID / Birth Certificate number is required.'); return; }
    if (!signature) { setFormError('Beneficiary digital signature is required. Please sign in the pad area.'); return; }

    const beneficiaryData: Beneficiary = {
      id: id.trim(),
      name: name.trim(),
      type,
      nationality,
      dob,
      nidOrBirthCert: nid.trim(),
      mobile: mobile.trim(),
      gender,
      address: address.trim(),
      photo,
      signature,
      createdAdmin: creatorAdmin || (currentUser.name || currentUser.id)
    };

    if (editingBeneficiary) {
      beneficiaryData.updatedAdmin = currentUser.name || currentUser.id;
      beneficiaryData.updatedAt = new Date().toISOString();
    }

    onSave(beneficiaryData);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm max-w-3xl mx-auto">
      <div className="flex justify-between items-center pb-4 mb-6 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            {editingBeneficiary ? 'Edit Beneficiary Profile' : 'Register New Beneficiary'}
          </h2>
          <p className="text-xs text-slate-500">
            Enter local profile variables. All records are securely committed with digital authentication tags.
          </p>
        </div>
        {onCancel && (
          <button
            onClick={() => { stopCamera(); onCancel(); }}
            className="text-xs text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            Cancel Form
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-250">
            <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">&times;</span>
            <span className="flex-1">{formError}</span>
          </div>
        )}

        {/* Core demographic grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Column: IDs and Names */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                BENEFICIARY SYSTEM UNIQUE ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="Database code ID"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                FULL NAME OF THE BENEFICIARY <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter full name of beneficiary"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  BENEFICIARY TYPE <span className="text-red-500">*</span>
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as BeneficiaryType)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  <option value="General">General</option>
                  <option value="Orphan">Orphan</option>
                  <option value="Widow">Widow</option>
                  <option value="Disable">Disable</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  NATIONALITY <span className="text-red-500">*</span>
                </label>
                <select
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value as NationalityType)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  <option value="Bangladeshi">Bangladeshi</option>
                  <option value="Rohingya">Rohingya</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">DATE OF BIRTH</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  GENDER <span className="text-red-500">*</span>
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as GenderType)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Column: Identification Card and Contact details */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                NID NUMBER / BIRTH REGISTRATION CERTIFICATE <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nid}
                onChange={(e) => setNid(e.target.value)}
                placeholder="Enter NID or Birth Certificate No"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">MOBILE CONTACT NUMBER</label>
              <input
                type="text"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="e.g. 017XXXXXXXX"
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-mono focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">REGISTERED GEOGRAPHICAL ADDRESS</label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Specific camp block or village coordinates Address details..."
                rows={3}
                className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Biometric portrait capture block */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
            Beneficiary Biometric Portrait Selfie
          </label>

          <div className="flex flex-col sm:flex-row gap-5 items-start">
            {/* Live Camera View Box / Saved Photo */}
            <div className="w-40 h-48 border border-slate-300 bg-slate-900 rounded-lg overflow-hidden shrink-0 relative flex items-center justify-center">
              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                />
              ) : photo ? (
                <img
                  src={photo}
                  referrerPolicy="no-referrer"
                  alt="Beneficiary Selfie"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-3 text-slate-500">
                  <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-1.5 opacity-60 animate-pulse" />
                  <span className="text-[10px] font-mono leading-none font-bold">NO PHOTO RECORD</span>
                </div>
              )}

              {photo && !cameraActive && (
                <button
                  type="button"
                  onClick={() => setPhoto('')}
                  className="absolute bottom-1 right-1 bg-red-600/80 hover:bg-red-700 text-white rounded p-1 transition cursor-pointer"
                  title="Remove photograph"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Actions for Camera or Upload */}
            <div className="flex-1 space-y-3">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Provide a clean, well-lit snapshot. This profile biometric asset is mapped in our system cache for high-speed facial matching during camp distribution desks.
              </p>

              {cameraError && (
                <div className="bg-red-50 border border-red-200 rounded p-2 flex items-center gap-1.5 text-red-800 text-[10px]">
                  <FileWarning className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>{cameraError}</span>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5">
                {cameraActive ? (
                  <>
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Capture Frame Portrait
                    </button>
                    <button
                      type="button"
                      onClick={toggleFacingModeAndRotate}
                      className="bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer"
                      title="Rotate between front and rear cameras"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                      Rotate Lens ({facingMode === 'user' ? 'Rear' : 'Front'})
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="bg-slate-300 hover:bg-slate-400 text-slate-850 font-bold text-[11px] py-1.5 px-3 rounded-lg cursor-pointer"
                    >
                      Turn Off Lens
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="bg-slate-800 hover:bg-slate-900 border border-slate-700 text-white font-bold text-[11px] py-2 px-3.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-emerald-400" />
                      Open Live Capture ({facingMode === 'user' ? 'Front' : 'Rear'})
                    </button>
                    <button
                      type="button"
                      onClick={toggleFacingModeAndRotate}
                      className="bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] py-2 px-3.5 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                      title="Pre-set lens direction"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                      Set Lens to {facingMode === 'user' ? 'Rear' : 'Front'}
                    </button>
                  </>
                )}

                <label className="bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px] py-2 px-3.5 border border-slate-300 rounded-lg flex items-center gap-1.5 cursor-pointer transition">
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                  Upload Local Image File
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Signature drawing canvasses */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <SignaturePad
            savedSignature={signature}
            onChange={(dataUrl) => setSignature(dataUrl)}
          />
        </div>

        {/* Admin attribution tag */}
        <div className="bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100 flex items-center justify-between">
          <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider font-mono">
            {editingBeneficiary ? 'Last Updated Admin Tag:' : 'Assigned Registrant Admin Tag:'}
          </span>
          <span className="text-[11px] text-emerald-950 font-mono font-bold bg-white px-2.5 py-0.5 rounded shadow-sm border border-emerald-200">
            {currentUser.name} ({currentUser.role === 'SuperAdmin' ? 'Super Admin' : 'Field Staff'})
          </span>
        </div>

        {/* Submit bar */}
        <div className="flex justify-end gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={() => { stopCamera(); onCancel(); }}
              className="px-4 py-2 hover:bg-slate-50 border border-slate-300 rounded-xl text-slate-650 font-bold text-xs cursor-pointer"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-5 rounded-xl flex items-center gap-1 shadow-sm cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {editingBeneficiary ? 'Save Updates' : 'Commit &amp; Create Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
