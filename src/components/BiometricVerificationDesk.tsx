import { useState } from 'react';
import { Beneficiary, Program, ServiceRecord } from '../types';
import FaceScanner from './FaceScanner';
import { 
  ArrowLeft, Scan, ShieldCheck, CheckCircle2, User, Phone, 
  MapPin, ShoppingBag, ArrowRight, RefreshCw, UserPlus, FileText, Check
} from 'lucide-react';

interface BiometricVerificationDeskProps {
  beneficiaries: Beneficiary[];
  programs: Program[];
  serviceRecords: ServiceRecord[];
  onBack: () => void;
  onSelectBeneficiaryForProgram?: (beneficiary: Beneficiary) => void;
  onViewBeneficiaryProfile?: (beneficiary: Beneficiary) => void;
  onRegisterNew?: () => void;
}

export default function BiometricVerificationDesk({
  beneficiaries,
  programs,
  serviceRecords,
  onBack,
  onSelectBeneficiaryForProgram,
  onViewBeneficiaryProfile,
  onRegisterNew,
}: BiometricVerificationDeskProps) {
  const [scannerOpen, setScannerOpen] = useState(true);
  const [lastMatch, setLastMatch] = useState<{
    beneficiary: Beneficiary;
    similarity: number;
    timestamp: Date;
  } | null>(null);

  const registeredWithPhoto = beneficiaries.filter(
    (b) => b.photo && b.photo.trim().length > 0
  );

  const matchedRecords = lastMatch
    ? serviceRecords.filter((sr) => sr.beneficiaryId === lastMatch.beneficiary.id)
    : [];

  const totalPackagesReceived = matchedRecords.reduce((sum, r) => sum + r.packageCount, 0);

  return (
    <div className="space-y-6 text-left">
      {/* Top Header & Breadcrumb Nav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-2 rounded-xl text-xs transition cursor-pointer border border-slate-200 shrink-0"
            title="Return to previous screen"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-600" />
            <span>Back to Dashboard</span>
          </button>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2 font-display">
              <Scan className="w-5 h-5 text-emerald-600" />
              <span>Biometric Face Verification Desk</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live 128D AI vector matching against {registeredWithPhoto.length} registered facial signatures
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!scannerOpen && (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Scan className="w-4 h-4" />
              <span>Start Live Scan</span>
            </button>
          )}
          {onRegisterNew && (
            <button
              type="button"
              onClick={onRegisterNew}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-200"
            >
              <UserPlus className="w-4 h-4 text-slate-600" />
              <span>Enroll New Citizen</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Scanner Modal */}
      {scannerOpen && (
        <FaceScanner
          beneficiaries={beneficiaries}
          onClose={() => {
            setScannerOpen(false);
            if (!lastMatch) {
              onBack();
            }
          }}
          onMatchFound={(matchedBeneficiary, similarity) => {
            setLastMatch({
              beneficiary: matchedBeneficiary,
              similarity,
              timestamp: new Date(),
            });
            setScannerOpen(false);
          }}
          onNoMatchFound={() => {
            setScannerOpen(false);
          }}
        />
      )}

      {/* Matched Beneficiary Card & Action Center */}
      {lastMatch ? (
        <div className="bg-white border border-emerald-200 rounded-3xl p-6 shadow-md space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider font-mono">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Biometric Identity Match Verified &bull; {lastMatch.timestamp.toLocaleTimeString()}</span>
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold font-mono px-3 py-1 rounded-full w-fit">
              {lastMatch.similarity.toFixed(1)}% Confidence Likeness
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Beneficiary Portrait & Vital Data */}
            <div className="flex flex-col sm:flex-row lg:flex-col items-center sm:items-start gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-slate-200 overflow-hidden shadow-inner shrink-0 border-2 border-emerald-500/50">
                {lastMatch.beneficiary.photo ? (
                  <img
                    src={lastMatch.beneficiary.photo}
                    alt={lastMatch.beneficiary.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-slate-400 m-auto mt-8" />
                )}
              </div>

              <div className="space-y-1.5 text-center sm:text-left">
                <span className="text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded">
                  UID: {lastMatch.beneficiary.id}
                </span>
                <h3 className="text-lg font-black text-slate-900 font-display">
                  {lastMatch.beneficiary.name}
                </h3>
                <p className="text-xs text-slate-600 font-medium flex items-center justify-center sm:justify-start gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {lastMatch.beneficiary.mobile || 'No contact number'}
                </p>
                <p className="text-xs text-slate-600 font-medium flex items-center justify-center sm:justify-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {lastMatch.beneficiary.address || 'Address unlisted'}
                </p>
                <div className="pt-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md font-mono">
                    {lastMatch.beneficiary.category}
                  </span>
                </div>
              </div>
            </div>

            {/* Middle: Vital Stats & Verification Breakdown */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                Verification Details & Profile Summary
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    NID / Birth Certificate
                  </span>
                  <span className="text-xs font-bold text-slate-800 font-mono">
                    {lastMatch.beneficiary.nidOrBirthCert || 'N/A'}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    Family Size
                  </span>
                  <span className="text-xs font-bold text-slate-800 font-mono">
                    {lastMatch.beneficiary.familyMembersCount || 1} Members
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    Total Packages Served
                  </span>
                  <span className="text-xs font-bold text-emerald-700 font-mono">
                    {totalPackagesReceived} Packs
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
                    Enrolled Date
                  </span>
                  <span className="text-xs font-bold text-slate-800 font-mono">
                    {lastMatch.beneficiary.enrolledDate || 'Recent'}
                  </span>
                </div>
              </div>

              {/* Recent Services List */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider mb-2">
                  Recent Assistance History ({matchedRecords.length} Distributions)
                </span>
                {matchedRecords.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No distribution records yet for this profile.</p>
                ) : (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto">
                    {matchedRecords.map((sr) => {
                      const prog = programs.find((p) => p.id === sr.programId);
                      return (
                        <div
                          key={sr.id}
                          className="flex items-center justify-between text-xs p-1.5 rounded bg-white border border-slate-100"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">
                              {prog?.name || sr.programId}
                            </span>
                            <span className="text-[10px] text-slate-400 block font-mono">
                              {sr.servedDate}
                            </span>
                          </div>
                          <span className="font-bold text-emerald-700 font-mono">
                            +{sr.packageCount} pack(s)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Quick Action Workflow Desk */}
            <div className="space-y-3 flex flex-col justify-between">
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                  Quick Actions
                </h4>

                {onSelectBeneficiaryForProgram && (
                  <button
                    type="button"
                    onClick={() => onSelectBeneficiaryForProgram(lastMatch.beneficiary)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md transition flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4" />
                      <span>Distribute Portion In Program</span>
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {onViewBeneficiaryProfile && (
                  <button
                    type="button"
                    onClick={() => onViewBeneficiaryProfile(lastMatch.beneficiary)}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-between border border-slate-200 cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <span>Open Profile in Directory</span>
                    </span>
                    <ArrowRight className="w-4 h-4 text-slate-400" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="w-full bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 border border-teal-200 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-teal-600" />
                  <span>Scan Next Beneficiary Face</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onBack}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                <ArrowLeft className="w-4 h-4 text-slate-300" />
                <span>Return to Home Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty/Idle State with Instructions and Launch Button */
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center shadow-sm max-w-2xl mx-auto space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
            <Scan className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 font-display">
              Ready for Real-Time Face Biometric Scanning
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5 leading-relaxed">
              Position the beneficiary in front of the device camera. The 128D neural network will match their face against registered database portraits in real-time.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-3 rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Scan className="w-4 h-4" />
              <span>Launch Live Camera Scanner</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-3 rounded-xl transition flex items-center justify-center gap-2 border border-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
