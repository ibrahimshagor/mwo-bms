import { useState } from 'react';
import { Program, Beneficiary, ServiceRecord, User } from '../types';
import { exportAllToExcel } from '../utils/exportUtils';
import { 
  Download, CheckCircle, FileDown, 
  AlertCircle, FileSpreadsheet, ShieldCheck, Database
} from 'lucide-react';

interface ExportControlPanelProps {
  programs: Program[];
  beneficiaries: Beneficiary[];
  serviceRecords: ServiceRecord[];
  users: User[];
  title?: string;
  variant?: 'card' | 'bar' | 'compact';
}

export default function ExportControlPanel({
  programs,
  beneficiaries,
  serviceRecords,
  users,
  title = "Universal Dashboard Offline Data Export Desk",
  variant = 'card'
}: ExportControlPanelProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Total calculations
  const totalPackagesServed = serviceRecords.reduce((sum, sr) => sum + sr.packageCount, 0);
  const totalRawItems = programs.reduce((sum, p) => sum + (p.inventoryItems?.length || 0), 0);
  const totalPackagesConfigured = programs.reduce((sum, p) => sum + (p.inventoryPackages?.length || 0), 0);

  // Handle local excel file export (instant & offline)
  const handleLocalExport = () => {
    setIsExporting(true);
    setMessage(null);
    try {
      exportAllToExcel(programs, beneficiaries, serviceRecords, users);
      setMessage({
        type: 'success',
        text: 'কমপ্লিট অফলাইন এক্সেল (.xlsx) ফাইলটি সফলভাবে ডাউনলোড হয়েছে! এতে ড্যাশবোর্ড, প্রোগ্রাম, বেনিফিশিয়ারি, বিতরণ রেকর্ড, ইউজার এবং ইনভেন্টরি স্টক রয়েছে।'
      });
      setTimeout(() => setMessage(null), 6000);
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: 'error',
        text: `Failed to generate Excel file: ${err.message || err}`
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleLocalExport}
          disabled={isExporting}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm transition hover:shadow"
        >
          <FileDown className="w-4 h-4 text-emerald-100" />
          <span>অফলাইন এক্সেল ব্যাকআপ (.xlsx)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <FileSpreadsheet className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-800 font-display uppercase tracking-wide">
              {title}
            </h3>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              100% Offline & Secure
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            কোনো বাহ্যিক ক্লাউড বা ড্রাইভ অ্যাকাউন্ট সংযোগ ছাড়াই সমস্ত প্রোগ্রাম, সুবিধাভোগী, বিতরণ রেকর্ড ও ইনভেন্টরি স্টকের সম্পূর্ণ ব্যাকআপ সরাসরি এক্সেল (.xlsx) শিট আকারে আপনার ডিভাইসে সংরক্ষণ করুন।
          </p>
        </div>
        
        {/* Instant Static Offline Download */}
        <button
          onClick={handleLocalExport}
          disabled={isExporting}
          className="shrink-0 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-xs py-2.5 px-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm transition transform hover:-translate-y-0.5"
        >
          <Download className="w-4 h-4 text-emerald-100" />
          <span>ডাউনলোড অফলাইন এক্সেল (.xlsx)</span>
        </button>
      </div>

      {/* Snapshot Statistics Included in Backup */}
      <div className="mt-4 pt-3.5 border-t border-slate-200/70 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">রিলিফ প্রোগ্রাম</span>
          <span className="text-base font-black text-slate-800 font-mono">{programs.length} <span className="text-[11px] text-slate-400 font-normal">টি</span></span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">নিবন্ধিত সুবিধাভোগী</span>
          <span className="text-base font-black text-slate-800 font-mono">{beneficiaries.length} <span className="text-[11px] text-slate-400 font-normal">জন</span></span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">মোট বিতরণকৃত প্যাক</span>
          <span className="text-base font-black text-emerald-700 font-mono">{totalPackagesServed} <span className="text-[11px] text-slate-400 font-normal">প্যাক</span></span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">ইনভেন্টরি আইটেম</span>
          <span className="text-base font-black text-amber-700 font-mono">{totalRawItems} <span className="text-[11px] text-slate-400 font-normal">প্রোডাক্ট</span></span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
          <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">প্যাকেজ কনফিগারেশন</span>
          <span className="text-base font-black text-indigo-700 font-mono">{totalPackagesConfigured} <span className="text-[11px] text-slate-400 font-normal">বান্ডেল</span></span>
        </div>
      </div>

      {/* Response Message */}
      {message && (
        <div className={`mt-3.5 p-3 rounded-xl text-xs flex items-start gap-2.5 ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
            : 'bg-red-50 text-red-900 border border-red-200'
        }`}>
          {message.type === 'success' 
            ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> 
            : <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          }
          <span className="font-semibold leading-relaxed">{message.text}</span>
        </div>
      )}
    </div>
  );
}
