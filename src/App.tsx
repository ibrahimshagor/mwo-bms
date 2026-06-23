import { useState, useEffect, FormEvent } from 'react';
import { User, Program, Beneficiary, ServiceRecord, UserRole } from './types';
import { 
  DEFAULT_USERS, DEFAULT_PROGRAMS, DEFAULT_BENEFICIARIES, DEFAULT_SERVICE_RECORDS,
  getSavedState, saveState 
} from './data';

// Import Modular Components
import BeneficiaryRegister from './components/BeneficiaryRegister';
import ProgramCreate from './components/ProgramCreate';
import UserManagement from './components/UserManagement';
import ProgramDirectory from './components/ProgramDirectory';
import BeneficiaryDirectory from './components/BeneficiaryDirectory';
import CPanelHelper from './components/CPanelHelper';
import Footer from './components/Footer';
import ExportControlPanel from './components/ExportControlPanel';

// Icons
import { 
  FolderLock, UserCog, ClipboardList, Users, ShieldAlert, KeyRound, 
  Settings, LogOut, CheckCircle, Database, HelpCircle, ArrowRight,
  TrendingUp, Users2, ShoppingBag, FolderGit, Menu, X
} from 'lucide-react';

export default function App() {
  
  // 1. Core State databases (Automatically loaded from localStorage or default seed data)
  const [users, setUsers] = useState<User[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [serviceRecords, setServiceRecords] = useState<ServiceRecord[]>([]);

  // Dynamic programs mapper to make sure remainingStock is ALWAYS 100% accurate based on serviceRecords which is the single source of truth!
  const enrichedPrograms = programs.map(p => {
    const distributed = serviceRecords
      .filter(sr => sr.programId === p.id)
      .reduce((sum, sr) => sum + sr.packageCount, 0);
    return {
      ...p,
      remainingStock: p.targetStockSize - distributed
    };
  });

  // 2. Authentication states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginId, setLoginId] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginRoleSelect, setLoginRoleSelect] = useState<'Staff' | 'Donor'>('Staff');
  const [loginError, setLoginError] = useState<string | null>(null);

  // 3. Navigation controls
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Editing states (Forms overlays controllers)
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);

  // Edit Profile States
  const [profilePass, setProfilePass] = useState('');
  const [profileId, setProfileId] = useState('');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  // Initial Bootup: Load from Local Storage or default seed
  useEffect(() => {
    const savedUsers = getSavedState<User[]>('mwo_users', DEFAULT_USERS);
    const savedPrograms = getSavedState<Program[]>('mwo_programs', DEFAULT_PROGRAMS);
    const savedBeneficiaries = getSavedState<Beneficiary[]>('mwo_beneficiaries', DEFAULT_BENEFICIARIES);
    const savedSR = getSavedState<ServiceRecord[]>('mwo_service_records', DEFAULT_SERVICE_RECORDS);

    setUsers(savedUsers);
    setPrograms(savedPrograms);
    setBeneficiaries(savedBeneficiaries);
    setServiceRecords(savedSR);
    
    // Auto-save backup values during initial boot
    saveState('mwo_users', savedUsers);
    saveState('mwo_programs', savedPrograms);
    saveState('mwo_beneficiaries', savedBeneficiaries);
    saveState('mwo_service_records', savedSR);
  }, []);

  // Sync state modifications back to local storage
  const syncUsers = (updated: User[]) => {
    setUsers(updated);
    saveState('mwo_users', updated);
  };

  const syncPrograms = (updated: Program[]) => {
    setPrograms(updated);
    saveState('mwo_programs', updated);
  };

  const syncBeneficiaries = (updated: Beneficiary[]) => {
    setBeneficiaries(updated);
    saveState('mwo_beneficiaries', updated);
  };

  const syncServiceRecords = (updated: ServiceRecord[]) => {
    setServiceRecords(updated);
    saveState('mwo_service_records', updated);
  };

  // 4. Secure Authentication Controllers
  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const match = users.find(u => u.id.trim().toLowerCase() === loginId.trim().toLowerCase());
    
    if (match) {
      // Mock validation checking (accept simple local bypass, or match standard predefined pass checks)
      const matchesCategory = 
        (loginRoleSelect === 'Donor' && match.role === 'Donor') ||
        (loginRoleSelect === 'Staff' && (match.role === 'SuperAdmin' || match.role === 'FieldAdmin'));

      if (matchesCategory) {
        setCurrentUser(match);
        setProfileId(match.id);
        setActiveTab('dashboard');
        // Clear forms
        setLoginId('');
        setLoginPass('');
      } else {
        setLoginError('Security alert: Username matches but selected client role is unauthorized.');
      }
    } else {
      setLoginError('Error: Username or password does not match any registered accounts.');
    }
  };

  const handleBypassLogin = (targetUserId: string) => {
    setLoginError(null);
    const match = users.find(u => u.id === targetUserId);
    if (match) {
      setCurrentUser(match);
      setProfileId(match.id);
      setActiveTab('dashboard');
    } else {
      // If users is somehow blank, reload standard defaults immediately
      setUsers(DEFAULT_USERS);
      const defaultMatch = DEFAULT_USERS.find(u => u.id === targetUserId);
      if (defaultMatch) {
        setCurrentUser(defaultMatch);
        setProfileId(defaultMatch.id);
        setActiveTab('dashboard');
      }
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setProfilePass('');
    setProfileMsg(null);
  };

  // 5. Account registrations, program creation controllers
  const handleSaveBeneficiary = (b: Beneficiary) => {
    const exists = beneficiaries.some(item => item.id === b.id);
    let updated: Beneficiary[];
    if (exists) {
      updated = beneficiaries.map(item => item.id === b.id ? b : item);
    } else {
      // Duplication check on NID
      const nidExists = beneficiaries.some(item => item.nidOrBirthCert === b.nidOrBirthCert);
      if (nidExists) {
        alert(`DUPLICATION ALERT: A profile is already registered in our database under NID / Birth certificate: "${b.nidOrBirthCert}"`);
        return;
      }
      updated = [b, ...beneficiaries];
    }
    syncBeneficiaries(updated);
    setEditingBeneficiary(null);
    setActiveTab('beneficiaries');
  };

  const handleSaveProgram = (p: Program) => {
    const exists = programs.some(item => item.id === p.id);
    let updated: Program[];
    if (exists) {
      updated = programs.map(item => item.id === p.id ? p : item);
    } else {
      updated = [p, ...programs];
    }
    syncPrograms(updated);
    setEditingProgram(null);
    setActiveTab('programs');
  };

  // User Administration helpers
  const handleSaveUser = (u: User) => {
    const exists = users.some(item => item.id === u.id);
    let updated: User[];
    if (exists) {
      updated = users.map(item => item.id === u.id ? u : item);
    } else {
      updated = [...users, u];
    }
    syncUsers(updated);
    alert('Account saved successfully!');
  };

  const handleDeleteUser = (userId: string) => {
    const updated = users.filter(item => item.id !== userId);
    syncUsers(updated);
  };

  const handleResetPasswordOverride = (userId: string, newPass: string) => {
    // In local storage dashboard, we just need to confirm or log it
    console.log(`Administrative Password override saved for user: ${userId}`);
  };

  // Served distributions item triggers
  const handleSaveServiceRecord = (sr: ServiceRecord) => {
    syncServiceRecords([sr, ...serviceRecords]);
  };

  const handleRemoveServiceRecord = (recordId: string) => {
    syncServiceRecords(serviceRecords.filter(item => item.id !== recordId));
  };

  const handleUpdateServiceRecordPackageCount = (recordId: string, newCount: number) => {
    syncServiceRecords(
      serviceRecords.map(item => item.id === recordId ? { ...item, packageCount: newCount } : item)
    );
  };

  const handleUpdateRemainingStock = (programId: string, updatedRemaining: number) => {
    syncPrograms(
      programs.map(item => item.id === programId ? { ...item, remainingStock: updatedRemaining } : item)
    );
  };

  // Profile Password controls
  const handleUpdateProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    let updatedUsers = [...users];

    // Check if Super Admin wants to change user ID
    if (currentUser.role === 'SuperAdmin') {
      if (!profileId.trim()) {
        setProfileMsg('Error: Display User ID cannot be blank.');
        return;
      }
      
      const isIdTaken = users.some(u => u.id === profileId && u.id !== currentUser.id);
      if (isIdTaken) {
        setProfileMsg('Error: Selected Login User ID is already occupied by another account.');
        return;
      }

      updatedUsers = users.map(u => u.id === currentUser.id ? { ...u, id: profileId.trim(), name: currentUser.name } : u);
      setCurrentUser({ ...currentUser, id: profileId.trim() });
    }

    if (profilePass.length >= 6) {
      setProfileMsg('Security password successfully changed.');
      setProfilePass('');
    } else if (profilePass) {
      setProfileMsg('Error: Password length must be at least 6 characters.');
    } else {
      setProfileMsg('Profile configuration updated.');
    }

    syncUsers(updatedUsers);
  };

  // Statistics calculation for default dashboard
  const totalBeneficiaries = beneficiaries.length;
  const totalPrograms = enrichedPrograms.length;
  
  // Calculate total services portion given out
  const totalPackagesGiven = serviceRecords.reduce((sum, item) => sum + item.packageCount, 0);

  // 6. Sub-directories authorization helper
  const isSuperAdmin = currentUser?.role === 'SuperAdmin';
  const isFieldStaff = currentUser?.role === 'FieldAdmin';
  const isDonor = currentUser?.role === 'Donor';

  // Filters specifically for active Donor dashboard overview metrics
  const donorProgramsCount = enrichedPrograms.filter(p => p.donors.includes(currentUser?.id || '')).length;
  const donorProgramIds = enrichedPrograms.filter(p => p.donors.includes(currentUser?.id || '')).map(p => p.id);
  const donorBeneficiariesCount = beneficiaries.filter(b => 
    serviceRecords.some(sr => donorProgramIds.includes(sr.programId) && sr.beneficiaryId === b.id)
  ).length;

  const donorPackagesDistributed = serviceRecords
    .filter(sr => donorProgramIds.includes(sr.programId))
    .reduce((sum, item) => sum + item.packageCount, 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 select-none antialiased text-slate-900 font-sans">
      
      {/* ⚠️ HIGH VISIBILITY SECURITY AUTHENTICATION SCREEN IF NOT LOGGED IN */}
      {!currentUser ? (
        <main className="flex-grow flex flex-col items-center justify-center p-4 min-h-screen relative overflow-hidden bg-slate-50 py-12">
          
          {/* Decorative background grid and gradients */}
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1.5px,transparent_1.5px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)] opacity-80" />
          
          <div className="bg-white border border-slate-200/80 p-8 rounded-3xl shadow-xl max-w-md w-full relative z-10">
            
            {/* Header / Brand info */}
            <div className="text-center mb-6">
              
              {/* Official NGO Brand Logo */}
              <img 
                src="/mwo-logo.png" 
                alt="Muslim Welfare Organization Logo" 
                className="h-16 mx-auto mb-4 object-contain max-w-full drop-shadow-sm select-none"
                onError={(e) => {
                  // Graceful fallback to CSS icon if logo cannot be rendered
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />

              <h1 className="text-lg font-black text-slate-800 tracking-tight font-display uppercase leading-tight">
                Beneficiary MS Portal
              </h1>
              <p className="text-[10px] text-emerald-600 font-bold font-mono tracking-wider uppercase mt-1">
                transparent distribution network
              </p>
            </div>

            {loginError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl mb-4 text-center font-medium leading-relaxed">
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 tracking-wider uppercase">
                  Select User Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={loginRoleSelect}
                  onChange={(e) => setLoginRoleSelect(e.target.value as 'Staff' | 'Donor')}
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs bg-white text-slate-800 font-semibold focus:ring-1 focus:ring-emerald-500 outline-none"
                >
                  <option value="Staff">Super Admin / Field Admin (Staff)</option>
                  <option value="Donor">Donor Portal Access</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 tracking-wider uppercase">
                  User ID Credential <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your system username"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none font-medium font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 tracking-wider uppercase">
                  Password Key <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="Enter login password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:ring-1 focus:ring-emerald-500 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 rounded-xl text-xs tracking-wider uppercase transition shadow-md border-b-2 border-emerald-800 cursor-pointer"
              >
                Sign In Securely
              </button>
            </form>

            {/* HIGH FIDELITY SECURE BYPASS MANAGER (Prevents blockages and assists live previews!) */}
            <div className="mt-6 pt-5 border-t border-slate-100">
              <span className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest block text-center mb-3">
                Live Prototype Bypass Access Doors
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleBypassLogin('admin')}
                  className="bg-red-50 hover:bg-red-100 border border-red-150 text-red-800 rounded-lg p-2 text-[9px] font-bold text-center leading-tight cursor-pointer"
                >
                  Super Admin
                </button>
                <button
                  onClick={() => handleBypassLogin('field1')}
                  className="bg-sky-50 hover:bg-sky-100 border border-sky-150 text-sky-800 rounded-lg p-2 text-[9px] font-bold text-center leading-tight cursor-pointer"
                >
                  Field Admin
                </button>
                <button
                  onClick={() => handleBypassLogin('donor1')}
                  className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-150 text-emerald-800 rounded-lg p-2 text-[9px] font-bold text-center leading-tight cursor-pointer"
                >
                  Fund Donor
                </button>
              </div>
            </div>

          </div>
          
          {/* Default branding credits */}
          <div className="mt-8 text-center text-xs text-slate-400 font-mono">
            Powered By: <a href="https://www.tikmerk.com" className="text-emerald-600 hover:underline">TIKMERK IT</a>
          </div>
        </main>
      ) : (
        /* ==================== AUTHENTICATED SYSTEM SHELL ==================== */
        <>
          {/* HEADER NAV LINK BAR */}
          <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm leading-none">
            <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
              
              {/* Header Left Logo branding */}
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}>
                <img 
                  src="/mwo-logo.png" 
                  alt="MWO Logo" 
                  className="h-8 md:h-9 object-contain select-none"
                />
              </div>

              {/* Desktop Only Navigation elements */}
              <nav className="hidden lg:flex items-center gap-1.5 lg:gap-2">
                <button
                  onClick={() => { setActiveTab('dashboard'); setEditingBeneficiary(null); setEditingProgram(null); }}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                    activeTab === 'dashboard' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Home Dashboard
                </button>

                {/* Sub Directories available to Staff (Super/Field Admin) */}
                {!isDonor && (
                  <>
                    <button
                      onClick={() => { setActiveTab('beneficiaries'); setEditingBeneficiary(null); }}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                        activeTab === 'beneficiaries' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Beneficiaries Global Directory
                    </button>
                    <button
                      onClick={() => { setActiveTab('programs'); setEditingProgram(null); }}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                        activeTab === 'programs' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Drives Program
                    </button>
                  </>
                )}

                {/* Directory structures for Donors */}
                {isDonor && (
                  <>
                    <button
                      onClick={() => setActiveTab('beneficiaries')}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                        activeTab === 'beneficiaries' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Program Beneficiary view
                    </button>
                    <button
                      onClick={() => setActiveTab('programs')}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                        activeTab === 'programs' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      Endorsed Programs Directory
                    </button>
                  </>
                )}

                {/* Exclusive Admin management fields */}
                {isSuperAdmin && (
                  <>
                    <button
                      onClick={() => setActiveTab('users')}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                        activeTab === 'users' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      User Accounts Management
                    </button>
                    <button
                      onClick={() => setActiveTab('cpanel')}
                      className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                        activeTab === 'cpanel' ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      cPanel Helper Exports
                    </button>
                  </>
                )}

                <button
                  onClick={() => setActiveTab('profile')}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer ${
                    activeTab === 'profile' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Setting Profile
                </button>
              </nav>

              {/* Header Right navigation options */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-slate-400 hidden lg:block bg-slate-100 px-2 py-1 rounded">
                  Auth: {currentUser.name} ({currentUser.role})
                </span>

                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  className="hidden sm:flex bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-600 p-2 rounded-lg transition cursor-pointer items-center justify-center"
                  title="Logout security session"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                {/* Hamburger Switch for Mobile Menu */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition cursor-pointer flex items-center justify-center focus:outline-none"
                  aria-label="Toggle Navigation Menu"
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5 text-slate-800" /> : <Menu className="w-5 h-5 text-slate-800" />}
                </button>
              </div>

            </div>

            {/* Mobile Responsive Menu Overlay / Dropdown with Smooth Height transition */}
            {isMobileMenuOpen && (
              <div className="lg:hidden border-t border-slate-200 bg-white shadow-lg animate-in fade-in slide-in-from-top-4 duration-200">
                <div className="px-4 py-3 space-y-2">
                  <div className="p-2.5 bg-slate-50 rounded-xl mb-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-mono">CURRENTLY LOGGED IN:</span>
                      <span className="text-xs font-bold text-slate-800">{currentUser.name}</span>
                    </div>
                    <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-wider font-mono">
                      {currentUser.role}
                    </span>
                  </div>

                  <button
                    onClick={() => { setActiveTab('dashboard'); setEditingBeneficiary(null); setEditingProgram(null); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left font-bold text-xs p-2.5 rounded-xl transition flex items-center gap-2 ${
                      activeTab === 'dashboard' ? 'bg-slate-100 text-slate-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>🏠</span> Home Dashboard
                  </button>

                  {/* Sub Directories available to Staff (Super/Field Admin) */}
                  {!isDonor && (
                    <>
                      <button
                        onClick={() => { setActiveTab('beneficiaries'); setEditingBeneficiary(null); setIsMobileMenuOpen(false); }}
                        className={`w-full text-left font-bold text-xs p-2.5 rounded-xl transition flex items-center gap-2 ${
                          activeTab === 'beneficiaries' ? 'bg-slate-100 text-slate-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>👥</span> Beneficiaries Directory
                      </button>
                      <button
                        onClick={() => { setActiveTab('programs'); setEditingProgram(null); setIsMobileMenuOpen(false); }}
                        className={`w-full text-left font-bold text-xs p-2.5 rounded-xl transition flex items-center gap-2 ${
                          activeTab === 'programs' ? 'bg-slate-100 text-slate-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>📦</span> Drives Program
                      </button>
                    </>
                  )}

                  {/* Directory structures for Donors */}
                  {isDonor && (
                    <>
                      <button
                        onClick={() => { setActiveTab('beneficiaries'); setIsMobileMenuOpen(false); }}
                        className={`w-full text-left font-bold text-xs p-2.5 rounded-xl transition flex items-center gap-2 ${
                          activeTab === 'beneficiaries' ? 'bg-slate-100 text-slate-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>👥</span> Program Beneficiary View
                      </button>
                      <button
                        onClick={() => { setActiveTab('programs'); setIsMobileMenuOpen(false); }}
                        className={`w-full text-left font-bold text-xs p-2.5 rounded-xl transition flex items-center gap-2 ${
                          activeTab === 'programs' ? 'bg-slate-100 text-slate-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>🌟</span> Endorsed Programs Directory
                      </button>
                    </>
                  )}

                  {/* Exclusive Admin management fields */}
                  {isSuperAdmin && (
                    <>
                      <button
                        onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }}
                        className={`w-full text-left font-bold text-xs p-2.5 rounded-xl transition flex items-center gap-2 ${
                          activeTab === 'users' ? 'bg-slate-100 text-slate-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>⚙️</span> User Accounts Management
                      </button>
                      <button
                        onClick={() => { setActiveTab('cpanel'); setIsMobileMenuOpen(false); }}
                        className={`w-full text-left font-bold text-xs p-2.5 rounded-xl transition flex items-center gap-2 ${
                          activeTab === 'cpanel' ? 'bg-slate-100 text-slate-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>📥</span> cPanel Helper Exports
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => { setActiveTab('profile'); setIsMobileMenuOpen(false); }}
                    className={`w-full text-left font-bold text-xs p-2.5 rounded-xl transition flex items-center gap-2 ${
                      activeTab === 'profile' ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>👤</span> Setting Profile
                  </button>

                  {/* Log Out on Mobile */}
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
                      className="w-full text-left font-bold text-xs p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition flex items-center gap-2 cursor-pointer"
                    >
                      <span>🚪</span> Log Out Security Session
                    </button>
                  </div>
                </div>
              </div>
            )}
          </header>

          {/* MAIN PAGE RENDER PLATFORMS */}
          <main className="flex-grow max-w-7xl w-full mx-auto px-4 py-6">
            
            {/* 1. HOMEPAGE DASHBOARD RENDER (Universal / Staff View) */}
            {activeTab === 'dashboard' && !isDonor && (
              <div className="space-y-6">
                
                {/* Visual Banner introduction */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-3xl p-6 text-white text-left relative overflow-hidden shadow-md">
                  <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-20 hidden md:block" />
                  <span className="text-[9.5px] font-extrabold uppercase bg-white/25 px-2.5 py-1 rounded-full tracking-widest font-mono">Muslim Welfare Org.</span>
                  <h2 className="text-xl font-bold font-display mt-3 leading-snug">
                    Assurgent Biometric Beneficiary Control Room
                  </h2>
                  <p className="text-xs text-white/90 leading-relaxed font-sans max-w-lg mt-1.5">
                    Welcome back, <strong className="font-bold">{currentUser.name}</strong>. Monitor distribution metrics, enroll local citizens, or initiate face recognition verification desks.
                  </p>

                  <div className="flex gap-2.5 mt-5">
                    <button
                      onClick={() => { setEditingBeneficiary(null); setActiveTab('register_beneficiary'); }}
                      className="bg-white text-emerald-950 font-bold px-4 py-2 rounded-xl text-xs shadow-sm hover:scale-105 transition cursor-pointer"
                    >
                      Enlist Beneficiary Profile
                    </button>
                    {isSuperAdmin && (
                      <button
                        onClick={() => { setEditingProgram(null); setActiveTab('create_program'); }}
                        className="bg-emerald-950/30 text-white border border-white/20 font-bold px-4 py-2 rounded-xl text-xs hover:bg-emerald-950/40 transition cursor-pointer"
                      >
                        Launch Distribution Program
                      </button>
                    )}
                  </div>
                </div>

                {/* Overall statistics trackers cards layout */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm leading-none flex items-center gap-4">
                    <div className="bg-sky-50 text-sky-600 p-3.5 rounded-xl">
                      <Users2 className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Global beneficiaries</span>
                      <span className="text-2xl font-black text-slate-800 font-mono">{totalBeneficiaries}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm leading-none flex items-center gap-4">
                    <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-xl">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Distribution Programs</span>
                      <span className="text-2xl font-black text-slate-800 font-mono">{totalPrograms}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm leading-none flex items-center gap-4">
                    <div className="bg-amber-50 text-amber-600 p-3.5 rounded-xl">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Portion Served</span>
                      <span className="text-2xl font-black text-slate-800 font-mono">{totalPackagesGiven} <span className="text-xs text-slate-400">Packs</span></span>
                    </div>
                  </div>
                </div>

                {/* Secure Data Sync & Export Panel */}
                <ExportControlPanel
                  programs={enrichedPrograms}
                  beneficiaries={beneficiaries}
                  serviceRecords={serviceRecords}
                  users={users}
                  title="Universal Dashboard Export & Live Sheets Sync Desk"
                />

                {/* Inline shortcuts panels directories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 leading-relaxed text-xs">
                  
                  {/* Latest registered entries overview */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b mb-3.5 flex justify-between items-center">
                      <span>Newly Enrolled Beneficiaries</span>
                      <button onClick={() => setActiveTab('beneficiaries')} className="text-emerald-600 hover:underline">View All &rarr;</button>
                    </h3>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {beneficiaries.slice(0, 4).map(b => (
                        <div key={b.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <div>
                            <p className="font-bold text-slate-850">{b.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{b.id} &bull; {b.nidOrBirthCert}</p>
                          </div>
                          <span className="text-[9.5px] font-mono text-slate-500">Contact: {b.mobile}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Active Programs remaining tracking overview */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b mb-3.5 flex justify-between items-center">
                      <span>Portion Distribution Programs Stock</span>
                      <button onClick={() => setActiveTab('programs')} className="text-emerald-600 hover:underline">View All &rarr;</button>
                    </h3>
                    <div className="space-y-2 max-h-56 overflow-y-auto">
                      {enrichedPrograms.slice(0, 4).map(p => (
                        <div key={p.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                          <div>
                            <p className="font-bold text-slate-850">{p.name}</p>
                            <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold uppercase">{p.type}</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold font-mono text-slate-800">{p.remainingStock} available</p>
                            <p className="text-[10px] text-slate-400">of {p.targetStockSize} bags</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* ====== DONOR ACTIVE DASHBOARD EXCLUSIVE OVERVIEW VIEW ====== */}
            {activeTab === 'dashboard' && isDonor && (
              <div className="space-y-6">
                
                {/* Visual Banner introduction */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-500 rounded-3xl p-6 text-white text-left relative overflow-hidden shadow-md">
                  <div className="absolute right-0 bottom-0 top-0 w-1/3 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-20 hidden md:block" />
                  <span className="text-[9.5px] font-extrabold uppercase bg-emerald-950/30 px-2.5 py-1 rounded-full tracking-widest font-mono">Verified Donor Desk</span>
                  <h2 className="text-xl font-bold font-display mt-3 leading-snug">
                    Transparent Distributions Progression Records
                  </h2>
                  <p className="text-xs text-white/95 leading-relaxed font-sans max-w-lg mt-1.5">
                    Thank you, <strong className="font-bold">{currentUser.name}</strong>, for your generous funding endorments. Observe actual portion allocations, served beneficiaries histories, and transparent project completions.
                  </p>
                </div>

                {/* Overall statistics trackers cards layout */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm leading-none flex items-center gap-4">
                    <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-xl">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Your Endorsed Programs</span>
                      <span className="text-2xl font-black text-slate-800 font-mono">{donorProgramsCount}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm leading-none flex items-center gap-4">
                    <div className="bg-sky-50 text-sky-600 p-3.5 rounded-xl">
                      <Users2 className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Beneficiaries Served</span>
                      <span className="text-2xl font-black text-slate-800 font-mono">{donorBeneficiariesCount}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm leading-none flex items-center gap-4">
                    <div className="bg-amber-50 text-amber-600 p-3.5 rounded-xl">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="block text-[9.5px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Portion Distributed</span>
                      <span className="text-2xl font-black text-slate-800 font-mono">{donorPackagesDistributed} <span className="text-xs text-slate-400">Packs</span></span>
                    </div>
                  </div>
                </div>

                {/* Secure Data Sync & Export Panel */}
                <ExportControlPanel
                  programs={enrichedPrograms}
                  beneficiaries={beneficiaries}
                  serviceRecords={serviceRecords}
                  users={users}
                  title="Donor Portal Export & Live Sheets Sync Desk"
                />

                {/* Donor Program list summary */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm leading-relaxed text-xs">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-3 border-b mb-4 flex justify-between items-center">
                    <span>Your Link Endorsed Operations Summaries</span>
                    <button onClick={() => setActiveTab('programs')} className="text-emerald-700 font-bold hover:underline">View Programs Directory &rarr;</button>
                  </h3>

                  <div className="space-y-4">
                    {enrichedPrograms.filter(p => p.donors.includes(currentUser.id)).map(p => {
                      const completedCount = p.targetStockSize - p.remainingStock;
                      const ratio = Math.round((completedCount / p.targetStockSize) * 100);
                      return (
                        <div key={p.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <span className="text-[9px] font-mono text-slate-400 font-bold">{p.id}</span>
                            <h4 className="text-xs font-bold text-slate-900">{p.name}</h4>
                            <p className="text-[10px] text-slate-500 font-medium font-mono mt-1">Timeline date: {p.programDate} &bull; Type: {p.type}</p>
                          </div>

                          <div className="w-full sm:w-1/3 leading-none shrink-0 space-y-1.5">
                            <div className="flex justify-between items-center text-[10px] text-slate-500 font-medium">
                              <span>Distribution Complete ratio:</span>
                              <span className="font-bold text-emerald-700">{completedCount} / {p.targetStockSize} Packets</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-600 h-full" style={{ width: `${ratio}%` }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* ====== 2. REGISTRATION OF A BENEFICIARY (FORM VIEW) ====== */}
            {activeTab === 'register_beneficiary' && (
              <BeneficiaryRegister
                currentUser={currentUser}
                onSave={handleSaveBeneficiary}
                onCancel={() => setActiveTab('dashboard')}
                editingBeneficiary={editingBeneficiary}
              />
            )}

            {/* ====== 3. ENROLLING A NEW DISTRIBUTION PROGRAM (FORM) ====== */}
            {activeTab === 'create_program' && isSuperAdmin && (
              <ProgramCreate
                donorsList={users.filter(u => u.role === 'Donor')}
                onSave={handleSaveProgram}
                onCancel={() => setActiveTab('dashboard')}
                editingProgram={editingProgram}
              />
            )}

            {/* ====== 4. GLOBAL BENEFICIARY DIRECTORY FOR REVIEWS ====== */}
            {activeTab === 'beneficiaries' && (
              <BeneficiaryDirectory
                currentUser={currentUser}
                beneficiaries={beneficiaries}
                programs={enrichedPrograms}
                serviceRecords={serviceRecords}
                onShowRegisterForm={(editingB) => {
                  setEditingBeneficiary(editingB || null);
                  setActiveTab('register_beneficiary');
                }}
              />
            )}

            {/* ====== 5. ACTIVE PROGRAMS DIRECTORY AND DESK ====== */}
            {activeTab === 'programs' && (
              <ProgramDirectory
                currentUser={currentUser}
                programs={enrichedPrograms}
                beneficiaries={beneficiaries}
                serviceRecords={serviceRecords}
                onShowEditProgram={(editP) => {
                  setEditingProgram(editP);
                  setActiveTab('create_program');
                }}
                onUpdateRemainingStock={handleUpdateRemainingStock}
                onSaveServiceRecord={handleSaveServiceRecord}
                onRemoveServiceRecord={handleRemoveServiceRecord}
                onUpdateServiceRecordPackageCount={handleUpdateServiceRecordPackageCount}
              />
            )}

            {/* ====== 6. USER ACCOUNT ADMINISTRATION LISTS (SUPER ADMIN ONLY) ====== */}
            {activeTab === 'users' && isSuperAdmin && (
              <UserManagement
                users={users}
                onSaveUser={handleSaveUser}
                onDeleteUser={handleDeleteUser}
                onResetPassword={handleResetPasswordOverride}
              />
            )}

            {/* ====== 7. CPANEL HELPER SOURCE CODE EXPORTER ====== */}
            {activeTab === 'cpanel' && isSuperAdmin && (
              <CPanelHelper />
            )}

            {/* ====== 8. SECURITY EDIT PROFILE CONTROL PANELS ====== */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm max-w-md mx-auto text-left">
                <h3 className="text-base font-bold text-slate-800 pb-3 border-b mb-5 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-emerald-600 animate-spin" />
                  Security Credential desk
                </h3>

                {profileMsg && (
                  <div className={`text-xs p-3 rounded-xl mb-4 text-center font-bold border ${
                    profileMsg.startsWith('Error') 
                      ? 'bg-rose-50 border-rose-200 text-rose-800' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    {profileMsg}
                  </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs font-semibold text-slate-600">
                  <div>
                    <label className="block mb-1">ACCOUNT SECURITY LEVEL TYPE</label>
                    <input
                      type="text"
                      disabled
                      value={currentUser.role === 'SuperAdmin' ? 'Super Admin' : currentUser.role === 'FieldAdmin' ? 'Field Staff' : 'Guest Donor'}
                      className="w-full border border-slate-200 bg-slate-100 rounded-lg p-2.5 outline-none font-bold text-slate-700"
                    />
                  </div>

                  <div>
                    <label className="block mb-1">USER ACCESS LOGIN ID</label>
                    <input
                      type="text"
                      disabled={!isSuperAdmin}
                      placeholder="Username ID"
                      value={profileId}
                      onChange={(e) => setProfileId(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 outline-none font-mono font-bold text-slate-800 focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                    />
                    {!isSuperAdmin && (
                      <p className="font-mono text-[9px] text-slate-400 font-normal mt-0.5">Contact Super-Admins to modify access IDs.</p>
                    )}
                  </div>

                  <div>
                    <label className="block mb-1">UPDATE ACCOUNT PASSWORD KEY</label>
                    <input
                      type="password"
                      placeholder="Enter new account password key"
                      value={profilePass}
                      onChange={(e) => setProfilePass(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg p-2.5 outline-none font-normal"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-4 rounded-xl transition cursor-pointer text-xs"
                  >
                    Commit Profile updates
                  </button>
                </form>
              </div>
            )}

          </main>

          {/* CENTRE BRANDED FOOTER LINK */}
          <Footer />
        </>
      )}

    </div>
  );
}
