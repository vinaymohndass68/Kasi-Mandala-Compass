
import React, { useEffect, useRef } from 'react';
import { MeditationTimer } from '../types';

interface TimerOverlayProps {
  timer: MeditationTimer;
  onCancel: () => void;
}

const TimerOverlay: React.FC<TimerOverlayProps> = ({ timer, onCancel }) => {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const safeCloseAudio = () => {
    if (audioCtxRef.current) {
      try {
        if (audioCtxRef.current.state !== 'closed') {
          audioCtxRef.current.close();
        }
      } catch (e) {
        console.warn("Error closing AudioContext in Timer:", e);
      } finally {
        audioCtxRef.current = null;
      }
    }
  };

  // Synthesize a soft "Sacred Bell" sound
  const playBell = () => {
    try {
      safeCloseAudio();
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 4);
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 4);
    } catch (e) {
      console.warn("Audio context blocked or unavailable");
    }
  };

  useEffect(() => {
    // Play bell when timer starts
    if (timer.isActive && timer.timeLeft === timer.duration) {
      playBell();
    }
    return () => {
      safeCloseAudio();
    };
  }, [timer.isActive, timer.duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = (timer.timeLeft / timer.duration) * 100;
  const isInhaling = timer.timeLeft % 8 < 4;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/98 backdrop-blur-2xl animate-fade-in text-center p-8">
      <style>{`
        @keyframes breathe-circle {
          0%, 100% { transform: scale(1); opacity: 0.2; filter: blur(40px); }
          50% { transform: scale(1.4); opacity: 0.5; filter: blur(60px); }
        }
        @keyframes mantra-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; text-shadow: 0 0 0px rgba(251, 191, 36, 0); }
          50% { transform: scale(1.05); opacity: 1; text-shadow: 0 0 20px rgba(251, 191, 36, 0.6); }
        }
        @keyframes subtle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pranayama-light {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(2.5); opacity: 0.8; box-shadow: 0 0 30px rgba(251, 191, 36, 0.4); }
        }
        .animate-breathe-circle {
          animation: breathe-circle 8s ease-in-out infinite;
        }
        .animate-mantra-pulse {
          animation: mantra-pulse 4s ease-in-out infinite;
        }
        .animate-subtle-float {
          animation: subtle-float 6s ease-in-out infinite;
        }
        .animate-pranayama-light {
          animation: pranayama-light 8s ease-in-out infinite;
        }
      `}</style>

      {/* Deep Meditation Background Blobs */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-80 h-80 bg-amber-500/15 rounded-full animate-breathe-circle"></div>
        <div className="w-[30rem] h-[30rem] bg-red-900/10 rounded-full animate-breathe-circle" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="relative z-10 space-y-10 max-w-sm w-full animate-subtle-float">
        {timer.associatedDeity && (
          <div className="space-y-4 animate-slide-up">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-amber-500/60 uppercase tracking-[0.4em] font-bold">Connecting with</span>
              <h2 className="text-amber-500 font-cinzel text-4xl font-bold tracking-widest uppercase drop-shadow-[0_0_10px_rgba(251,191,36,0.3)]">
                {timer.associatedDeity.name}
              </h2>
            </div>
            
            <div className="h-px w-16 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent mx-auto"></div>
            
            <div className="py-6 px-4">
              <p className="italic text-amber-100/90 font-serif text-2xl animate-mantra-pulse tracking-wide leading-relaxed">
                "{timer.associatedDeity.mantra}"
              </p>
              <div className="mt-4 flex justify-center gap-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-1 h-1 rounded-full bg-amber-500/30 animate-pulse" style={{ animationDelay: `${i * 0.5}s` }}></div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="relative flex items-center justify-center">
          <svg className="w-56 h-56 transform -rotate-90">
            <circle
              cx="112"
              cy="112"
              r="104"
              stroke="currentColor"
              strokeWidth="2"
              fill="transparent"
              className="text-slate-900"
            />
            <circle
              cx="112"
              cy="112"
              r="104"
              stroke="url(#timerGradient)"
              strokeWidth="4"
              fill="transparent"
              strokeDasharray={653.45}
              strokeDashoffset={653.45 - (653.45 * progress) / 100}
              className="transition-all duration-1000 linear"
              strokeLinecap="round"
            />
            <defs>
              <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-mono font-light text-white tabular-nums tracking-tight">
              {formatTime(timer.timeLeft)}
            </span>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Remaining</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
             <div className="w-3 h-3 bg-amber-500 rounded-full animate-pranayama-light"></div>
             <div className="absolute inset-0 bg-amber-400 blur-xl opacity-20 rounded-full scale-150"></div>
          </div>
          <div className="space-y-1">
            <p className="text-slate-200 text-xs uppercase tracking-[0.3em] font-bold transition-all duration-700">
              {isInhaling ? "Gently Inhale..." : "Quietly Exhale..."}
            </p>
            <p className="text-amber-500/40 text-[9px] uppercase tracking-[0.2em]">Pranayama Rhythm</p>
          </div>
          <div className="flex justify-center gap-12 opacity-20">
             <i className="fa-solid fa-om text-amber-500 text-sm"></i>
             <i className="fa-solid fa-lotus text-amber-500 text-sm"></i>
          </div>
        </div>

        <button
          onClick={onCancel}
          className="mt-4 px-10 py-3.5 bg-slate-900/50 hover:bg-red-950/30 text-slate-400 hover:text-red-200 border border-slate-800 hover:border-red-900/50 rounded-2xl transition-all text-[10px] font-bold uppercase tracking-[0.2em] active:scale-95 group"
        >
          <span className="group-hover:hidden">Conclude Session</span>
          <span className="hidden group-hover:inline">Release Focus</span>
        </button>
      </div>
    </div>
  );
};

export default TimerOverlay;
