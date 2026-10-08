import { useState, useEffect } from 'react';
import { User, Program, Beneficiary, ServiceRecord, ProgramType, BeneficiaryCommunity } from '../types';
import FaceScanner from './FaceScanner';
import * as XLSX from 'xlsx';
import { 
  Building, BookOpen, Layers, Search, Eye, ClipboardList, PenTool, CheckCircle, 
  AlertCircle, ChevronRight, CornerDownRight, RotateCcw, HelpCircle, Scan,
  Trash2, UserCheck, Plus, ShoppingBag, Download, Boxes, Users, Tent, MapPin, Zap, CheckCheck, Building2
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
  onNavigateToInventory?: (programId: string) => void;
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
  onUpdateServiceRecordPackageCount,
  onNavigateToInventory
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

  // Anonymous Distribution States (রোহিঙ্গা ও ফিল্ড ক্যাম্প বিতরণ মোড)
  const [distributionMode, setDistributionMode] = useState<'registered' | 'anonymous'>('registered');
  const [anonCommunity, setAnonCommunity] = useState<BeneficiaryCommunity>('Rohingya Community');
  const [anonCampOrLocation, setAnonCampOrLocation] = useState<string>('উখিয়া রোহিঙ্গা ক্যাম্প ১২');
  const [anonRecipientToken, setAnonRecipientToken] = useState<string>('');
  const [anonWarehouse, setAnonWarehouse] = useState<string>('');
  const [anonPackageCount, setAnonPackageCount] = useState<number>(1);
  const [anonNotes, setAnonNotes] = useState<string>('');
  const [anonDistributionTab, setAnonDistributionTab] = useState<'single' | 'batch'>('single');
  const [anonBatchRecipients, setAnonBatchRecipients] = useState<number>(50);
  const [anonBatchPerPersonPacks, setAnonBatchPerPersonPacks] = useState<number>(1);

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

  // Sync defaults when opening a desk program
  useEffect(() => {
    if (selectedDeskProgram) {
      if (selectedDeskProgram.beneficiaryCommunity === 'Rohingya Community' || selectedDeskProgram.type === 'Rohingya Program') {
        setDistributionMode('anonymous');
        setAnonCommunity('Rohingya Community');
      }
      if (selectedDeskProgram.warehouses && selectedDeskProgram.warehouses.length > 0) {
        setAnonWarehouse(selectedDeskProgram.warehouses[0]);
      }
      if (selectedDeskProgram.locations && selectedDeskProgram.locations.length > 0) {
        setAnonCampOrLocation(selectedDeskProgram.locations[0]);
      }
    }
  }, [selectedDeskProgramId]);

  // Serve Anonymous Beneficiary (1-by-1, repeatable, no directory entry required)
  const serveAnonymousBeneficiary = () => {
    if (!selectedDeskProgram) return;
    if (anonPackageCount < 1) return;

    if (selectedDeskProgram.remainingStock < anonPackageCount) {
      showDeskAlert('error', `পর্যাপ্ত স্টক নেই! অবশিষ্ট আছে মাত্র ${selectedDeskProgram.remainingStock} টি প্যাকেজ।`);
      return;
    }

    const progAnonRecords = serviceRecords.filter(sr => sr.programId === selectedDeskProgram.id && sr.isAnonymous);
    const seqNum = progAnonRecords.length + 1;
    const token = anonRecipientToken.trim() || `ANON-${anonCommunity.includes('Rohingya') ? 'ROH' : 'LOC'}-${seqNum.toString().padStart(3, '0')}`;
    const targetWh = anonWarehouse || (selectedDeskProgram.warehouses?.[0] || 'প্রধান গুদাম');
    const campLoc = anonCampOrLocation.trim() || (selectedDeskProgram.locations?.[0] || 'বিতরণস্থল');

    const newRecord: ServiceRecord = {
      id: `SR-ANON-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      programId: selectedDeskProgram.id,
      beneficiaryId: `ANONYMOUS-${anonCommunity.replace(/\s+/g, '-').toUpperCase()}-${Date.now().toString().slice(-4)}`,
      packageCount: anonPackageCount,
      servedDate: new Date().toISOString(),
      servedAdmin: currentUser.name || currentUser.id,
      isAnonymous: true,
      community: anonCommunity,
      recipientLabel: `${token} (${anonCommunity === 'Rohingya Community' ? 'রোহিঙ্গা শরণার্থী' : 'স্থানীয় নাগরিক'})`,
      campOrLocation: campLoc,
      warehouse: targetWh,
      notes: anonNotes.trim()
    };

    onSaveServiceRecord(newRecord);

    const updatedRemaining = selectedDeskProgram.remainingStock - anonPackageCount;
    onUpdateRemainingStock(selectedDeskProgram.id, updatedRemaining);

    showDeskAlert('success', `সফল! ${newRecord.recipientLabel}-কে ${anonPackageCount} টি প্যাকেজ সফলভাবে বিতরণ করা হয়েছে। [বিতরণস্থল: ${campLoc}, গুদাম: ${targetWh}]`);
    setAnonRecipientToken('');
  };

  // Serve Anonymous Batch (Bulk distribution to multiple people at once)
  const serveAnonymousBatch = () => {
    if (!selectedDeskProgram) return;
    const totalRecipients = Number(anonBatchRecipients) || 0;
    const perPersonCount = Number(anonBatchPerPersonPacks) || 0;
    const totalPacksNeeded = totalRecipients * perPersonCount;

    if (totalRecipients <= 0 || perPersonCount <= 0) {
      showDeskAlert('error', 'সঠিক প্রাপক সংখ্যা ও প্যাকেজ সংখ্যা দিন!');
      return;
    }

    if (selectedDeskProgram.remainingStock < totalPacksNeeded) {
      showDeskAlert('error', `পর্যাপ্ত স্টক নেই! মোট ${totalPacksNeeded} টি প্যাকেজ প্রয়োজন কিন্তু অবশিষ্ট আছে মাত্র ${selectedDeskProgram.remainingStock} টি প্যাকেজ।`);
      return;
    }

    const progAnonRecords = serviceRecords.filter(sr => sr.programId === selectedDeskProgram.id && sr.isAnonymous);
    const startSeq = progAnonRecords.length;
    const targetWh = anonWarehouse || (selectedDeskProgram.warehouses?.[0] || 'প্রধান গুদাম');
    const campLoc = anonCampOrLocation.trim() || (selectedDeskProgram.locations?.[0] || 'বিতরণস্থল');

    for (let i = 1; i <= totalRecipients; i++) {
      const seqNum = startSeq + i;
      const token = `ANON-${anonCommunity.includes('Rohingya') ? 'ROH' : 'LOC'}-${seqNum.toString().padStart(3, '0')}`;
      const rec: ServiceRecord = {
        id: `SR-ANON-${Date.now()}-${i}-${Math.floor(100 + Math.random() * 900)}`,
        programId: selectedDeskProgram.id,
        beneficiaryId: `ANONYMOUS-${anonCommunity.replace(/\s+/g, '-').toUpperCase()}-${seqNum}`,
        packageCount: perPersonCount,
        servedDate: new Date().toISOString(),
        servedAdmin: currentUser.name || currentUser.id,
        isAnonymous: true,
        community: anonCommunity,
        recipientLabel: `${token} (${anonCommunity === 'Rohingya Community' ? 'রোহিঙ্গা শরণার্থী' : 'স্থানীয় নাগরিক'})`,
        campOrLocation: campLoc,
        warehouse: targetWh,
        notes: anonNotes.trim() ? `${anonNotes.trim()} [ব্যাচ বিতরণ: ${totalRecipients} জন]` : `বাল্ক ব্যাচ বিতরণ: ${totalRecipients} জন`
      };
      onSaveServiceRecord(rec);
    }

    const updatedRemaining = selectedDeskProgram.remainingStock - totalPacksNeeded;
    onUpdateRemainingStock(selectedDeskProgram.id, updatedRemaining);

    showDeskAlert('success', `সফল! মোট ${totalRecipients} জন ${anonCommunity === 'Rohingya Community' ? 'রোহিঙ্গা' : 'স্থানীয়'} সুবিধাভোগীকে ${totalPacksNeeded} টি প্যাকেজ সফলভাবে বিতরণ করা হয়েছে। [বিতরণস্থল: ${campLoc}, গুদাম: ${targetWh}]`);
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
                  const invAssembled = (p.inventoryPackages || []).reduce((sum, pkg) => sum + (pkg.assembledQuantity || 0), 0);
                  const invItemsCount = (p.inventoryItems || []).length;
                  const servedCount = serviceRecords.filter(sr => sr.programId === p.id).reduce((sum, sr) => sum + sr.packageCount, 0);
                  const effectiveTargetStock = invAssembled > 0 ? invAssembled : p.targetStockSize;
                  const effectiveRemainingStock = invAssembled > 0 ? Math.max(0, invAssembled - servedCount) : p.remainingStock;
                  const percentDone = effectiveTargetStock > 0 
                    ? Math.min(100, Math.round(((effectiveTargetStock - effectiveRemainingStock) / effectiveTargetStock) * 100))
                    : 0;

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

                      <h4 className="text-xs font-bold font-display text-slate-850 group-hover:text-emerald-700 transition leading-snug line-clamp-2 h-9 mb-2">
                        {p.name}
                      </h4>

                      {/* Prominent Dynamic Inventory Packages Card Section */}
                      <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-2.5 my-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-amber-950 mb-1">
                          <div className="flex items-center gap-1.5">
                            <Boxes className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="text-[10.5px] font-bold">ইনভেন্টরি প্যাকেজ হিসাব:</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-black ${
                            invAssembled > 0 ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {invAssembled} টি প্যাক
                          </span>
                        </div>

                        {p.inventoryPackages && p.inventoryPackages.length > 0 ? (
                          <div className="space-y-1 mt-1.5 pt-1.5 border-t border-amber-200/60 text-[10.5px]">
                            <div className="flex flex-wrap gap-1">
                              {p.inventoryPackages.map((pkg, idx) => (
                                <span key={idx} className="bg-white border border-amber-200 text-amber-900 px-1.5 py-0.5 rounded text-[9.5px] font-semibold flex items-center gap-1">
                                  <span>{pkg.name}:</span>
                                  <strong className="text-amber-700 font-mono font-bold">{pkg.assembledQuantity} টি</strong>
                                </span>
                              ))}
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-amber-900 font-medium pt-1">
                              <span>অবশিষ্ট বিতরণযোগ্য: <strong className="text-emerald-700 font-bold">{effectiveRemainingStock} টি</strong></span>
                              <span>উপাদান পণ্য: <strong className="text-slate-700">{invItemsCount} টি</strong></span>
                            </div>

                            {/* Warehouses list if configured */}
                            {p.warehouses && p.warehouses.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap text-[9px] text-slate-500 pt-1 border-t border-amber-200/40">
                                <span className="font-bold text-slate-400">গুদাম ({p.warehouses.length}):</span>
                                {p.warehouses.map(w => (
                                  <span key={w} className="bg-white/80 border border-amber-200 text-amber-900 px-1.5 py-0.2 rounded font-medium">
                                    📍 {w}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Distribution Locations list if configured */}
                            {p.locations && p.locations.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap text-[9px] text-emerald-800 pt-1 border-t border-amber-200/40">
                                <span className="font-bold text-slate-400">বিতরণ এলাকা ({p.locations.length}):</span>
                                {p.locations.map(loc => (
                                  <span key={loc} className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded font-semibold">
                                    🎯 {loc}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-between items-center text-[10px] text-amber-800 pt-0.5">
                            <span>{invItemsCount > 0 ? `${invItemsCount} টি মালামাল আইটেম স্টকে আছে` : 'পণ্য ও প্যাকেজ সেট করুন'}</span>
                            {onNavigateToInventory && (
                              <button
                                onClick={() => onNavigateToInventory(p.id)}
                                className="text-amber-700 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                              >
                                <span>প্যাকেজ বানান</span> &rarr;
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="mt-auto space-y-2.5">
                        {/* Compact statistics */}
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                          <span>Target / মোট প্যাকেজ:</span>
                          <span className="text-slate-800 font-bold font-mono">
                            {effectiveTargetStock} packs {invAssembled > 0 ? '(ইনভেন্টরি)' : ''}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                          <span>Distributed Served:</span>
                          <span className="text-amber-700 font-extrabold font-mono">{effectiveTargetStock - effectiveRemainingStock} packs</span>
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
                            className="bg-transparent hover:bg-slate-50 border border-slate-200 text-slate-650 font-semibold text-[10px] py-1.5 px-2 rounded-md flex items-center justify-center gap-1 cursor-pointer transition flex-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>

                          {onNavigateToInventory && (
                            <button
                              onClick={() => onNavigateToInventory(p.id)}
                              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] py-1.5 px-2 rounded-md flex items-center justify-center gap-1 cursor-pointer transition shadow-xs flex-1"
                              title="ইনভেন্টরি ও মালামাল হিসাব পরিচালনা করুন"
                            >
                              <Boxes className="w-3.5 h-3.5" />
                              ইনভেন্টরি
                            </button>
                          )}

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
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] py-1.5 px-2 rounded-md flex items-center justify-center gap-1 cursor-pointer shadow-sm transition flex-1"
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
            <div className="md:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
              <div className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-emerald-600" />
                    <span>ত্রাণ ও প্যাকেজ বিতরণ ডেস্ক (Distribution Pane)</span>
                  </h3>
                  <span className="text-[10.5px] text-slate-400 font-mono">
                    রেজিস্ট্রার / দায়িত্বপ্রাপ্ত কর্মকর্তা: <strong className="text-slate-700">{currentUser.name}</strong>
                  </span>
                </div>
                
                {/* Available distribution balance */}
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  অবশিষ্ট স্টক: {selectedDeskProgram.remainingStock} টি প্যাকেজ
                </span>
              </div>

              {/* MODE SWITCHER: REGISTERED VS ANONYMOUS */}
              <div className="bg-slate-100 p-1.5 rounded-2xl flex items-center gap-1.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDistributionMode('registered')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    distributionMode === 'registered'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <UserCheck className={`w-4 h-4 ${distributionMode === 'registered' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>নিবন্ধিত সুবিধাভোগী (Registered)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDistributionMode('anonymous')}
                  className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    distributionMode === 'anonymous'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                  }`}
                >
                  <Tent className="w-4 h-4" />
                  <span>অ্যানোনিমাস বিতরণ (Anonymous Distribution)</span>
                </button>
              </div>

              {/* ===================== 1. ANONYMOUS DISTRIBUTION MODE ===================== */}
              {distributionMode === 'anonymous' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="bg-amber-50 border border-amber-200/90 rounded-2xl p-4 text-xs">
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-amber-200 text-amber-800 rounded-lg shrink-0 mt-0.5">
                        <Tent className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-amber-900 mb-0.5">
                          অ্যানোনিমাস বিতরণ মোড (Anonymous Distribution)
                        </h4>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          জরুরি ত্রাণ বিতরণ বা বিশেষ পরিস্থিতিতে ব্যক্তিগত তথ্য সংরক্ষণ না করে সরাসরি বিতরণ সম্পন্ন করার মোড। সুবিধাভোগী সম্প্রদায় ও বিতরণস্থল নির্বাচন করে তাৎক্ষণিক বিতরণ সম্পন্ন করা যাবে।
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Community Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      সুবিধাভোগী সম্প্রদায় (Beneficiary Community) *
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'Rohingya Community' as BeneficiaryCommunity, label: 'রোহিঙ্গা শরণার্থী', icon: '🏕️' },
                        { key: 'Local Community' as BeneficiaryCommunity, label: 'স্থানীয় নাগরিক', icon: '🏠' },
                        { key: 'Other Community' as BeneficiaryCommunity, label: 'অন্যান্য', icon: '🌐' }
                      ].map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setAnonCommunity(item.key)}
                          className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                            anonCommunity === item.key
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span className="text-base">{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Warehouse Location Selector */}
                  {selectedDeskProgram.warehouses && selectedDeskProgram.warehouses.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-amber-600" />
                          মালামাল ছাড়কারী গুদাম (Disbursement Warehouse) *
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {selectedDeskProgram.warehouses.length} টি গুদাম উপলব্ধ
                        </span>
                      </label>
                      <select
                        value={anonWarehouse || selectedDeskProgram.warehouses[0]}
                        onChange={(e) => setAnonWarehouse(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        {selectedDeskProgram.warehouses.map(wh => (
                          <option key={wh} value={wh}>📍 {wh} গুদাম</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Distribution Location / Area (বিতরণস্থল) */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-600" />
                        <span>বিতরণস্থল (Distribution Location / Area) *</span>
                      </label>
                      {selectedDeskProgram.locations && selectedDeskProgram.locations.length > 0 && (
                        <span className="text-[10.5px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md font-mono font-bold">
                          প্রোগ্রামের নির্ধারিত এলাকা: {selectedDeskProgram.locations.length} টি
                        </span>
                      )}
                    </div>

                    {selectedDeskProgram.locations && selectedDeskProgram.locations.length > 0 ? (
                      <div className="space-y-2">
                        {/* Dropdown Selector */}
                        <select
                          value={anonCampOrLocation || selectedDeskProgram.locations[0]}
                          onChange={(e) => setAnonCampOrLocation(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          {selectedDeskProgram.locations.map(loc => (
                            <option key={loc} value={loc}>
                              🎯 {loc}
                            </option>
                          ))}
                        </select>

                        {/* Quick 1-click selectable location buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[10px] font-bold text-slate-400">কুইক সিলেক্ট:</span>
                          {selectedDeskProgram.locations.map(loc => {
                            const isSelected = (anonCampOrLocation || selectedDeskProgram.locations![0]) === loc;
                            return (
                              <button
                                key={loc}
                                type="button"
                                onClick={() => setAnonCampOrLocation(loc)}
                                className={`text-xs px-2.5 py-1 rounded-lg font-bold border transition cursor-pointer flex items-center gap-1 ${
                                  isSelected
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                <span>🎯 {loc}</span>
                                {isSelected && <span className="text-[10px]">✓</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* Fallback input if program doesn't have locations configured yet */
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={anonCampOrLocation}
                          onChange={(e) => setAnonCampOrLocation(e.target.value)}
                          placeholder="বিতরণস্থলের নাম লিখুন (যেমন: উখিয়া ক্যাম্প ১২, টেকনাফ লেদা)..."
                          className="w-full border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800 outline-none focus:ring-1 focus:ring-amber-500 bg-white"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-400">প্রস্তাবিত বিতরণস্থল:</span>
                          {['উখিয়া ক্যাম্প ১২', 'টেকনাফ লেদা', 'কুতুপালং ক্যাম্প', 'ময়মনসিংহ সদর', 'কক্সবাজার সদর'].map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setAnonCampOrLocation(preset)}
                              className="text-[10px] bg-white hover:bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium border border-slate-200 cursor-pointer transition"
                            >
                              +{preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tabs: Single 1-Click Serve vs Batch Bulk Serve */}
                  <div className="border-t border-slate-200 pt-3">
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setAnonDistributionTab('single')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          anonDistributionTab === 'single'
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        একক বিতরণ (১-ক্লিকে বিতরণ)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnonDistributionTab('batch')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                          anonDistributionTab === 'batch'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>বাল্ক বিতরণ (একসাথে একাধিক)</span>
                      </button>
                    </div>

                    {/* Single 1-Click Serve View */}
                    {anonDistributionTab === 'single' && (
                      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              প্যাকেজ সংখ্যা (প্রতি জন) *
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={selectedDeskProgram.remainingStock}
                              value={anonPackageCount}
                              onChange={(e) => setAnonPackageCount(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              টোকেন / স্লিপ নং (ঐচ্ছিক)
                            </label>
                            <input
                              type="text"
                              value={anonRecipientToken}
                              onChange={(e) => setAnonRecipientToken(e.target.value)}
                              placeholder="খালি রাখলে অটো টোকেন হবে"
                              className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-mono text-slate-800 outline-none"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            মন্তব্য / রেফারেন্স (ঐচ্ছিক)
                          </label>
                          <input
                            type="text"
                            value={anonNotes}
                            onChange={(e) => setAnonNotes(e.target.value)}
                            placeholder="যেমন: স্লিপ জমা নেওয়া হয়েছে, ট্রিপল-এ ত্রিপল ও কম্বল সেট"
                            className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={serveAnonymousBeneficiary}
                          disabled={selectedDeskProgram.remainingStock < anonPackageCount}
                          className="w-full bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:bg-slate-300 text-white font-extrabold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition"
                        >
                          <Zap className="w-4 h-4 text-amber-200" />
                          <span>বিতরণ নিশ্চিত করুন ({anonPackageCount} টি প্যাকেজ)</span>
                        </button>
                        <p className="text-[10px] text-slate-400 text-center">
                          প্রতিটি ক্লিকে নতুন অ্যানোনিমাস রেকর্ড তৈরি হবে এবং তাৎক্ষণিক স্টক কমবে।
                        </p>
                      </div>
                    )}

                    {/* Batch Bulk Serve View */}
                    {anonDistributionTab === 'batch' && (
                      <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              মোট সুবিধাভোগী সংখ্যা (Recipients) *
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={selectedDeskProgram.remainingStock}
                              value={anonBatchRecipients}
                              onChange={(e) => setAnonBatchRecipients(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-800 outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              প্রতি জনকে প্যাকেজ সংখ্যা *
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={anonBatchPerPersonPacks}
                              onChange={(e) => setAnonBatchPerPersonPacks(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-full bg-white border border-amber-300 rounded-xl p-2.5 text-xs font-mono font-bold text-slate-800 outline-none"
                            />
                          </div>
                        </div>

                        <div className="p-3 bg-white border border-amber-200 rounded-xl flex items-center justify-between">
                          <span className="text-xs text-slate-600 font-medium">
                            মোট প্রয়োজনীয় প্যাকেজ:
                          </span>
                          <span className="text-sm font-black text-amber-700 font-mono">
                            {anonBatchRecipients * anonBatchPerPersonPacks} টি প্যাকেজ
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={serveAnonymousBatch}
                          disabled={selectedDeskProgram.remainingStock < (anonBatchRecipients * anonBatchPerPersonPacks)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 text-white font-extrabold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition"
                        >
                          <CheckCheck className="w-4 h-4 text-emerald-200" />
                          <span>একসাথে {anonBatchRecipients} জন সুবিধাভোগীকে বিতরণ সম্পন্ন করুন</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===================== 2. REGISTERED BENEFICIARY MODE ===================== */}
              {distributionMode === 'registered' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Verified Identity Search Controls */}
                  <div className="space-y-3 relative pb-1">
                    <label className="block text-xs font-semibold text-slate-600">
                      নাম, মোবাইল, এনআইডি বা ইউনিক আইডি দিয়ে যাচাই করুন
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
                        প্রোফাইল লোড
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
                      উপরে সুবিধাভোগীর তথ্য সার্চ করুন অথবা ফেস স্ক্যানার দিয়ে প্রোফাইল লোড করুন।
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Portion: Served transactions list logs (5 columns) */}
            <div className="md:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm space-y-4">
              {(() => {
                const progRecords = serviceRecords.filter(sr => sr.programId === selectedDeskProgram.id);
                const anonCount = progRecords.filter(sr => sr.isAnonymous).length;
                const regCount = progRecords.filter(sr => !sr.isAnonymous).length;
                const totalPacks = progRecords.reduce((sum, sr) => sum + sr.packageCount, 0);

                return (
                  <div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-150">
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        বিতরণ হিস্ট্রি লগ ({progRecords.length})
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        মোট: {totalPacks} প্যাক
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 pt-1.5 font-medium">
                      <span>নিবন্ধিত: <strong className="text-slate-800">{regCount}</strong> জন</span>
                      <span>&bull;</span>
                      <span>অ্যানোনিমাস: <strong className="text-amber-700">{anonCount}</strong> জন</span>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {serviceRecords.filter((sr) => sr.programId === selectedDeskProgram.id).length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs bg-slate-50 border border-dashed rounded-xl">
                    এই প্রোগ্রামের আওতায় এখনও কোনো ত্রাণ বা প্যাকেজ বিতরণ করা হয়নি।
                  </div>
                ) : (
                  serviceRecords
                    .filter((sr) => sr.programId === selectedDeskProgram.id)
                    .map((sr) => {
                      const bMatch = beneficiaries.find((b) => b.id === sr.beneficiaryId);
                      const isAnon = sr.isAnonymous || sr.beneficiaryId.startsWith('ANON');
                      
                      return (
                        <div 
                          key={sr.id}
                          className={`rounded-xl p-3.5 text-xs leading-normal flex items-start justify-between gap-2 border transition ${
                            isAnon 
                              ? 'bg-amber-50/40 border-amber-200/70 hover:bg-amber-50/70' 
                              : 'bg-slate-50 border-slate-200/80 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="space-y-1">
                            {isAnon ? (
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-black text-slate-900 text-xs">
                                    {sr.recipientLabel || 'অ্যানোনিমাস প্রাপক'}
                                  </span>
                                  <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full border border-amber-200">
                                    🏕️ {sr.community === 'Rohingya Community' ? 'রোহিঙ্গা শরণার্থী' : 'অ্যানোনিমাস'}
                                  </span>
                                  {sr.warehouse && (
                                    <span className="text-[9px] bg-slate-200/70 text-slate-700 font-medium px-1.5 py-0.2 rounded">
                                      📍 {sr.warehouse}
                                    </span>
                                  )}
                                </div>
                                {sr.campOrLocation && (
                                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    স্থান: {sr.campOrLocation}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div>
                                <p className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
                                  {bMatch ? bMatch.name : 'Unknown Beneficiary'}
                                  <span className="text-[10px] font-mono font-medium text-slate-400 select-all font-mono">({sr.beneficiaryId})</span>
                                </p>
                              </div>
                            )}
                            
                            {/* Allocation details */}
                            <div className="text-[10.5px] text-slate-600 font-mono pt-0.5 space-y-0.5">
                              <p className="flex items-center gap-1.5 font-bold text-slate-800">
                                <ShoppingBag className="w-3.5 h-3.5 text-emerald-600" />
                                <span>বিতরণকৃত প্যাকেজ: {sr.packageCount} টি</span>
                              </p>
                              <p className="text-[10px] text-slate-400">
                                সময়: {new Date(sr.servedDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>

                            {/* Authentication Admin Attribution Tag */}
                            <div className="pt-1 flex items-center gap-2 flex-wrap">
                              <span className="text-[8.5px] bg-white text-slate-600 font-semibold px-2 py-0.5 border border-slate-200 rounded-md">
                                কর্মকর্তা: {sr.servedAdmin}
                              </span>
                              {sr.notes && (
                                <span className="text-[9px] text-slate-400 italic">
                                  &quot;{sr.notes}&quot;
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quick Edit triggers */}
                          <div className="flex flex-col gap-1 items-end pt-0.5 shrink-0">
                            <span className="text-[9px] text-slate-400 font-bold uppercase mb-1">প্যাকেজ</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditPackageCount(sr, sr.packageCount - 1)}
                                disabled={sr.packageCount <= 1}
                                className="w-6 h-6 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center rounded font-extrabold text-xs disabled:opacity-30 cursor-pointer shadow-xs"
                                title="প্যাকেজ কমান"
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
                                className="w-6 h-6 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center rounded font-extrabold text-xs disabled:opacity-30 cursor-pointer shadow-xs"
                                title="প্যাকেজ বাড়ান"
                              >
                                +
                              </button>
                            </div>

                            <button
                              onClick={() => handleUndoServe(sr)}
                              className="text-slate-400 hover:text-red-600 border border-slate-200 p-1.5 rounded-lg hover:bg-white cursor-pointer transition mt-2 shadow-2xs"
                              title="বিতরণ বাতিল ও স্টক পুনরুদ্ধার করুন"
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

          {/* Biometric scanning screen modal */}
          {deskFaceScanOpen && (
            <FaceScanner
              beneficiaries={beneficiaries}
              onClose={() => setDeskFaceScanOpen(false)}
              onMatchFound={(b) => {
                setDeskFaceScanOpen(false);
                handleFaceScannerMatch(b);
              }}
              onNoMatchFound={(frame) => {
                setDeskFaceScanOpen(false);
                showDeskAlert('error', "No matching profiles detected. Register this beneficiary inside global directory first!");
              }}
            />
          )}

        </div>
      )}

      {/* 3. Global parameters popups view */}
      {viewDetailsProgram && (
        <div className="bg-slate-900/40 backdrop-blur-sm fixed inset-0 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
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
              {viewDetailsProgram.warehouses && viewDetailsProgram.warehouses.length > 0 && (
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100">
                  <span className="col-span-5 font-bold text-amber-700">সংরক্ষণ গুদাম:</span>
                  <span className="col-span-7 font-medium text-slate-800 flex flex-wrap gap-1">
                    {viewDetailsProgram.warehouses.map(wh => (
                      <span key={wh} className="bg-amber-50 text-amber-900 text-[10.5px] px-1.5 py-0.5 rounded border border-amber-200 font-semibold">
                        📍 {wh}
                      </span>
                    ))}
                  </span>
                </div>
              )}
              {viewDetailsProgram.locations && viewDetailsProgram.locations.length > 0 && (
                <div className="grid grid-cols-12 gap-1 py-1 border-b border-slate-100">
                  <span className="col-span-5 font-bold text-emerald-700">বিতরণ এলাকা/অঞ্চল:</span>
                  <span className="col-span-7 font-medium text-slate-800 flex flex-wrap gap-1">
                    {viewDetailsProgram.locations.map(loc => (
                      <span key={loc} className="bg-emerald-50 text-emerald-900 text-[10.5px] px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                        🎯 {loc}
                      </span>
                    ))}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-12 gap-1 py-1">
                <span className="col-span-5 font-bold text-amber-700">Inventory Packages:</span>
                <span className="col-span-7 font-bold text-slate-850 font-mono">
                  {viewDetailsProgram.remainingStock} of {viewDetailsProgram.targetStockSize} packs remaining ({Math.round((viewDetailsProgram.remainingStock / (viewDetailsProgram.targetStockSize || 1)) * 100)}%)
                </span>
              </div>
            </div>

            {/* Inventory Packages Breakdown in Details Modal */}
            {viewDetailsProgram.inventoryPackages && viewDetailsProgram.inventoryPackages.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-amber-600" />
                    প্যাকেজ রেসিপি ও উপাদান (Packages Composition)
                  </h5>
                  {onNavigateToInventory && (
                    <button
                      onClick={() => {
                        const id = viewDetailsProgram.id;
                        setViewDetailsProgram(null);
                        onNavigateToInventory(id);
                      }}
                      className="text-[10px] text-amber-700 hover:underline font-bold cursor-pointer"
                    >
                      ইনভেন্টরি ডেস্কে খুলুন &rarr;
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {viewDetailsProgram.inventoryPackages.map(pkg => (
                    <div key={pkg.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-800">{pkg.name}</span>
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                          {pkg.assembledQuantity} টি প্যাক প্রস্তুত
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        {pkg.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between font-mono">
                            <span>• {i.itemName}:</span>
                            <span className="font-bold text-indigo-700">{i.quantityPerPackage} {i.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw items snapshot in Details modal */}
            {viewDetailsProgram.inventoryItems && viewDetailsProgram.inventoryItems.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  গুদামে কাঁচামাল প্রাপ্তি ও স্টক (Raw Items Stock)
                </h5>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  {viewDetailsProgram.inventoryItems.map(item => {
                    const avail = Math.max(0, item.totalReceived - item.allocatedToPackages);
                    return (
                      <div key={item.id} className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex justify-between">
                        <span className="text-slate-700 truncate mr-1">{item.name}:</span>
                        <span className="font-bold text-emerald-700 shrink-0">{avail} {item.unit} বাকি</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
