import { useState, useEffect } from 'react';
import { Program, Beneficiary, ServiceRecord, User } from '../types';
import { exportAllToExcel, syncDataToGoogleSheets } from '../utils/exportUtils';
import { googleSignIn, initAuth, logoutGoogle, getAccessToken, setAccessToken } from '../utils/googleAuth';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  Download, Cloud, Loader, CheckCircle, FileDown, 
  ExternalLink, LogOut, Check, AlertCircle, FileSpreadsheet, Sparkles 
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
  title = "Export & Google Sheets Sync Control Desk",
  variant = 'card'
}: ExportControlPanelProps) {
  // Local states
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Spreadsheet sync feedback
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string | null>(() => {
    return localStorage.getItem('mwo_connected_sheets_url');
  });
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(() => {
    return localStorage.getItem('mwo_last_synced_time');
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Initialize auth state listener on mount
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAuthToken(token);
      },
      () => {
        setGoogleUser(null);
        setAuthToken(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Handle local excel file export (instant & offline)
  const handleLocalExport = () => {
    try {
      exportAllToExcel(programs, beneficiaries, serviceRecords, users);
      showTemporaryMsg('success', 'Excel (.xlsx) file has been generated and downloaded successfully!');
    } catch (err: any) {
      console.error(err);
      showTemporaryMsg('error', `Failed to generate Excel file: ${err.message || err}`);
    }
  };

  // Google Sign-In trigger
  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    setMessage(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAuthToken(result.accessToken);
        showTemporaryMsg('success', `Success! Connected as ${result.user.displayName || result.user.email}`);
      }
    } catch (err: any) {
      console.error("Google Auth connection aborted or failed:", err);
      showTemporaryMsg('error', err.message || 'Google Authentication cancelled or failed.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Logout Google auth
  const handleGoogleDisconnect = async () => {
    const ok = window.confirm("Disconnect your Google account from this session? Your current sheets connection info will be cleared.");
    if (!ok) return;
    
    try {
      await logoutGoogle();
      setGoogleUser(null);
      setAuthToken(null);
      setSpreadsheetUrl(null);
      setLastSyncedTime(null);
      localStorage.removeItem('mwo_connected_sheets_url');
      localStorage.removeItem('mwo_last_synced_time');
      showTemporaryMsg('success', 'Google Session disconnected safely.');
    } catch (err: any) {
      showTemporaryMsg('error', err.message || 'Failed to sign out properly.');
    }
  };

  // Sync Master to Google Sheets
  const handleSyncToSheets = async () => {
    const tokenToUse = authToken || getAccessToken();
    if (!tokenToUse) {
      showTemporaryMsg('error', 'Authentication credentials expired. Please disconnect and sign in again.');
      return;
    }

    setIsSyncing(true);
    setMessage(null);

    try {
      const result = await syncDataToGoogleSheets(
        tokenToUse,
        programs,
        beneficiaries,
        serviceRecords,
        users
      );

      // Save spreadsheet credentials locally
      setSpreadsheetUrl(result.spreadsheetUrl);
      const currentTimeString = new Date().toLocaleString();
      setLastSyncedTime(currentTimeString);
      
      localStorage.setItem('mwo_connected_sheets_url', result.spreadsheetUrl);
      localStorage.setItem('mwo_last_synced_time', currentTimeString);

      showTemporaryMsg('success', 'A dynamic multi-tab spreadsheet is now fully compiled and synchronized in your Google Drive!');
    } catch (err: any) {
      console.error("Spreadsheet compilation error:", err);
      showTemporaryMsg('error', `Sheets synchronization failed: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const showTemporaryMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
  };

  if (variant === 'compact') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleLocalExport}
          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-xs"
        >
          <FileDown className="w-3.5 h-3.5" />
          Export to Excel (.xlsx)
        </button>

        {!googleUser ? (
          <button
            onClick={handleGoogleConnect}
            disabled={isConnecting}
            className="bg-slate-50 hover:bg-slate-100 text-slate-705 border border-slate-205 font-bold text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition disabled:opacity-50"
          >
            {isConnecting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Cloud className="w-3.5 h-3.5 text-blue-500" />}
            Sync Google Sheets
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSyncToSheets}
              disabled={isSyncing}
              className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1 cursor-pointer transition disabled:bg-slate-350"
            >
              {isSyncing ? (
                <Loader className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              Push Live Sync
            </button>
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="no-referrer noreferrer"
                className="bg-slate-800 hover:bg-slate-900 text-slate-100 p-1.5 rounded-lg text-xs"
                title="Open spreadsheet in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5 text-emerald-450" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 shadow-inner">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4 mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-850 flex items-center gap-2 font-display uppercase tracking-wide">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            {title}
          </h3>
          <p className="text-xs text-slate-500">
            Export secure backup records offline or configure real-time cloud synchronization logs with Google Sheets.
          </p>
        </div>
        
        {/* Instant Static Offline Download */}
        <button
          onClick={handleLocalExport}
          className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1 px-5 cursor-pointer shadow-sm transition transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <Download className="w-4 h-4 text-emerald-100" />
          Download Offline Excel (.xlsx)
        </button>
      </div>

      {/* Google Sheets Sync Module Section */}
      <div className="bg-white border border-slate-150 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div className="flex items-start gap-2.5">
            <div className={`p-2 rounded-lg ${googleUser ? 'bg-sky-50 text-sky-650' : 'bg-slate-100 text-slate-500'}`}>
              <Cloud className={`w-5 h-5 ${googleUser ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Google Sheets Remote Cloud Sync 
                {googleUser && <span className="bg-emerald-550 text-white text-[8px] font-black uppercase px-1.5 py-0.3 rounded border border-emerald-600 tracking-wider">Connected</span>}
              </h4>
              <p className="text-[11px] text-slate-500 max-w-lg mt-0.5 leading-relaxed">
                Unlock collaborative power! Connect your Google account to automatically spin up a dynamic file containing synced tabs for Dashboard figures, Programs, Beneficiaries, Service Records, and Users.
              </p>
            </div>
          </div>

          {/* Sync Connection Actions */}
          <div className="flex items-center gap-2">
            {!googleUser ? (
              <button
                onClick={handleGoogleConnect}
                disabled={isConnecting}
                className="gsi-material-button text-xs font-bold border border-slate-200 hover:bg-slate-50 active:bg-slate-100 transition duration-150 rounded-xl px-4 py-2 flex items-center gap-4 cursor-pointer focus:outline-none"
              >
                <div className="flex items-center justify-center">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '18px', height: '18px' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span className="text-slate-700 font-bold text-xs">{isConnecting ? 'Establishing connection...' : 'Connect Google Drive'}</span>
              </button>
            ) : (
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-medium font-mono">
                    Session User: <strong className="text-slate-800">{googleUser.displayName || googleUser.email}</strong>
                  </span>
                  <button
                    onClick={handleGoogleDisconnect}
                    className="text-red-550 hover:text-red-700 transition p-1 hover:bg-red-50 rounded"
                    title="Sign Out Google Session"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sync Controls Section */}
        {googleUser && (
          <div className="border-t border-slate-100 pt-3 mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSyncToSheets}
                disabled={isSyncing}
                className="bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-300 shadow-sm transition"
              >
                {isSyncing ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin text-white" />
                    Synchronizing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-200 animate-bounce" />
                    Sync Directory Database
                  </>
                )}
              </button>

              {spreadsheetUrl && (
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="no-referrer noreferrer"
                  className="bg-emerald-50 text-emerald-850 hover:bg-emerald-100 font-black text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1 border border-emerald-200 shadow-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                  Open Google Sheet ↗
                </a>
              )}
            </div>

            {/* Sync Status Indicators */}
            {lastSyncedTime && (
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block tracking-wider uppercase font-bold">Last Successful Sync</span>
                <span className="text-[11px] text-emerald-600 font-black font-mono flex items-center gap-1 justify-end">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  {lastSyncedTime}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Display response messages */}
        {message && (
          <div className={`mt-3 p-2.5 rounded-lg text-xs flex items-start gap-2 ${
            message.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-150' 
              : 'bg-red-50 text-red-800 border border-red-150'
          }`}>
            {message.type === 'success' 
              ? <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" /> 
              : <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
            }
            <span className="font-semibold leading-relaxed">{message.text}</span>
          </div>
        )}
      </div>
    </div>
  );
}
