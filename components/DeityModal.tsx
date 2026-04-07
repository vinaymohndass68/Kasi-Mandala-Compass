
import React, { useEffect, useState, useRef } from 'react';
import { DeityInfo } from '../types';
import { getFullDeityData } from '../services/geminiService';

interface DeityModalProps {
  deity: DeityInfo | null;
  onClose: () => void;
  onStartMeditation: (deity: DeityInfo) => void;
}

const DeityModal: React.FC<DeityModalProps> = ({ deity, onClose, onStartMeditation }) => {
  const [data, setData] = useState<{
    insight: string;
    astrology: { planet: string; significance: string } | null;
    myth: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isHapticActive, setIsHapticActive] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hapticIntervalRef = useRef<number | null>(null);

  const safeCloseAudio = () => {
    if (audioCtxRef.current) {
      try {
        if (audioCtxRef.current.state !== 'closed') audioCtxRef.current.close();
      } catch (e) { console.warn(e); } finally { audioCtxRef.current = null; }
    }
  };

  const playBell = () => {
    try {
      safeCloseAudio();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 3);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 3);
      if (isHapticActive && 'vibrate' in navigator) navigator.vibrate([100, 50, 100]);
    } catch (e) { console.warn(e); }
  };

  useEffect(() => {
    if (deity) {
      setLoading(true);
      getFullDeityData(deity.name, deity.direction).then(res => {
        setData(res);
        setLoading(false);
      });

      if (isHapticActive && 'vibrate' in navigator) {
        hapticIntervalRef.current = window.setInterval(() => {
          navigator.vibrate([20, 100, 20]); 
        }, 2000);
      }
    }
    return () => {
      safeCloseAudio();
      if (hapticIntervalRef.current) clearInterval(hapticIntervalRef.current);
    };
  }, [deity, isHapticActive]);

  if (!deity) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <style>{`
        @keyframes mantra-pulse-subtle {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); text-shadow: 0 0 15px rgba(251, 191, 36, 0.4); }
        }
        @keyframes recitation-guide { 0% { left: -10%; } 100% { left: 110%; } }
        @keyframes haptic-dot-glow { 0%, 100% { transform: scale(1); opacity: 0.3; } 50% { transform: scale(1.5); opacity: 1; box-shadow: 0 0 8px #fbbf24; } }
        .animate-mantra-pulse-subtle { animation: mantra-pulse-subtle 4s ease-in-out infinite; }
        .animate-recitation-guide { animation: recitation-guide 4s linear infinite; }
        .animate-haptic-dot { animation: haptic-dot-glow 2s ease-in-out infinite; }
      `}</style>

      <div className="bg-[#0f172a] border border-amber-500/30 rounded-3xl w-full max-w-md overflow-hidden relative shadow-[0_0_80px_rgba(251,191,36,0.15)] max-h-[90vh] flex flex-col">
        <div className="h-32 bg-gradient-to-br from-amber-600/20 via-slate-900 to-red-900/20 flex flex-col items-center justify-center relative overflow-hidden shrink-0">
           <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
           <h2 className="text-3xl font-cinzel font-bold text-amber-500 tracking-[0.2em] z-10 drop-shadow-lg">{deity.name}</h2>
           <span className="text-[10px] text-amber-500/40 uppercase tracking-[0.5em] mt-1 z-10 font-bold">Divine Guardian</span>
        </div>
        
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors z-20">
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        <div className="p-8 space-y-6 overflow-y-auto scrollbar-hide flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-800/30 p-3 rounded-2xl border border-slate-700/50">
              <span className="text-amber-500/50 uppercase text-[9px] font-bold tracking-widest block mb-1">Direction</span>
              <span className="text-slate-200 font-cinzel text-sm">{deity.direction}</span>
            </div>
            <div className="bg-slate-800/30 p-3 rounded-2xl border border-slate-700/50">
              <span className="text-amber-500/50 uppercase text-[9px] font-bold tracking-widest block mb-1">Element</span>
              <span className="text-slate-200 font-cinzel text-sm">{deity.element}</span>
            </div>
          </div>

          <div className="bg-slate-800/20 p-4 rounded-2xl border border-amber-500/5 relative overflow-hidden">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <i className="fa-solid fa-planet-ring text-amber-500 text-xs animate-pulse"></i>
              </div>
              <div className="flex flex-col">
                <span className="text-amber-500/50 uppercase text-[9px] font-bold tracking-widest">Planet / Influence</span>
                <span className="text-amber-200 font-cinzel text-sm">
                  {loading ? <span className="opacity-30">Tracing orbits...</span> : (data?.astrology?.planet || 'Celestial Body')}
                </span>
              </div>
            </div>
            {!loading && data?.astrology && <p className="text-[10px] leading-relaxed text-slate-400 italic">{data.astrology.significance}</p>}
          </div>

          <div className="bg-amber-900/10 p-5 rounded-2xl border border-amber-500/10 relative">
             <div className="absolute -top-2 left-4 bg-slate-900 px-2 text-[9px] text-amber-500 font-bold tracking-widest">Sacred Lore</div>
             <p className="text-xs leading-relaxed text-slate-300 font-serif italic text-justify">
               {loading ? <span className="animate-pulse">Consulting Akasha...</span> : (data?.myth || 'The lore remains whispers.')}
             </p>
          </div>

          <div className="relative py-4 text-center">
             <div className="flex justify-center items-center gap-3 mb-4">
                <div className={`w-1.5 h-1.5 rounded-full bg-amber-500/40 ${isHapticActive ? 'animate-haptic-dot' : 'opacity-10'}`}></div>
                <h4 className="text-amber-400 font-bold uppercase text-[10px] tracking-[0.3em]">Sacred Vibration</h4>
                <button onClick={playBell} className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 active:scale-90"><i className="fa-solid fa-bell text-[11px] animate-pulse"></i></button>
             </div>
             <p className="text-2xl italic text-amber-500 font-serif animate-mantra-pulse-subtle">"{deity.mantra}"</p>
             <div className="mt-6 h-1 w-32 mx-auto bg-slate-800/50 rounded-full overflow-hidden relative border border-slate-700/30">
                <div className="absolute inset-y-0 w-8 bg-gradient-to-r from-transparent via-amber-500 to-transparent blur-sm animate-recitation-guide"></div>
             </div>
             <button onClick={() => setIsHapticActive(!isHapticActive)} className={`mt-4 text-[8px] uppercase tracking-[0.1em] font-bold ${isHapticActive ? 'text-amber-500/60' : 'text-slate-600'}`}>[ HAPTIC {isHapticActive ? 'ON' : 'OFF'} ]</button>
          </div>

          <div className="bg-slate-900/50 p-5 rounded-2xl border border-amber-500/10 relative">
             <div className="absolute -top-2 left-4 bg-slate-900 px-2 text-[9px] text-amber-500/60 uppercase font-bold tracking-widest">Mandala Insight</div>
             <p className="text-sm leading-relaxed text-slate-400 italic">
               {loading ? <span className="animate-pulse">Consulting the Cosmic Map...</span> : (data?.insight || 'Wisdom unavailable.')}
             </p>
          </div>
        </div>

        <div className="p-6 bg-slate-900/40 flex flex-col gap-3 border-t border-slate-800/50 shrink-0">
           <button onClick={() => onStartMeditation(deity)} className="w-full py-4 bg-gradient-to-r from-amber-600 to-red-700 text-white font-bold rounded-2xl active:scale-[0.98] shadow-lg flex items-center justify-center gap-3 uppercase tracking-widest text-xs"><i className="fa-solid fa-om text-base"></i>Commence Dhyana</button>
           <button onClick={onClose} className="w-full py-2 text-slate-500 text-[9px] uppercase tracking-widest font-bold">Return to Center</button>
        </div>
      </div>
    </div>
  );
};

export default DeityModal;
