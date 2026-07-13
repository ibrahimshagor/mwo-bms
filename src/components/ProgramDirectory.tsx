import { useState } from 'react';
import { User, Program, Beneficiary, ServiceRecord, ProgramType } from '../types';
import FaceScanner from './FaceScanner';
import * as XLSX from 'xlsx';
import { 
  Building, BookOpen, Layers, Search, Eye, ClipboardList, PenTool, CheckCircle, 
  AlertCircle, ChevronRight, CornerDownRight, RotateCcw, HelpCircle, Scan,
  Trash2, UserCheck, Plus, ShoppingBag, Download
} from 'lucide-react';

interface ProgramDirectoryProps {
  currentUser: User;
  programs: Program[];
  beneficiaries: Beneficiary[];
  serviceRecords: ServiceRecord[];
  onShowEditProgram: (program: Program) => void;
  onShowCreateProgram?: () => void;
  onDeleteProgram?: (programId: string) => void;
  onUpdateRemainingStock: (programId: string, updatedRemaining: number) => void;
  onSaveServiceRecord: (record: ServiceRecord) => void;
  onRemoveServiceRecord: (recordId: string) => void;
  onUpdateServiceRecordPackageCount: (recordId: string, newCount: number) => void;
}

export default function ProgramDirectory({
  currentUser,
  programs,
  beneficiaries,
  serviceRecords,
  onShowEditProgram,
  onShowCreateProgram,
  onDeleteProgram,
  onUpdateRemainingStock,
  onSaveServiceRecord,
  onRemoveServiceRecord,
  onUpdateServiceRecordPackageCount
}: ProgramDirectoryProps) {
  
  // States
  const [activeTab, setActiveTab] = useState<'directory' | 'desk'>('directory');
  const [selectedDeskProgramId, setSelectedDeskProgramId] = useState<string | null>(null);
  const selectedDeskProgram = programs.find((p) => p.id === selectedDeskProgramId) || null;
  const [deskAlert, setDeskAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showDeskAlert = (type: 'success' | 'error', message: string) => {
    setDeskAlert({ type, message });
    setTimeout(() => {
      setDeskAlert(prev => prev?.message === message ? null : prev);
    }, 5000);
  };

  // Filter and search directories
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Popups and Modals
  const [viewDetailsProgram, setViewDetailsProgram] = useState<Program | null>(null);

  // Active Program Desk search parameters
  const [deskSearchQuery, setDeskSearchQuery] = useState('');
  const [deskFaceScanOpen, setDeskFaceScanOpen] = useState(false);
  const [packageCount, setPackageCount] = useState<number>(1);
  const [deskSelectedBeneficiary, setDeskSelectedBeneficiary] = useState<Beneficiary | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Active Program Desk suggestions based on search query
  const deskQuery = deskSearchQuery.trim().toLowerCase();
  const deskSuggestions = deskQuery
    ? beneficiaries.filter(b => {
        return (
          b.id.toLowerCase().includes(deskQuery) ||
          b.name.toLowerCase().includes(deskQuery) ||
          b.nidOrBirthCert.toLowerCase().includes(deskQuery) ||
          b.mobile.includes(deskQuery)
        );
      }).slice(0, 5)
    : [];

  // Filter programs based on user role authorization
  const isDonor = currentUser.role === 'Donor';
  
  const authorizedPrograms = programs.filter((p) => {
    if (isDonor) {
      // Donors only see programs assigned specifically to them
      return p.donors.includes(currentUser.id);
    }
    return true; // Staff/Admin see everything
  });

  const filteredPrograms = authorizedPrograms.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || p.type === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const getDonorNames = (donorIds: string[]) => {
    // In prototype, return simple formatted name placeholders or ids
    return donorIds.map(id => id === 'donor1' ? 'Mr. ABC (Donor)' : id === 'donor2' ? 'Al-Khair Trust' : id).join(', ');
  };

  const handleExportPrograms = () => {
    try {
      const dataToExport = filteredPrograms.map(p => {
        const distributedCount = p.targetStockSize - p.remainingStock;
        return {
          "Program UNIQUE ID": p.id,
          "Relief Program Name": p.name,
          "Program Type Category": p.type,
          "Timeline Run Date": p.programDate,
          "Timeline Expected Duration": p.programDuration,
          "Target Stock Size (Packs)": p.targetStockSize,
          "Remaining Stock Inventory": p.remainingStock,
          "Disbursed Portion Distributed": distributedCount,
          "Service Allocation Rate": `${Math.round((distributedCount / p.targetStockSize) * 100)}%`,
          "Assigned Funding Donors": getDonorNames(p.donors)
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Programs Directory");
      XLSX.writeFile(workbook, `MWO_Programs_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      alert("Failed to export programs list: " + err.message);
    }
  };

  // Program Desk Action: Search beneficiary to serve
  const executeDeskSearch = () => {
    if (!deskSearchQuery.trim()) return;

    // Search by unique ID, NID/BirthCertificate, Name or Mobile
    const queryStr = deskSearchQuery.trim().toLowerCase();
    const match = beneficiaries.find(
      (b) =>
        b.id.toLowerCase() === queryStr ||
        b.nidOrBirthCert.toLowerCase() === queryStr ||
        b.name.toLowerCase() === queryStr ||
        b.mobile === queryStr
    );

    if (match) {
      checkDuplicationAndSet(match);
    } else {
      // Fuzzy search fallback
      const fuzzyMatch = beneficiaries.find(
        (b) =>
          b.name.toLowerCase().includes(queryStr) ||
          b.id.toLowerCase().includes(queryStr) ||
          b.nidOrBirthCert.toLowerCase().includes(queryStr) ||
          b.mobile.includes(queryStr)
      );
      if (fuzzyMatch) {
        checkDuplicationAndSet(fuzzyMatch);
      } else {
        showDeskAlert('error', `No registered beneficiary matches ID, Name, Mobile, or NID: "${deskSearchQuery}"`);
        setDeskSelectedBeneficiary(null);
        setDuplicateWarning(null);
      }
    }
  };

  const checkDuplicationAndSet = (beneficiary: Beneficiary) => {
    if (!selectedDeskProgram) return;

    // Check if they are already flagged as served inside this program
    const priorSR = serviceRecords.find(
      (sr) => sr.programId === selectedDeskProgram.id && sr.beneficiaryId === beneficiary.id
    );

    setDeskSelectedBeneficiary(beneficiary);

    if (priorSR) {
      const serverAdmin = priorSR.servedAdmin;
      setDuplicateWarning(
        `DUPLICATION BLOCKED: ${beneficiary.name} (${beneficiary.id}) was already marked as served in this program on ${new Date(priorSR.servedDate).toLocaleDateString('en-GB')}, authenticated by registrar: ${serverAdmin}.`
      );
    } else {
      setDuplicateWarning(null);
      // Removed setPackageCount(1) so we preserve user's explicit allocation portion choice
    }
  };

  // Save distribution serve
  const serveBeneficiary = () => {
    if (!selectedDeskProgram || !deskSelectedBeneficiary) return;

    if (selectedDeskProgram.remainingStock < packageCount) {
      showDeskAlert('error', `ERROR: Critical low stock! Selected portion contains ${packageCount} items, but program inventory only has ${selectedDeskProgram.remainingStock} items left.`);
      return;
    }

    const newRecord: ServiceRecord = {
      id: `SR-${Math.floor(10000 + Math.random() * 90000)}`,
      programId: selectedDeskProgram.id,
      beneficiaryId: deskSelectedBeneficiary.id,
      packageCount,
      servedDate: new Date().toISOString(),
      servedAdmin: currentUser.name || currentUser.id
    };

    onSaveServiceRecord(newRecord);
    
    // Deduct stock quantity
    const updatedRemaining = selectedDeskProgram.remainingStock - packageCount;
    onUpdateRemainingStock(selectedDeskProgram.id, updatedRemaining);

    // Reset selectors
    showDeskAlert('success', `Success! ${deskSelectedBeneficiary.name} is marked as Served with ${packageCount} distribution packages.`);
    setDeskSelectedBeneficiary(null);
    setDeskSearchQuery('');
    setPackageCount(1); // Reset package allocation choice back to 1 for the next beneficiary
  };

  // Undo / Delete distribution serve decision
  const handleUndoServe = (record: ServiceRecord) => {
    if (!selectedDeskProgram) return;
    
    if (confirm('Are you legally authorized to revoke this distribution? Doing so deletes the record and restores stock inventory.')) {
      onRemoveServiceRecord(record.id);

      // Restore stock quantity
      const restoredRemaining = selectedDeskProgram.remainingStock + record.packageCount;
      onUpdateRemainingStock(selectedDeskProgram.id, restoredRemaining);
    }
  };

  // Edit distribution serve package count
  const handleEditPackageCount = (record: ServiceRecord, newCount: number) => {
    if (!selectedDeskProgram) return;
    if (newCount < 1) return;

    // Calculate stock variance
    const stockVariance = newCount - record.packageCount;
    if (selectedDeskProgram.remainingStock < stockVariance) {
      showDeskAlert('error', "ERROR: Insufficient inventory space to make changes!");
      return;
    }

    onUpdateServiceRecordPackageCount(record.id, newCount);

    const updatedRemaining = selectedDeskProgram.remainingStock - stockVariance;
    onUpdateRemainingStock(selectedDeskProgram.id, updatedRemaining);
  };

  // Bio scanner matches trigger
  const handleFaceScannerMatch = (b: Beneficiary) => {
    setDeskFaceScanOpen(false);
    checkDuplicationAndSet(b);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* 1. Main Programs directory directory */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-150 mb-4">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 uppercase tracking-wider font-display">
                <Layers className="w-4.5 h-4.5 text-emerald-600" />
                {isDonor ? 'Assigned Distributions Dashboard' : 'Global Programs Directory Area'}
              </h3>
              {currentUser.role === 'SuperAdmin' && onShowCreateProgram && (
                <button
                  onClick={onShowCreateProgram}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-1.5 px-3.5 rounded-xl flex items-center gap-1 cursor-pointer shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Launch New Program
                </button>
              )}
            </div>

            {/* Filter control bar */}
            <div className="flex flex-col sm:flex-row gap-3.5 mb-5">
              <div className="relative flex-grow">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="Search distributions by Name, unique Program ID, or dates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="border border-slate-300 rounded-xl p-2 px-3 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none bg-white font-medium"
              >
                <option value="ALL">Filter Types: ALL</option>
                <option value="Food Program">Food Projects</option>
                <option value="Winter Program">Winter Drives</option>
                <option value="Wash Program">Wash &amp; Water Wells</option>
                <option value="Seasonal Program">Seasonal / Ramadan</option>
                <option value="Rohingya Program">Rohingya Humanitarian</option>
                <option value="Emergency Program">Emergency Flood Relief</option>
                <option value="Orphan Program">Orphan Core Care</option>
              </select>

              <button
                onClick={handleExportPrograms}
                className="bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-205 font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition shadow-xs"
                title="Export programs directory to Excel"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                Export Excel
              </button>
            </div>

            {/* Grid rows cards */}
            {filteredPrograms.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-bounce" />
                No active distribution projects link to this selection.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPrograms.map((p) => {
                  const percentDone = Math.round(
                    ((p.targetStockSize - p.remainingStock) / p.targetStockSize) * 100
                  );
                  return (
                    <div 
                      key={p.id}
                      className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col hover:shadow-md transition duration-150 relative overflow-hidden group"
                    >
                      {/* Left highlights border indicator */}
                      <div className="absolute top-0 bottom-0 left-0 w-1 bg-emerald-500"></div>

                      <div className="flex justify-between items-start gap-2 mb-2 leading-tight">
                        <span className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider select-all">{p.id}</span>
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-150 font-bold px-2 py-0.5 rounded text-[8.5px] uppercase">
                          {p.type}
                        </span>
                      </div>

                      <h4 className="text-xs font-bold font-display text-slate-850 group-hover:text-emerald-700 transition leading-snug line-clamp-2 h-9 mb-3">
                        {p.name}
                      </h4>

                      <div className="mt-auto space-y-2.5">
                        {/* Compact statistics */}
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                          <span>Target Volume:</span>
                          <span className="text-slate-800 font-bold">{p.targetStockSize} packs</span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                          <span>Distributed Served:</span>
                          <span className="text-amber-700 font-extrabold">{p.targetStockSize - p.remainingStock} packs</span>
                        </div>

                        {/* Progress slider bar */}
                        <div>
                          <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                            <span>Completeness Progress</span>
                            <span>{percentDone}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-300`}
                              style={{ width: `${Math.min(100, percentDone)}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="h-[0.5px] bg-slate-100 w-full" />

                        {/* Controls */}
                        <div className="flex justify-between items-center gap-1.5 mt-2">
                          <button
                            onClick={() => setViewDetailsProgram(p)}
                            className="bg-transparent hover:bg-slate-50 border border-slate-200 text-slate-650 font-semibold text-[10px] py-1.5 px-3 rounded-md flex items-center justify-center gap-1 cursor-pointer transition flex-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View Records
                          </button>

                          {!isDonor && (
                            <button
                              onClick={() => {
                                setSelectedDeskProgramId(p.id);
                                setDeskSelectedBeneficiary(null);
                                setDuplicateWarning(null);
                                setDeskSearchQuery('');
                                setPackageCount(1); // Set to 1 as initial desk open default
                                setActiveTab('desk');
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 px-3 rounded-md flex items-center justify-center gap-1 cursor-pointer shadow-sm transition flex-1"
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                              Active Desk
                            </button>
                          )}
                        </div>
                        
                        {/* Super Admin edit and delete trigger */}
                        {currentUser.role === 'SuperAdmin' && (
                          <div className="flex justify-center gap-2 pt-1.5 border-t border-slate-100/50 mt-1">
                            <button
                              onClick={() => onShowEditProgram(p)}
                              className="text-[9.5px] font-bold text-amber-700 hover:text-amber-800 cursor-pointer"
                            >
                              Edit details &amp; links
                            </button>
                            {onDeleteProgram && (
                              <>
                                <span className="text-slate-300 text-[9.5px]">|</span>
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you absolutely sure you want to delete program "${p.name}"? This will permanently wipe out all registered logs of distributions served under this project.`)) {
                                      onDeleteProgram(p.id);
                                    }
                                  }}
                                  className="text-[9.5px] font-bold text-rose-600 hover:text-rose-750 cursor-pointer"
                                >
                                  Delete Program
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. SPECIFIC PROGRAM ADMIN DESK panel */}
       {activeTab === 'desk' && selectedDeskProgram && (
        <div className="space-y-6">
          
          {/* Back trigger card header */}
          <div className="bg-slate-800 text-white rounded-2xl p-5 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <button
                  onClick={() => {
                    setActiveTab('directory');
                    setSelectedDeskProgramId(null);
                  }}
                  className="text-white/60 hover:text-white border border-white/20 hover:bg-white/10 p-1.5 rounded-full cursor-pointer transition"
                >
                  <RotateCcw className="w-3.5 h-3.5 rotate-90" />
                </button>
                <span className="text-[10px] font-bold uppercase tracking-widest font-mono text-emerald-400">
                  {selectedDeskProgram.id} &bull; DESK OPERATION
                </span>
              </div>
              <h2 className="text-base font-bold font-display leading-tight">{selectedDeskProgram.name}</h2>
              <div className="flex gap-4 items-center text-xs text-white/70 mt-1.5 font-mono">
                <span>Timeline Date: {selectedDeskProgram.programDate}</span>
                <span>Type: {selectedDeskProgram.type}</span>
              </div>
            </div>

            <div className="bg-white/10 px-4 py-2.5 rounded-xl text-center border border-white/5 shrink-0">
              <span className="block text-[8px] uppercase tracking-wider font-bold text-white/50 mb-0.5">Distribution Stock Balance</span>
              <span className="text-lg font-black text-amber-400 font-mono leading-none">
                {selectedDeskProgram.remainingStock} <span className="text-xs font-semibold">/ {selectedDeskProgram.targetStockSize} Pacs</span>
              </span>
            </div>
          </div>

          {deskAlert && (
            <div className={`border text-xs font-semibold px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-250 ${
              deskAlert.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {deskAlert.type === 'success' ? (
                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">&check;</span>
              ) : (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0">&times;</span>
              )}
              <span className="flex-1">{deskAlert.message}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Left Portion: Verification & distribution allocation fields (7 span columns) */}
            <div className="md:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5">
              <div className="pb-3 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Beneficiary Identity Verification Pane
                </h3>
                <span className="text-[10px] text-slate-400 text-right leading-none">
                  Camp desk registrar: {currentUser.name}
                </span>
              </div>

              {/* Verified Identity Search Controls */}
              <div className="space-y-3 relative pb-1">
                <label className="block text-xs font-semibold text-slate-600">
                  Verify by Name, Contact, NID or Unique ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={deskSearchQuery}
                    onChange={(e) => setDeskSearchQuery(e.target.value)}
                    placeholder="Type Name, Mobile, NID or ID digits..."
                    className="flex-grow border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 font-mono uppercase focus:ring-1 focus:ring-emerald-500 outline-none"
                  />
                  <button
                    onClick={executeDeskSearch}
                    className="bg-slate-800 hover:bg-slate-900 border border-slate-705 text-white font-bold text-xs px-4 rounded-lg cursor-pointer"
                  >
                    Load Profile
                  </button>
                  <button
                    onClick={() => setDeskFaceScanOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs p-2.5 rounded-lg cursor-pointer flex items-center justify-center shadow-sm"
                    title="Biometric scan"
                  >
                    <Scan className="w-5 h-5" />
                  </button>
                </div>

                {/* Recommendations list dropdown */}
                {deskSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto divide-y divide-slate-150">
                    {deskSuggestions.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setDeskSearchQuery(b.id);
                          checkDuplicationAndSet(b);
                        }}
                        className="w-full text-left p-3 hover:bg-slate-50 transition flex justify-between items-center text-xs cursor-pointer"
                      >
                        <div className="leading-tight">
                          <span className="font-bold text-slate-800 block">{b.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            ID: {b.id} &bull; Contact: {b.mobile}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 border border-emerald-110 rounded font-bold uppercase">
                          NID: {b.nidOrBirthCert}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Double scan duplication alert warnings */}
              {duplicateWarning && (
                <div className="bg-red-50 border border-red-200 text-red-00 text-xs p-3.5 rounded-xl flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-bold text-red-900 mb-0.5 text-xs">Duplicate Claim Registered</h5>
                    <p className="text-red-700 leading-normal">{duplicateWarning}</p>
                  </div>
                </div>
              )}

              {/* Active loaded profile desk view */}
              {deskSelectedBeneficiary ? (
                <div className="border border-slate-200 bg-slate-50/50 rounded-xl p-4 space-y-4">
                  <div className="flex gap-3.5">
                    {/* Visual profile */}
                    <div className="w-16 h-20 bg-slate-200 border border-slate-300 rounded-lg overflow-hidden shrink-0">
                      {deskSelectedBeneficiary.photo ? (
                        <img 
                          src={deskSelectedBeneficiary.photo}
                          referrerPolicy="no-referrer"
                          alt="Loaded Face"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="text-center text-[8px] font-bold text-slate-500 pt-6">NO PHOTO</div>
                      )}
                    </div>

                    <div className="space-y-1 text-left flex-grow">
                      <h4 className="text-xs font-bold text-slate-900 uppercase">
                        {deskSelectedBeneficiary.name}
                      </h4>
                      <div className="space-y-0.5 text-[10px] text-slate-500 font-medium">
                        <p>Unique ID: <span className="font-mono font-bold text-slate-750">{deskSelectedBeneficiary.id}</span></p>
                        <p>NID: <span className="font-mono">{deskSelectedBeneficiary.nidOrBirthCert}</span></p>
                        <p>Contact No: <span className="font-mono">{deskSelectedBeneficiary.mobile || 'None'}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Allocation package selection controls */}
                  {!duplicateWarning && (
                    <div className="bg-white border-t border-slate-100 pt-3.5 mt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                          Items Allocation portion size <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={selectedDeskProgram.remainingStock}
                          value={packageCount}
                          onChange={(e) => setPackageCount(parseInt(e.target.value) || 1)}
                          className="border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-700 w-28 focus:ring-1 focus:ring-emerald-500 outline-none"
                        />
                      </div>

                      <button
                        onClick={serveBeneficiary}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs py-2 px-6 rounded-xl flex items-center gap-1.5 shadow-sm select-none cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        Authorize Service allocation
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-slate-400 text-xs">
                  <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-1 opacity-60" />
                  Verify identity above. Search or use the instant Biometric Face Scan.
                </div>
              )}
            </div>

            {/* Right Portion: Served transactions list logs (5 columns) */}
            <div className="md:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b border-gray-150">
                Served History Records Log ({serviceRecords.filter(sr => sr.programId === selectedDeskProgram.id).length})
              </h3>

              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {serviceRecords.filter((sr) => sr.programId === selectedDeskProgram.id).length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-xs text-slate-400 bg-slate-50 border border-dashed rounded-lg">
                    No packages allocated out under this program yet.
                  </div>
                ) : (
                  serviceRecords
                    .filter((sr) => sr.programId === selectedDeskProgram.id)
                    .map((sr) => {
                      const bMatch = beneficiaries.find((b) => b.id === sr.beneficiaryId);
                      return (
                        <div 
                          key={sr.id}
                          className="bg-slate-50 border border-slate-100 rounded-lg p-3 text-xs leading-normal flex items-start justify-between gap-2"
                        >
                          <div>
                            <p className="font-bold text-slate-850 uppercase flex items-center gap-1.5">
                              {bMatch ? bMatch.name : 'Unknown Beneficiary'}
                              <span className="text-[10px] font-mono font-medium text-slate-400 select-all font-mono">({sr.beneficiaryId})</span>
                            </p>
                            
                            {/* Allocation details */}
                            <div className="text-[10px] text-slate-500 font-mono mt-1 space-y-0.5">
                              <p className="flex items-center gap-1">
                                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                                Assigned Count:{' '}
                                <span className="font-semibold text-slate-800">{sr.packageCount} packs</span>
                              </p>
                              <p>Date: {new Date(sr.servedDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>

                            {/* Authentication Admin Attribution Tag */}
                            <div className="mt-2.5">
                              <span className="text-[8.5px] bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 border border-emerald-110 rounded">
                                Served by: {sr.servedAdmin}
                              </span>
                            </div>
                          </div>

                          {/* Quick Edit triggers */}
                          <div className="flex flex-col gap-1 items-end pt-0.5">
                            <span className="text-[9px] text-slate-400 font-bold uppercase mb-1">Portion Count</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditPackageCount(sr, sr.packageCount - 1)}
                                disabled={sr.packageCount <= 1}
                                className="w-6 h-6 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center rounded font-extrabold text-xs disabled:opacity-30 cursor-pointer shadow-sm"
                                title="Decrease allocation"
                              >
                                -
                              </button>
                              <span className="w-5 text-center font-mono font-bold text-xs text-slate-800">
                                {sr.packageCount}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleEditPackageCount(sr, sr.packageCount + 1)}
                                disabled={selectedDeskProgram.remainingStock <= 0}
                                className="w-6 h-6 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center rounded font-extrabold text-xs disabled:opacity-30 cursor-pointer shadow-sm"
                                title="Increase allocation"
                              >
                                +
                              </button>
                            </div>

                            <button
                              onClick={() => handleUndoServe(sr)}
                              className="text-slate-400 hover:text-red-600 border border-slate-200 p-1.5 rounded hover:bg-white cursor-pointer transition mt-2"
                              title="Revoke distribution logs"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

          </div>

          {/* Biometric scanning screen popups */}
          {deskFaceScanOpen && (
            <div className="bg-slate-900/60 backdrop-blur-sm fixed inset-0 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl p-4 max-w-sm w-full relative">
                <button
                  onClick={() => setDeskFaceScanOpen(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 border rounded-full w-5 h-5 flex items-center justify-center font-bold"
                >
                  &times;
                </button>
                <FaceScanner
                  beneficiaries={beneficiaries}
                  onMatchFound={(b) => handleFaceScannerMatch(b)}
                  onNoMatchFound={(frame) => {
                    setDeskFaceScanOpen(false);
                    showDeskAlert('error', "No matching profiles detected. Register this beneficiary inside global directory first!");
                  }}
                />
              </div>
            </div>
          )}

        </div>
      )}

      {/* 3. Global parameters popups view */}
      {viewDetailsProgram && (
        <div className="bg-slate-900/40 backdrop-blur-sm fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 relative">
            <button
              onClick={() => setViewDetailsProgram(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center hover:bg-slate-50 cursor-pointer"
            >
              &times;
            </button>

            <span className="text-[9px] font-bold font-mono tracking-widest text-emerald-600 uppercase">
              {viewDetailsProgram.id} &bull; Details records
            </span>
            <h3 className="text-sm font-bold text-slate-800 font-display mt-1 leading-tight">{viewDetailsProgram.name}</h3>
            
            <div className="border border-slate-250 bg-slate-50/50 rounded-xl p-3.5 mt-4 space-y-2 text-xs text-slate-600 text-left leading-normal">
              <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100">
                <span className="col-span-5 font-bold">Category:</span>
                <span className="col-span-7 font-medium text-slate-800">{viewDetailsProgram.type}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100">
                <span className="col-span-5 font-bold">Community Scope:</span>
                <span className="col-span-7 font-medium text-slate-800">{viewDetailsProgram.beneficiaryCommunity}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100">
                <span className="col-span-5 font-bold">Timeline Date:</span>
                <span className="col-span-7 font-medium text-slate-800 font-mono">{viewDetailsProgram.programDate}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100">
                <span className="col-span-5 font-bold">Run Duration:</span>
                <span className="col-span-7 font-medium text-slate-800">{viewDetailsProgram.programDuration}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100">
                <span className="col-span-5 font-bold">Linking Donors:</span>
                <span className="col-span-7 font-medium text-slate-850">{getDonorNames(viewDetailsProgram.donors)}</span>
              </div>
              <div className="grid grid-cols-12 gap-1 py-1">
                <span className="col-span-5 font-bold text-amber-700">Inventory Left:</span>
                <span className="col-span-7 font-bold text-slate-850 font-mono">
                  {viewDetailsProgram.remainingStock} of {viewDetailsProgram.targetStockSize} bags ({Math.round((viewDetailsProgram.remainingStock / viewDetailsProgram.targetStockSize) * 100)}%)
                </span>
              </div>
            </div>

            <div className="mt-5">
              <h5 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">
                Served Beneficiaries Under Project ({serviceRecords.filter(sr => sr.programId === viewDetailsProgram.id).length})
              </h5>
              <div className="max-h-36 overflow-y-auto space-y-1 bg-slate-50 p-2 rounded-lg border">
                {serviceRecords.filter(sr => sr.programId === viewDetailsProgram.id).length === 0 ? (
                  <p className="text-[10px] text-slate-400 text-center py-4">No services distributed yet.</p>
                ) : (
                  serviceRecords.filter(sr => sr.programId === viewDetailsProgram.id).map(sr => {
                    const b = beneficiaries.find(x => x.id === sr.beneficiaryId);
                    return (
                      <div key={sr.id} className="text-[10px] flex justify-between bg-white px-2 py-1.5 rounded shadow-sm border border-slate-100 font-medium">
                        <span className="font-bold text-slate-850 truncate max-w-[120px]">{b ? b.name : sr.beneficiaryId}</span>
                        <span className="text-emerald-700 font-bold shrink-0">{sr.packageCount} packs serve</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
