
import React, { useEffect, useState } from 'react';

interface CalibrationOverlayProps {
  onComplete: () => void;
}

const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 100);

    // Subtle vibration patterns to guide the user
    const vibrationInterval = setInterval(() => {
      if ('vibrate' in navigator) {
        navigator.vibrate([20, 100]);
      }
    }, 2000);

    return () => {
      clearInterval(interval);
      clearInterval(vibrationInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[150] bg-[#0a0f1d]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-8 animate-fade-in text-center">
      <style>{`
        @keyframes infinity-move {
          0% { offset-distance: 0%; }
          100% { offset-distance: 100%; }
        }
        .infinity-path {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: draw-path 2s ease-out forwards;
        }
        @keyframes draw-path {
          to { stroke-dashoffset: 0; }
        }
        .moving-device {
          offset-path: path('M 100 50 C 150 50 150 100 100 100 C 50 100 50 50 100 50 C 150 50 150 0 100 0 C 50 0 50 50 100 50');
          animation: infinity-move 3s linear infinite;
        }
      `}</style>

      <div className="max-w-xs w-full space-y-10">
        <header className="space-y-2">
          <h2 className="text-2xl font-cinzel font-bold text-amber-500 uppercase tracking-widest">Magnetic Alignment</h2>
          <p className="text-slate-400 text-xs leading-relaxed font-medium uppercase tracking-wider">
            Rotate your device in a steady figure-8 pattern to calibrate with the magnetic field of Kasi.
          </p>
        </header>

        {/* Figure-8 Animation Container */}
        <div className="relative h-64 flex items-center justify-center">
          <svg viewBox="0 0 200 150" className="w-full h-full overflow-visible">
            {/* The Infinity Path */}
            <path
              d="M 100 75 C 150 75 150 125 100 125 C 50 125 50 75 100 75 C 150 75 150 25 100 25 C 50 25 50 75 100 75"
              fill="none"
              stroke="#fbbf24"
              strokeWidth="1"
              strokeDasharray="4 4"
              className="opacity-20"
            />
            
            {/* The "Ghost" device along the path */}
            <g className="moving-device">
              <rect x="-10" y="-15" width="20" height="30" rx="3" fill="#fbbf24" className="shadow-2xl" />
              <rect x="-8" y="-13" width="16" height="26" rx="2" fill="#0a0f1d" />
              <circle cx="0" cy="11" r="1.5" fill="#fbbf24" />
              {/* Pulsing glow */}
              <circle cx="0" cy="0" r="20" fill="url(#glowGradient)" className="animate-pulse" />
            </g>
            
            <defs>
              <radialGradient id="glowGradient">
                <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        {/* Progress Bar */}
        <div className="space-y-4">
          <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div 
              className="h-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Synchronizing...</span>
            <span className="text-amber-500">{progress}%</span>
          </div>
        </div>

        <button
          onClick={onComplete}
          disabled={progress < 100}
          className={`w-full py-4 rounded-2xl font-cinzel font-bold text-xs tracking-widest uppercase transition-all shadow-xl active:scale-95 ${
            progress >= 100 
            ? 'bg-amber-500 text-slate-900 border-amber-400' 
            : 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed'
          }`}
        >
          {progress >= 100 ? 'Alignment Complete' : 'Acquiring Data'}
        </button>
      </div>
    </div>
  );
};

export default CalibrationOverlay;
