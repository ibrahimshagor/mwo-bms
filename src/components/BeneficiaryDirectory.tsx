import { useState } from 'react';
import { User, Beneficiary, Program, ServiceRecord } from '../types';
import BeneficiaryCard from './BeneficiaryCard';
import FaceScanner from './FaceScanner';
import * as XLSX from 'xlsx';
import { 
  Users, Search, Scan, Eye, CreditCard, Edit, Plus, BadgeCheck, UserX, 
  MapPin, Phone, Calendar, ShieldCheck, Hammer, Download, Trash2
} from 'lucide-react';

interface BeneficiaryDirectoryProps {
  currentUser: User;
  beneficiaries: Beneficiary[];
  programs: Program[];
  serviceRecords: ServiceRecord[];
  onShowRegisterForm: (editingB?: Beneficiary) => void;
  onDeleteBeneficiary?: (id: string) => void;
}

export default function BeneficiaryDirectory({
  currentUser,
  beneficiaries,
  programs,
  serviceRecords,
  onShowRegisterForm,
  onDeleteBeneficiary
}: BeneficiaryDirectoryProps) {
  
  // State variables
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCardBeneficiary, setActiveCardBeneficiary] = useState<Beneficiary | null>(null);
  const [activeDetailsBeneficiary, setActiveDetailsBeneficiary] = useState<Beneficiary | null>(null);

  // Biometric search features
  const [faceScanOpen, setFaceScanOpen] = useState(false);
  
  // Target face verification features
  const [targetVerificationBeneficiary, setTargetVerificationBeneficiary] = useState<Beneficiary | null>(null);
  const [verificationResult, setVerificationResult] = useState<{ success: boolean; score: number } | null>(null);

  // Filter list based on donor constraints or global search queries
  const isDonor = currentUser.role === 'Donor';

  const authorizedBeneficiaries = beneficiaries.filter((b) => {
    if (isDonor) {
      // Donors only see beneficiaries involved in programs assigned to them
      const assignedProgramIds = programs
        .filter((p) => p.donors.includes(currentUser.id))
        .map((p) => p.id);

      const isServedInDonorPrograms = serviceRecords.some(
        (sr) => assignedProgramIds.includes(sr.programId) && sr.beneficiaryId === b.id
      );
      
      return isServedInDonorPrograms;
    }
    return true; // Staff/Admin can view global directories
  });

  const filteredBeneficiaries = authorizedBeneficiaries.filter((b) => {
    return (
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.nidOrBirthCert.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleExportFiltered = () => {
    try {
      const dataToExport = filteredBeneficiaries.map(b => {
        const bRecords = serviceRecords.filter(sr => sr.beneficiaryId === b.id);
        const packagesReceivedCount = bRecords.reduce((sum, sr) => sum + sr.packageCount, 0);
        return {
          "Beneficiary UNIQUE ID": b.id,
          "Citizen Full Name": b.name,
          "National ID / Birth Cert": b.nidOrBirthCert,
          "Primary Mobile Contact": b.mobile,
          "Detailed Residence Address": b.address,
          "Membership Category": b.type,
          "Selected Nationality": b.nationality,
          "Gender Profile": b.gender,
          "Date of Birth Profile": b.dob,
          "Total Relatives Portion Received": packagesReceivedCount,
          "Enlisting Admin User": b.createdAdmin
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Beneficiary Roster");
      XLSX.writeFile(workbook, `MWO_Beneficiaries_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      alert("Failed to export beneficiaries list: " + err.message);
    }
  };

  const handleFaceScannerMatch = (b: Beneficiary) => {
    setFaceScanOpen(false);
    // Open their details view directly
    setActiveDetailsBeneficiary(b);
  };

  const getProfileHistoryText = (b: Beneficiary) => {
    // Dynamic calculator for tracking how many total distribution programs this member participated in
    const activeServedCount = serviceRecords.filter(sr => sr.beneficiaryId === b.id).length;
    return activeServedCount === 1 
      ? 'Served in 1 distribution drive'
      : `Served in ${activeServedCount} distribution drives`;
  };

  const currentYear = new Date().getFullYear();
  const getAge = (dobString: string) => {
    if (!dobString) return 'N/A';
    try {
      const year = new Date(dobString).getFullYear();
      return `${currentYear - year} yrs`;
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm max-w-5xl mx-auto">
      
      {/* Title heading line */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-150 mb-5">
        <div>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider font-display">
            <Users className="w-5 h-5 text-emerald-600 animate-pulse" />
            {isDonor ? 'Verified Members Directory' : 'Global Registered Beneficiaries'} ({filteredBeneficiaries.length})
          </h2>
          <p className="text-xs text-slate-500">
            {isDonor 
              ? 'Showing verified citizens receiving service through your endorsed funding programs.'
              : 'Secure tracking of biographical profiles, signatures, and biometric indices.'}
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleExportFiltered}
            className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-205 font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1 cursor-pointer transition shadow-xs"
            title="Export filtered directory to Excel"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Export Excel
          </button>
          {!isDonor && (
            <button
              onClick={() => onShowRegisterForm()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl flex items-center gap-1 cursor-pointer shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              Register Beneficiary
            </button>
          )}
        </div>
      </div>

      {/* Directory Searches */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-grow">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search database by Name, ID credentials, NID or Birth Certificate..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
          />
        </div>

        <button
          onClick={() => setFaceScanOpen(true)}
          className="bg-slate-800 hover:bg-slate-900 border border-slate-705 text-white font-bold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
        >
          <Scan className="w-4.5 h-4.5 text-emerald-400" />
          Face Recognizer Search
        </button>
      </div>

      {/* Table listing directories */}
      {filteredBeneficiaries.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
          <UserX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          No registered beneficiary matches this filter query.
          {searchQuery && (
            <button
              onClick={() => onShowRegisterForm()}
              className="block mx-auto mt-3 text-emerald-600 hover:underline font-bold"
            >
              Click here to register them now
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9.5px] bg-slate-50">
                <th className="p-3">Face</th>
                <th className="p-3">Unique ID</th>
                <th className="p-3">Full Name</th>
                <th className="p-3">NID / Birth Cert</th>
                <th className="p-3">Type</th>
                <th className="p-3">Distribution Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBeneficiaries.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/40">
                  <td className="p-3">
                    <div className="w-9 h-11 bg-slate-100 border border-slate-200 rounded overflow-hidden">
                      {b.photo ? (
                        <img 
                          src={b.photo}
                          referrerPolicy="no-referrer"
                          alt="Face Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-[7px] text-slate-400 font-bold pt-4 text-center leading-none">NO PIC</div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-mono font-bold text-slate-700 select-all">{b.id}</td>
                  <td className="p-3 font-semibold text-slate-850">
                    <p className="font-bold">{b.name}</p>
                    <p className="text-[9.5px] text-slate-440 font-normal">{getAge(b.dob)}, {b.gender}</p>
                  </td>
                  <td className="p-3 font-mono font-medium text-slate-600">{b.nidOrBirthCert}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[8.5px] uppercase ${
                      b.type === 'Widow'
                        ? 'bg-purple-50 text-purple-700 border border-purple-150'
                        : b.type === 'Orphan'
                        ? 'bg-amber-50 text-amber-700 border border-amber-150'
                        : b.type === 'Disable'
                        ? 'bg-rose-50 text-rose-700 border border-rose-150'
                        : 'bg-slate-100 text-slate-750'
                    }`}>
                      {b.type}
                    </span>
                  </td>
                  <td className="p-3 text-[10px] font-medium text-slate-500">
                    {getProfileHistoryText(b)}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setTargetVerificationBeneficiary(b);
                          setVerificationResult(null);
                        }}
                        className="text-emerald-650 hover:text-white border border-emerald-200 hover:bg-emerald-650 p-1.5 rounded transition cursor-pointer flex items-center justify-center bg-emerald-50/50"
                        title="Verify Face Biometrics"
                      >
                        <Scan className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setActiveDetailsBeneficiary(b)}
                        className="text-slate-500 hover:text-emerald-700 border border-slate-200 p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                        title="View demographics profile"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setActiveCardBeneficiary(b)}
                        className="text-slate-500 hover:text-emerald-700 border border-slate-200 p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                        title="Identity Card panel"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                      </button>
                      {!isDonor && (
                        <button
                          onClick={() => onShowRegisterForm(b)}
                          className="text-slate-500 hover:text-amber-700 border border-slate-200 p-1.5 rounded hover:bg-slate-50 cursor-pointer"
                          title="Edit profile data"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(currentUser.role === 'SuperAdmin' || currentUser.role === 'FieldAdmin') && onDeleteBeneficiary && (
                        <button
                          onClick={() => {
                            if (confirm(`Are you absolutely sure you want to delete beneficiary "${b.name}"? This will permanently erase their biometrics descriptor and record history.`)) {
                              onDeleteBeneficiary(b.id);
                            }
                          }}
                          className="text-slate-550 hover:text-rose-700 border border-slate-200 p-1.5 rounded hover:bg-rose-50/45 cursor-pointer transition"
                          title="Delete beneficiary record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 2. Detail records modal inspector */}
      {activeDetailsBeneficiary && (
        <div className="bg-slate-900/40 backdrop-blur-sm fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-6 relative">
            <button
              onClick={() => setActiveDetailsBeneficiary(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center cursor-pointer"
            >
              &times;
            </button>

            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 pb-1 border-b">
              Beneficiary Profile Records
            </h3>

            <div className="flex gap-4 mb-4">
              <div className="w-20 h-24 bg-slate-100 border border-slate-200 rounded-lg overflow-hidden shrink-0">
                {activeDetailsBeneficiary.photo ? (
                  <img
                    src={activeDetailsBeneficiary.photo}
                    referrerPolicy="no-referrer"
                    alt="Loaded Selfie"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-[8px] font-bold text-slate-400 pt-10 text-center">NO PHOTO</div>
                )}
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 leading-normal flex-grow">
                <h4 className="text-sm font-bold text-slate-900 leading-tight uppercase">
                  {activeDetailsBeneficiary.name}
                </h4>
                <p className="text-[10px] text-slate-400 font-mono font-medium">Database ID: {activeDetailsBeneficiary.id}</p>
                <p className="flex items-center gap-1 text-[10px] font-medium text-slate-500"><Phone className="w-3 h-3 text-emerald-600" /> {activeDetailsBeneficiary.mobile || 'None recorded'}</p>
                <p className="flex items-center gap-1 text-[10px] font-medium text-slate-500"><Calendar className="w-3 h-3 text-emerald-600" /> DOB: {activeDetailsBeneficiary.dob || 'None'}</p>
              </div>
            </div>

            {/* General parameters */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs text-slate-700">
              <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100">
                <span className="col-span-5 font-bold">NID / Birth cert:</span>
                <span className="col-span-7 font-mono text-slate-900">{activeDetailsBeneficiary.nidOrBirthCert}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100">
                <span className="col-span-5 font-bold">Type:</span>
                <span className="col-span-7">{activeDetailsBeneficiary.type}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100">
                <span className="col-span-5 font-bold">Nationality:</span>
                <span className="col-span-7">{activeDetailsBeneficiary.nationality}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100 font-medium">
                <span className="col-span-5 font-bold">Gender:</span>
                <span className="col-span-7">{activeDetailsBeneficiary.gender}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 p-1">
                <span className="col-span-5 font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Address:
                </span>
                <span className="col-span-7 text-[11px] leading-tight text-slate-800 break-words">
                  {activeDetailsBeneficiary.address || 'None recorded'}
                </span>
              </div>
            </div>

            {/* Signature Draw */}
            {activeDetailsBeneficiary.signature && (
              <div className="mt-4 border border-slate-100 p-2.5 rounded-xl bg-slate-50">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Authenticated Signature</p>
                <div className="w-full h-12 bg-white rounded border border-slate-200 overflow-hidden flex items-center justify-center">
                  <img
                    src={activeDetailsBeneficiary.signature}
                    referrerPolicy="no-referrer"
                    alt="Authorized signature"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            )}

            {/* Biometric Verification Launch Card Trigger */}
            <div className="mt-4">
              <button
                onClick={() => {
                  const target = activeDetailsBeneficiary;
                  setActiveDetailsBeneficiary(null);
                  setTargetVerificationBeneficiary(target);
                  setVerificationResult(null);
                }}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer shadow-sm transition"
              >
                <Scan className="w-4 h-4 text-emerald-300" />
                Verify Face Biometrics
              </button>
            </div>

            {/* Creation and updates markers tags */}
            <div className="mt-5 space-y-1 bg-emerald-50 rounded-lg p-2.5 border border-emerald-110 text-[9.5px] text-emerald-800 font-mono text-left leading-normal">
              <p className="flex justify-between">
                <span>Created Registrar Admin:</span>
                <span className="font-bold text-slate-800">{activeDetailsBeneficiary.createdAdmin}</span>
              </p>
              {activeDetailsBeneficiary.updatedAdmin && (
                <p className="flex justify-between">
                  <span>Last Modified Admin:</span>
                  <span className="font-bold text-slate-800">{activeDetailsBeneficiary.updatedAdmin}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Previews Cards (exactly 205x380px Canvas) */}
      {activeCardBeneficiary && (
        <BeneficiaryCard
          beneficiary={activeCardBeneficiary}
          onClose={() => setActiveCardBeneficiary(null)}
        />
      )}

      {/* 4. Deep Face Biometrics scanning modal */}
      {(faceScanOpen || targetVerificationBeneficiary) && !verificationResult && (
        <FaceScanner
          beneficiaries={beneficiaries}
          targetBeneficiary={targetVerificationBeneficiary || undefined}
          onClose={() => {
            setFaceScanOpen(false);
            setTargetVerificationBeneficiary(null);
            setVerificationResult(null);
          }}
          onMatchFound={(b, similarity) => {
            if (targetVerificationBeneficiary) {
              setVerificationResult({ success: true, score: similarity });
            } else {
              setFaceScanOpen(false);
              handleFaceScannerMatch(b);
            }
          }}
          onNoMatchFound={(frame) => {
            if (targetVerificationBeneficiary) {
              setVerificationResult({ success: false, score: 0 });
            } else {
              setFaceScanOpen(false);
              if (confirm("Biometrics mismatch: This face is not registered in the database. Would you like to create their beneficiary profile now?")) {
                onShowRegisterForm();
              }
            }
          }}
        />
      )}

      {verificationResult && (
        <div className="bg-slate-900/60 backdrop-blur-sm fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full relative shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setFaceScanOpen(false);
                setTargetVerificationBeneficiary(null);
                setVerificationResult(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 border rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-sm bg-slate-50 cursor-pointer"
            >
              &times;
            </button>
            <div className="p-1 text-center">
              {verificationResult.success ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl">
                  <p className="text-sm font-bold flex items-center justify-center gap-1.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" /> 
                    Biometric Match Verified!
                  </p>
                  <p className="text-xs mt-2 text-slate-700 leading-relaxed">
                    Confirmed identity alignment with <strong>{targetVerificationBeneficiary?.name}</strong> at <strong className="text-emerald-700">{verificationResult.score.toFixed(1)}% likeness</strong>.
                  </p>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl">
                  <p className="text-sm font-bold flex items-center justify-center gap-1.5">
                    <UserX className="w-5 h-5 text-rose-600" /> 
                    Verification Rejected
                  </p>
                  <p className="text-xs mt-2 text-slate-700 leading-relaxed">
                    Facial feature structures do not conform with stored biometric coordinates.
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  setTargetVerificationBeneficiary(null);
                  setVerificationResult(null);
                  setFaceScanOpen(false);
                }}
                className="mt-4 w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl transition cursor-pointer"
              >
                Close Biometric Session
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
