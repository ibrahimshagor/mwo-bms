import { useRef, useState, useEffect, MouseEvent, TouchEvent } from 'react';
import { RotateCcw, Paintbrush } from 'lucide-react';

interface SignaturePadProps {
  onChange: (dataUrl: string) => void;
  savedSignature?: string;
}

export default function SignaturePad({ onChange, savedSignature }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and draw white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (savedSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHasSigned(true);
      };
      img.src = savedSignature;
    }
  }, [savedSignature]);

  const getCoordinates = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    // Scale standard coordinates to coordinate space of canvas element
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1E293B'; // slate-800
    setIsDrawing(true);
  };

  const draw = (e: MouseEvent<HTMLCanvasElement> | TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSigned(true);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Trigger parent callback when stroke stops
    onChange(canvas.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
    onChange('');
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
          <Paintbrush className="w-4 h-4 text-emerald-600" />
          Beneficiary Signature <span className="text-red-500">*</span>
        </label>
        {hasSigned && (
          <button
            type="button"
            onClick={clearCanvas}
            className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 font-medium cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Signature
          </button>
        )}
      </div>
      <div className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-sm">
        <canvas
          id="signature-canvas"
          ref={canvasRef}
          width={400}
          height={120}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-28 touch-none cursor-crosshair"
        />
        <div className="bg-slate-50 text-[10px] text-center py-1 text-slate-400 border-t border-slate-100 font-mono">
          Touch or draw with mouse inside the box above
        </div>
      </div>
    </div>
  );
}
