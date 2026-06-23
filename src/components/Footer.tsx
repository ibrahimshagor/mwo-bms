import React from 'react';

export default function Footer() {
  return (
    <footer id="app-footer" className="bg-white border-t border-slate-200 py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 text-center">
        {/* App Name */}
        <h2 className="text-base font-bold text-slate-800 tracking-wide">
          MWO Beneficiary MS
        </h2>
        
        {/* App Slogan (Below App Name) */}
        <p className="text-xs text-slate-500 font-medium mt-1">
          &quot;Providing Transparent & Reliable Tracking For Distribution&quot;
        </p>
        
        {/* Powered By & Developed By (Below Slogan) */}
        <div className="text-xs text-slate-400 mt-2 font-mono">
          Powered By:{' '}
          <a
            href="https://www.tikmerk.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline"
          >
            TIKMERK IT
          </a>{' '}
          | Developed By :{' '}
          <span className="text-slate-600 font-medium">
            Md. Ibrahim Hossain
          </span>
        </div>
      </div>
    </footer>
  );
}
