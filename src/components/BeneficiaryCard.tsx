import { useRef, useEffect, useState } from 'react';
import { Download, Check } from 'lucide-react';
import { Beneficiary } from '../types';
import { getBasePath } from '../App';

interface BeneficiaryCardProps {
  beneficiary: Beneficiary;
  onClose?: () => void;
}

export default function BeneficiaryCard({ beneficiary, onClose }: BeneficiaryCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Auto-generate card photo if empty (using standard high contrast styled SVG initial photo)
  const defaultPhoto = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#E2E8F0"><circle cx="50" cy="35" r="22" fill="#94A3B8"/><path d="M15 85c0-18 15-28 35-28s35 10 35 28z" fill="#94A3B8"/></svg>`;
  const displayPhoto = beneficiary.photo || `data:image/svg+xml;utf8,${encodeURIComponent(defaultPhoto)}`;
  
  const defaultSignature = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><path d="M10 20 Q 30 5, 50 20 T 90 20" stroke="#047857" stroke-width="2" fill="none"/></svg>`;
  const displaySignature = beneficiary.signature || `data:image/svg+xml;utf8,${encodeURIComponent(defaultSignature)}`;

  // Compile download in EXACTLY 255x380 px
  const downloadCardAsPng = () => {
    setDownloading(true);
    const canvas = canvasRef.current;
    if (!canvas) {
      setDownloading(false);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setDownloading(false);
      return;
    }

    // Set precise canvas size to 255x380 px
    canvas.width = 255;
    canvas.height = 380;

    // 1. Draw pure white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Draw card border
    ctx.strokeStyle = '#059669'; // Emerald border
    ctx.lineWidth = 2.5;
    ctx.strokeRect(1.2, 1.2, canvas.width - 2.4, canvas.height - 2.4);

    // Add faint pattern / inner subtle border
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // Draw final details helper defined inside downloadCardAsPng
    const drawTextDetailsAndFinish = () => {
      // Name on the Right Side
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 9px Inter, sans-serif';
      // Word wrap name if too long
      const name = beneficiary.name.toUpperCase();
      if (name.length > 25) {
        ctx.fillText(name.substring(0, 23) + '...', 72, 72);
      } else {
        ctx.fillText(name, 72, 72);
      }

      // Member type label below the name
      ctx.fillStyle = '#D97706'; // Amber badge
      ctx.fillRect(72, 78, 50, 11);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 6.5px Inter, sans-serif';
      ctx.fillText(`${beneficiary.type.toUpperCase()} TYPE`, 75, 86);

      // 5. Description Area Box (Rectangle)
      // Boundary Box coordinates (x: 12, y: 126, w: 231, h: 176)
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(12, 126, 231, 176);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(12, 126, 231, 176);

      // Box Section Title label
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 7.2px Inter, sans-serif';
      ctx.fillText('BENEFICIARY SYSTEM PROFILE RECORDS', 16, 140);

      // Underline section label
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(16, 144);
      ctx.lineTo(145, 144);
      ctx.stroke();

      // Profile Fields Map (Y starts at 159, increments by 19)
      const fields = [
        { label: 'Unique ID:', value: beneficiary.id },
        { label: 'NID / Birth no:', value: beneficiary.nidOrBirthCert },
        { label: 'Nationality:', value: beneficiary.nationality },
        { label: 'Mobile Contact:', value: beneficiary.mobile },
        { label: 'Date of Birth:', value: beneficiary.dob },
        { label: 'Gender:', value: beneficiary.gender },
        { label: 'Registered Address:', value: beneficiary.address },
      ];

      let currentY = 159;
      fields.forEach((field) => {
        // Label on left
        ctx.fillStyle = '#475569';
        ctx.font = 'bold 6.8px Inter, sans-serif';
        ctx.fillText(field.label, 16, currentY);

        // Value on right
        ctx.fillStyle = '#1E293B';
        ctx.font = '500 6.8px Inter, sans-serif';
        
        // Truncate address value if too long to prevent spill-over
        let displayVal = field.value;
        if (field.label === 'Registered Address:' && displayVal.length > 30) {
          displayVal = displayVal.substring(0, 28) + '...';
        }
        ctx.fillText(displayVal, 96, currentY);

        currentY += 19.5;
      });

      // 6. Footer section (y: 310 to bottom)
      const todayString = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      // Date of issue left side
      ctx.fillStyle = '#64748B';
      ctx.font = '500 6.2px Inter, sans-serif';
      ctx.fillText('Issued Date/Time:', 12, 332);
      ctx.fillStyle = '#1E293B';
      ctx.font = 'bold 6.8px Inter, sans-serif';
      ctx.fillText(todayString, 12, 342);

      // Signature line right side
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(175, 335);
      ctx.lineTo(243, 335);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '500 6.2px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Beneficiary Signature', 209, 343);

      // Final: trigger file download via anchor client action!
      try {
        const link = document.createElement('a');
        link.download = `MWO_Card_${beneficiary.id}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setDownloadSuccess(true);
        setTimeout(() => setDownloadSuccess(false), 2000);
      } catch (err) {
        console.error('Error during canvas download export', err);
      } finally {
        setDownloading(false);
      }
    };

    // Load MWO Brand Logo
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';

    logoImg.onload = () => {
      // Draw centered logo banner at top
      // Banner size: 140 width, 33.6 height (at center)
      const logoW = 140;
      const logoH = 33.6;
      const logoX = (canvas.width - logoW) / 2;
      ctx.drawImage(logoImg, logoX, 10, logoW, logoH);

      // Header label: "Beneficiary Digital Identity Card"
      ctx.fillStyle = '#047857'; // emerald-700
      ctx.font = 'bold 7px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BENEFICIARY DIGITAL IDENTITY CARD', 127.5, 48);

      // Thin horizontal line under header
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(10, 53);
      ctx.lineTo(245, 53);
      ctx.stroke();

      // Reset align
      ctx.textAlign = 'left';

      // Load Profile Photo
      const portraitImg = new Image();
      portraitImg.crossOrigin = 'anonymous';

      portraitImg.onload = () => {
        // Draw photo container on left side
        ctx.fillStyle = '#F8FAFC';
        ctx.fillRect(12, 58, 50, 60);
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 0.8;
        ctx.strokeRect(12, 58, 50, 60);
        ctx.drawImage(portraitImg, 12.5, 58.5, 49, 59);

        // Load Signature
        const sigImg = new Image();
        sigImg.crossOrigin = 'anonymous';

        sigImg.onload = () => {
          // Draw signature inside footer right side
          ctx.drawImage(sigImg, 175, 312, 68, 20);
          drawTextDetailsAndFinish();
        };

        sigImg.onerror = () => {
          drawTextDetailsAndFinish();
        };

        sigImg.src = displaySignature;
      };

      portraitImg.onerror = () => {
        // Fallback if profile photo fails to load
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(12.5, 58.5, 49, 59);
        
        const sigImg = new Image();
        sigImg.crossOrigin = 'anonymous';

        sigImg.onload = () => {
          ctx.drawImage(sigImg, 175, 312, 68, 20);
          drawTextDetailsAndFinish();
        };
        sigImg.onerror = () => {
          drawTextDetailsAndFinish();
        };

        sigImg.src = displaySignature;
      };

      portraitImg.src = displayPhoto;
    };

    logoImg.onerror = () => {
      // Fallback if logo fails (e.g. draw backup text)
      ctx.fillStyle = '#047857';
      ctx.font = 'bold 12px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('Muslim Welfare Org.', 127.5, 26);

      ctx.fillStyle = '#047857';
      ctx.font = 'bold 7px Inter, sans-serif';
      ctx.fillText('BENEFICIARY DIGITAL IDENTITY CARD', 127.5, 48);

      // Draw horizontal line
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(10, 53);
      ctx.lineTo(245, 53);
      ctx.stroke();

      ctx.textAlign = 'left';

      // Load photo
      const portraitImg = new Image();
      portraitImg.crossOrigin = 'anonymous';

      portraitImg.onload = () => {
         ctx.fillStyle = '#F8FAFC';
         ctx.fillRect(12, 58, 50, 60);
         ctx.strokeStyle = '#94A3B8';
         ctx.lineWidth = 0.8;
         ctx.strokeRect(12, 58, 50, 60);
         ctx.drawImage(portraitImg, 12.5, 58.5, 49, 59);

         const sigImg = new Image();
         sigImg.crossOrigin = 'anonymous';

         sigImg.onload = () => {
           ctx.drawImage(sigImg, 175, 312, 68, 20);
           drawTextDetailsAndFinish();
         };
         sigImg.onerror = () => {
           drawTextDetailsAndFinish();
         };

         sigImg.src = displaySignature;
      };
      
      portraitImg.onerror = () => {
        const sigImg = new Image();
        sigImg.crossOrigin = 'anonymous';
        sigImg.onload = () => {
          ctx.drawImage(sigImg, 175, 312, 68, 20);
          drawTextDetailsAndFinish();
        };
        sigImg.onerror = () => {
          drawTextDetailsAndFinish();
        };

        sigImg.src = displaySignature;
      };

      portraitImg.src = displayPhoto;
    };

    logoImg.src = getBasePath() + '/mwo-logo.svg';
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-sm fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-slate-50/90 rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 relative flex flex-col items-center">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 font-bold border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center hover:bg-slate-100 transition cursor-pointer"
          >
            &times;
          </button>
        )}

        <div className="text-center mb-4">
          <h3 className="text-base font-bold text-slate-800">Identity Desk Panel</h3>
          <p className="text-xs text-slate-500">
            Previewing digital member certificate. Click below to download in high-resolution original layout dimensions (255px × 380px).
          </p>
        </div>

        {/* Visual Card HTML Representation - strictly and physically locked to 255x380px */}
        <div 
          id="digital-card-preview"
          className="w-[255px] h-[380px] min-w-[255px] max-w-[255px] min-h-[380px] max-h-[380px] border-[3px] border-emerald-600 rounded-xl bg-white relative shadow-2xl p-2.5 flex flex-col justify-between select-none font-sans overflow-hidden after:absolute after:inset-0 after:rounded-lg after:pointer-events-none after:bg-gradient-to-tr after:from-transparent after:via-white/10 after:to-white/5 transition-transform"
        >
          {/* Subtle inside gold/emerald border frame */}
          <div className="absolute inset-[3px] border border-amber-500/20 pointer-events-none rounded-lg"></div>

          {/* Card Top Branding Header */}
          <div className="flex justify-center items-center h-9 z-10 mt-1">
            <img 
              src={getBasePath() + '/mwo-logo.svg'} 
              alt="Muslim Welfare Organization logo" 
              className="max-h-full max-w-[160px] object-contain select-none"
              onError={(e) => {
                // Graceful text branding fallback
                const fallbackContainer = document.getElementById('logo-text-fallback');
                if (fallbackContainer) fallbackContainer.style.display = 'block';
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div id="logo-text-fallback" className="hidden text-center">
              <h4 className="text-[8.5px] font-black uppercase text-emerald-850 tracking-tight leading-none">
                Muslim Welfare Org.
              </h4>
            </div>
          </div>

          <div>
            <p className="text-[7.2px] font-extrabold text-amber-600 text-center tracking-wider mt-1.5 z-10 leading-none">
              BENEFICIARY DIGITAL IDENTITY CARD
            </p>
            <div className="h-[0.5px] bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-600 w-full my-1 z-10" />
          </div>

          {/* Card Content Row */}
          <div className="flex justify-between mt-0.5 items-start gap-2 z-10 text-left">
            {/* Photo on left side */}
            <div className="w-[50px] h-[60px] border border-slate-300 bg-slate-100 rounded overflow-hidden shrink-0 shadow-sm flex items-center justify-center relative">
              <img
                src={displayPhoto}
                referrerPolicy="no-referrer"
                alt="Beneficiary Face"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 inset-x-0 h-1.5 bg-emerald-600/80"></div>
            </div>

            {/* Profile tags on right list */}
            <div className="flex flex-col flex-1 text-left leading-none gap-1 mt-0.5">
              <h5 className="text-[9.2px] font-black text-slate-900 uppercase break-words leading-tight tracking-tight">
                {beneficiary.name}
              </h5>
              
              {/* Semantic Dynamic Type Badge */}
              <span className={`font-bold text-[5.8px] px-2 py-0.5 rounded-full uppercase mt-1 self-start select-none border ${
                beneficiary.type === 'Widow'
                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                  : beneficiary.type === 'Orphan'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : beneficiary.type === 'Disable'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {beneficiary.type} Group
              </span>
            </div>
          </div>

          {/* Description Rectangle inside card */}
          <div className="mt-1.5 border border-slate-200 bg-slate-50/85 rounded-lg p-1.5 flex flex-col gap-0.5 text-left z-10 leading-none">
            <span className="text-[6.2px] font-black text-emerald-800 uppercase tracking-wider block border-b border-amber-500 pb-1 mb-1">
              BENEFICIARY SYSTEM PROFILE RECORDS
            </span>
            
            <div className="grid grid-cols-12 gap-0 py-0.5">
              <span className="col-span-4 text-[6.2px] font-bold text-slate-400">Unique ID:</span>
              <span className="col-span-8 text-[6.2px] font-bold text-slate-800 select-all font-mono tracking-tight">{beneficiary.id}</span>
            </div>
            
            <div className="grid grid-cols-12 gap-0 py-0.5">
              <span className="col-span-4 text-[6.2px] font-bold text-slate-400">NID / Birth:</span>
              <span className="col-span-8 text-[6.2px] font-bold text-slate-800 font-mono">{beneficiary.nidOrBirthCert}</span>
            </div>
            
            <div className="grid grid-cols-12 gap-0 py-0.5">
              <span className="col-span-4 text-[6.2px] font-bold text-slate-400">Nationality:</span>
              <span className="col-span-8 text-[6.2px] font-semibold text-slate-700">{beneficiary.nationality}</span>
            </div>
            
            <div className="grid grid-cols-12 gap-0 py-0.5">
              <span className="col-span-4 text-[6.2px] font-bold text-slate-400">Mobile:</span>
              <span className="col-span-8 text-[6.2px] font-bold text-slate-800 font-mono">{beneficiary.mobile}</span>
            </div>
            
            <div className="grid grid-cols-12 gap-0 py-0.5">
              <span className="col-span-4 text-[6.2px] font-bold text-slate-400">DOB:</span>
              <span className="col-span-8 text-[6.2px] font-semibold text-slate-700 font-mono">{beneficiary.dob}</span>
            </div>
            
            <div className="grid grid-cols-12 gap-0 py-0.5">
              <span className="col-span-4 text-[6.2px] font-bold text-slate-400">Gender:</span>
              <span className="col-span-8 text-[6.2px] font-semibold text-slate-700">{beneficiary.gender}</span>
            </div>

            <div className="grid grid-cols-12 gap-0 py-0.5">
              <span className="col-span-4 text-[6.2px] font-bold text-slate-400">Address:</span>
              <span className="col-span-8 text-[6.2px] font-semibold text-slate-700 truncate" title={beneficiary.address}>
                {beneficiary.address}
              </span>
            </div>
          </div>

          {/* Card Footer Section inside card layout */}
          <div className="mt-auto flex justify-between items-end pb-0.5 z-10 text-left">
            <div>
              <p className="text-[4.5px] text-slate-400 font-black uppercase leading-none">Created Date</p>
              <p className="text-[6.5px] font-black text-slate-800 font-mono leading-none mt-0.5">
                {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
            
            {/* Signature Draw */}
            <div className="text-center">
              <div className="w-[64px] h-[18px] overflow-hidden flex items-center justify-center border-b border-slate-300">
                <img
                  src={displaySignature}
                  referrerPolicy="no-referrer"
                  alt="Signature"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-[4.5px] text-slate-400 font-bold uppercase mt-0.5">Beneficiary Signature</p>
            </div>
          </div>
        </div>

        {/* Hidden Canvas used for generating exact and true 255x380 digital print layout image */}
        <canvas ref={canvasRef} className="hidden" />

        <div className="w-full mt-5 flex flex-col gap-2">
          <button
            onClick={downloadCardAsPng}
            disabled={downloading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition disabled:opacity-55 cursor-pointer"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-4 h-4 animate-bounce" />
                Successfully Downloaded PNG (255x380px)
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                {downloading ? 'Compiling exact 255x380 Card...' : 'Download Digital Card (.PNG)'}
              </>
            )}
          </button>
          
          <p className="text-[10px] text-slate-400 text-center font-mono mt-1">
            Standard: exact size 255px w × 380px h, no shape stretching.
          </p>
        </div>
      </div>
    </div>
  );
}
