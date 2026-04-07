
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Coordinate, DeityInfo, HeadingSource, MeditationTimer, NakshatraInfo, SavedLocation } from './types';
import MandalaDisplay from './components/MandalaDisplay';
import DeityModal from './components/DeityModal';
import TimerOverlay from './components/TimerOverlay';
import CalibrationOverlay from './components/CalibrationOverlay';
import { getNearbyLandmark, getPlacesOfWorshipList, getTodayNakshatra, PlaceOfWorship, checkQuotaLock } from './services/geminiService';

const App: React.FC = () => {
  const [markedLocation, setMarkedLocation] = useState<Coordinate | null>(null);
  const [currentPosition, setCurrentPosition] = useState<Coordinate | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [isMandalaExpanded, setIsMandalaExpanded] = useState(false);
  const [calibrationOffset, setCalibrationOffset] = useState(0);
  const [selectedDeity, setSelectedDeity] = useState<DeityInfo | null>(null);
  const [nakshatra, setNakshatra] = useState<NakshatraInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [showFigure8, setShowFigure8] = useState(false);
  const [headingSource, setHeadingSource] = useState<HeadingSource>('sensor');
  const [isAutoGpsEnabled, setIsAutoGpsEnabled] = useState(true);
  const [nearbyLandmark, setNearbyLandmark] = useState<{ text: string; links: any[] } | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<PlaceOfWorship[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isVerifyingLandmark, setIsVerifyingLandmark] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showSyncToast, setShowSyncToast] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [archivedPoints, setArchivedPoints] = useState<SavedLocation[]>([]);
  const [compassPermissionState, setCompassPermissionState] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isConfirmingLocation, setIsConfirmingLocation] = useState(false);
  const [quotaLockRemaining, setQuotaLockRemaining] = useState(0);
  
  const [timer, setTimer] = useState<MeditationTimer>({
    duration: 300,
    timeLeft: 300,
    isActive: false
  });
  const [showTimerSettings, setShowTimerSettings] = useState(false);

  const headingRef = useRef(0);
  const rawHeadingRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const smoothHeadingRef = useRef(0);

  const SMOOTHING_FACTOR = 0.2;

  useEffect(() => {
    const saved = localStorage.getItem('kasi_mandala_archive');
    if (saved) setArchivedPoints(JSON.parse(saved));

    const initApp = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
        if (selected) {
          try {
            const nakData = await getTodayNakshatra();
            setNakshatra(nakData);
          } catch (e) { console.error("Initial Nakshatra fail", e); }
        }
      } else {
        setHasApiKey(true);
        try {
          const nakData = await getTodayNakshatra();
          setNakshatra(nakData);
        } catch (e) { console.error("Initial Nakshatra fail", e); }
      }
    };
    initApp();

    const quotaInterval = setInterval(() => {
      const lock = checkQuotaLock();
      setQuotaLockRemaining(lock.remaining);
    }, 1000);
    return () => clearInterval(quotaInterval);
  }, []);

  const handleOpenKeySelector = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
      const nakData = await getTodayNakshatra();
      setNakshatra(nakData);
    }
  };

  const handleError = (err: any) => {
    const msg = err?.message || String(err);
    if (msg.includes("429") || msg.includes("QUOTA_LOCK")) {
      setError("Quota exhausted. Sacred Key is recharging (5 mins).");
    } else if (msg.includes("Requested entity was not found")) {
      setError("Model denied. Re-connect Sacred Key.");
      setHasApiKey(false);
    } else {
      setError(msg);
    }
  };

  const handleOrientation = useCallback((e: any) => {
    let h = 0;
    if (e.absolute === true && e.alpha !== null) { h = 360 - e.alpha; }
    else if (e.webkitCompassHeading !== undefined) { h = e.webkitCompassHeading; }
    else if (e.alpha !== null) { h = 360 - e.alpha; }
    
    rawHeadingRef.current = h;
    const targetHeading = (h + calibrationOffset + 360) % 360;
    let diff = targetHeading - smoothHeadingRef.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    const smoothed = (smoothHeadingRef.current + diff * SMOOTHING_FACTOR + 360) % 360;
    smoothHeadingRef.current = smoothed;
    setHeading(smoothed);
    headingRef.current = smoothed;
  }, [calibrationOffset]);

  const requestCompassPermission = async () => {
    const win = window as any;
    const devO = win.DeviceOrientationEvent;
    if (devO && typeof devO.requestPermission === 'function') {
      try {
        const p = await devO.requestPermission();
        if (p === 'granted') {
          setCompassPermissionState('granted');
          win.addEventListener('deviceorientationabsolute', handleOrientation);
          win.addEventListener('deviceorientation', handleOrientation);
          return true;
        }
        setCompassPermissionState('denied');
        return false;
      } catch { return false; }
    } else {
      setCompassPermissionState('granted');
      if ('ondeviceorientationabsolute' in win) win.addEventListener('deviceorientationabsolute', handleOrientation);
      else win.addEventListener('deviceorientation', handleOrientation);
      return true;
    }
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentPosition(coords);
        if (isAutoGpsEnabled && pos.coords.heading !== null && pos.coords.speed !== null && pos.coords.speed > 1.2) {
          const gpsH = pos.coords.heading;
          const rawH = rawHeadingRef.current;
          const newOff = (gpsH - rawH + 360) % 360;
          if (Math.abs(newOff - calibrationOffset) > 3 || headingSource !== 'gps') {
            setCalibrationOffset(newOff);
            setHeadingSource('gps');
            setShowSyncToast(true);
            setTimeout(() => setShowSyncToast(false), 3000);
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 500 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [calibrationOffset, headingSource, isAutoGpsEnabled]);

  useEffect(() => {
    if (timer.isActive && timer.timeLeft > 0) {
      timerIntervalRef.current = window.setInterval(() => setTimer(prev => ({ ...prev, timeLeft: prev.timeLeft - 1 })), 1000);
    } else if (timer.timeLeft === 0) {
      setTimer(prev => ({ ...prev, isActive: false }));
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [timer.isActive, timer.timeLeft]);

  const confirmMarkLocation = () => {
    if (!currentPosition) return;
    setMarkedLocation(currentPosition);
    setIsConfirmingLocation(false);
    const newArch: SavedLocation = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      coords: currentPosition,
      heading: heading,
      landmark: nearbyLandmark?.text,
      nakshatra: nakshatra?.name
    };
    const up = [newArch, ...archivedPoints].slice(0, 20);
    setArchivedPoints(up);
    localStorage.setItem('kasi_mandala_archive', JSON.stringify(up));
    if ('vibrate' in navigator) navigator.vibrate(100);
  };

  const handleMarkButtonClick = async () => {
    if (compassPermissionState !== 'granted') {
      const g = await requestCompassPermission();
      if (!g) return;
    }
    setIsConfirmingLocation(true);
  };

  const toggleMandala = async () => {
    if (!markedLocation) await handleMarkButtonClick();
    else setIsMandalaExpanded(!isMandalaExpanded);
  };

  const startTimer = (s: number, d?: DeityInfo) => {
    setTimer({ duration: s, timeLeft: s, isActive: true, associatedDeity: d });
    setShowTimerSettings(false);
    setSelectedDeity(null);
  };

  const verifyWithLandmarks = async () => {
    if (!currentPosition) return;
    if (quotaLockRemaining > 0) {
        setError(`Sacred Key is recharging. Please wait ${quotaLockRemaining}s.`);
        return;
    }
    setIsVerifyingLandmark(true);
    setError(null);
    setHasSearched(true);
    try {
      const [lm, pl] = await Promise.all([
        getNearbyLandmark(currentPosition.lat, currentPosition.lng, heading),
        getPlacesOfWorshipList(currentPosition.lat, currentPosition.lng)
      ]);
      setNearbyLandmark(lm);
      setNearbyPlaces(pl || []);
      if (!pl || pl.length === 0) {
        setError("No major sacred sites detected in this 25km radius. Try another point.");
      }
    } catch (err) { handleError(err); } finally { setIsVerifyingLandmark(false); }
  };

  const handleShareWhatsApp = async () => {
    if (!currentPosition) return;
    setIsSharing(true);
    try {
      const pl = nearbyPlaces.length > 0 ? nearbyPlaces : await getPlacesOfWorshipList(currentPosition.lat, currentPosition.lng);
      let m = `Om Namah Shivaya! 🕉️\n\nKasi Mandala Point 'X' Marked:\n📍 Lat: ${currentPosition.lat.toFixed(4)}, Lng: ${currentPosition.lng.toFixed(4)}\n🧭 Facing: ${Math.round(heading)}°`;
      if (nakshatra) m += `\n🌙 Nakshatra: ${nakshatra.name}`;
      if (nearbyLandmark) m += `\n\n✨ *DIVINE LANDMARK:* ${nearbyLandmark.text}`;
      if (pl.length > 0) {
        m += `\n\n🔱 *SACRED SITES (25KM):*`;
        pl.forEach((p, i) => m += `\n${i+1}. *${p.name}* (${p.approxDistance})\n🔗 ${p.mapUrl}`);
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(m)}`, '_blank');
    } catch (err) { handleError(err); } finally { setIsSharing(false); }
  };

  const handleDownloadPdf = async () => {
    if (!currentPosition) return;
    setIsGeneratingPdf(true);
    try {
      const pl = nearbyPlaces.length > 0 ? nearbyPlaces : await getPlacesOfWorshipList(currentPosition.lat, currentPosition.lng);
      const doc = new jsPDF();
      const pW = doc.internal.pageSize.getWidth();
      const pH = doc.internal.pageSize.getHeight();
      
      const drawDivineBackground = () => {
        doc.setFillColor(255, 253, 245);
        doc.rect(0, 0, pW, pH, 'F');
        doc.setDrawColor(251, 191, 36); doc.setLineWidth(0.5);
        doc.rect(5, 5, pW-10, pH-10, 'S');
      };

      drawDivineBackground();
      doc.setFillColor(153, 27, 27); doc.rect(0, 0, pW, 40, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(26); doc.text("KASI MANDALA", pW/2, 22, {align:"center"});
      doc.setFontSize(10); doc.text("SACRED ORIENTATION & SPIRITUAL GEOGRAPHY", pW/2, 32, {align:"center"});
      
      doc.setTextColor(30, 41, 59);
      let y = 55;
      doc.setFontSize(12); doc.text("Point 'X' Reference Established", 20, y);
      doc.setFontSize(10); y += 6;
      doc.text(`Latitude: ${currentPosition.lat.toFixed(4)}, Longitude: ${currentPosition.lng.toFixed(4)}`, 20, y);
      y += 5; doc.text(`Timestamp: ${new Date().toLocaleString()}`, 20, y);
      if (nakshatra) { y += 5; doc.setTextColor(180, 83, 9); doc.text(`Nakshatra: ${nakshatra.name}`, 20, y); }
      
      y += 20;
      if (nearbyLandmark) {
        doc.setTextColor(153, 27, 27); doc.setFontSize(15); doc.text("Dominant Divine Horizon", 20, y);
        y += 8; doc.setTextColor(30, 41, 59); doc.setFontSize(11);
        const lns = doc.splitTextToSize(nearbyLandmark.text, pW - 40);
        doc.text(lns, 20, y); y += (lns.length * 6) + 12;
      }

      doc.setTextColor(153, 27, 27); doc.setFontSize(15); doc.text(`Sacred Sites within 25km (${pl.length})`, 20, y);
      y += 12;

      pl.forEach((p, i) => {
        if (y > pH - 40) { 
          doc.addPage(); drawDivineBackground(); 
          doc.setFillColor(153, 27, 27); doc.rect(0, 0, pW, 15, 'F');
          y = 30; 
        }
        doc.setTextColor(30, 41, 59); doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text(`${i+1}. ${p.name}`, 20, y);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.text(`(${p.approxDistance})`, pW-60, y);
        y += 7;
        const dLns = doc.splitTextToSize(p.description, pW - 40);
        doc.text(dLns, 20, y); y += (dLns.length * 5) + 5;
        doc.setTextColor(59, 130, 246); doc.text(`Map Link: ${p.mapUrl}`, 20, y);
        y += 15;
      });

      doc.save(`Kasi_Mandala_Orientation_${Date.now()}.pdf`);
    } catch (err) { handleError(err); } finally { setIsGeneratingPdf(false); }
  };

  if (hasApiKey === false) {
    return (
      <div className="fixed inset-0 bg-[#0a0f1d] flex flex-col items-center justify-center p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 shadow-2xl">
          <i className="fa-solid fa-key text-4xl text-amber-500 animate-pulse"></i>
        </div>
        <h2 className="text-3xl font-cinzel text-amber-500 font-bold">Sacred Key Needed</h2>
        <p className="text-slate-400 text-sm max-w-xs leading-relaxed">To unveil landmarks and sacred geography, please connect your Gemini API key from a billing-enabled project.</p>
        <button onClick={handleOpenKeySelector} className="px-12 py-4 bg-amber-500 text-slate-900 font-bold rounded-2xl shadow-xl hover:shadow-amber-500/20 active:scale-95 transition-all uppercase tracking-widest text-xs">Connect Key</button>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0a0f1d] flex flex-col items-center p-6 font-inter">
      {showCamera && <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover z-0 opacity-25 mix-blend-screen" />}
      
      <header className="z-10 w-full text-center mb-4 shrink-0 pointer-events-none">
        <h1 className="text-4xl font-cinzel font-bold text-amber-500 tracking-tighter drop-shadow-2xl">KASI MANDALA</h1>
        <div className="flex flex-col items-center gap-2 mt-2">
           <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900/60 backdrop-blur-md rounded-full border border-slate-800 shadow-xl">
             <span className={`w-2 h-2 rounded-full ${headingSource === 'gps' ? 'bg-green-400 animate-pulse' : 'bg-blue-400'}`}></span>
             <span className="text-[10px] text-slate-200 font-bold uppercase tracking-widest">{Math.round(heading)}° {headingSource.toUpperCase()}</span>
           </div>
           {nakshatra && <span className="text-[9px] text-blue-300 font-bold uppercase tracking-[0.25em] bg-blue-900/30 px-5 py-1.5 rounded-full border border-blue-500/20 shadow-lg animate-fade-in">{nakshatra.name} NAKSHATRA</span>}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center w-full relative z-10 overflow-hidden">
        {error && (
          <div onClick={() => setError(null)} className="absolute top-4 bg-red-950/80 backdrop-blur-md border border-red-500/50 text-red-100 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest z-[100] cursor-pointer animate-fade-in shadow-2xl flex items-center gap-2">
             <i className="fa-solid fa-circle-exclamation"></i> {error}
          </div>
        )}

        {isConfirmingLocation && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-6">
            <div className="bg-[#0f172a] border border-amber-500/30 p-10 rounded-[2.5rem] max-w-xs w-full text-center space-y-8 shadow-[0_0_100px_rgba(251,191,36,0.1)]">
              <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20 shadow-inner">
                <i className="fa-solid fa-location-crosshairs text-4xl text-amber-500 animate-pulse"></i>
              </div>
              <div>
                <h3 className="text-2xl font-cinzel font-bold text-amber-500 mb-2">Establish Point 'X'?</h3>
                <p className="text-xs text-slate-400 leading-relaxed px-2">Marking this spot as the sacred origin. Point 'X' will anchor in the mandala.</p>
              </div>
              <div className="flex flex-col gap-4">
                <button onClick={confirmMarkLocation} className="w-full py-4 bg-amber-500 text-slate-900 font-bold rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-xl hover:shadow-amber-500/20 active:scale-95 transition-all">Confirm Point 'X'</button>
                <button onClick={() => setIsConfirmingLocation(false)} className="w-full py-2 text-slate-500 font-bold text-[9px] uppercase tracking-widest hover:text-white transition-colors">Discard</button>
              </div>
            </div>
          </div>
        )}

        <div className="relative shrink-0 flex items-center justify-center w-full h-full max-h-[65vh]">
          {isVerifyingLandmark && (
            <div className="absolute inset-0 z-40 flex items-center justify-center animate-fade-in pointer-events-none">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mx-auto"></div>
                <p className="text-amber-500 text-[10px] font-bold uppercase tracking-[0.3em] animate-pulse">Scanning 25km radius...</p>
              </div>
            </div>
          )}
          <MandalaDisplay 
             heading={heading} isExpanded={isMandalaExpanded} onDeityClick={setSelectedDeity}
             isCalibrating={isCalibrating} calibrationOffset={calibrationOffset}
             currentPosition={currentPosition} markedLocation={markedLocation} nakshatra={nakshatra}
          />
        </div>

        {/* PERSISTENT DISCOVERY HUD */}
        <div className="absolute bottom-[12%] left-0 right-0 z-30 flex flex-col items-center gap-4 pointer-events-none px-4">
           {(hasSearched || nearbyPlaces.length > 0) && (
             <div className="bg-[#0a0f1d]/90 p-4 rounded-3xl border-2 border-blue-500/30 backdrop-blur-3xl shadow-[0_0_50px_rgba(59,130,246,0.2)] max-w-sm w-full pointer-events-auto animate-slide-up flex flex-col max-h-[45vh]">
               <div className="flex justify-between items-center mb-3 shrink-0 px-2">
                  <div className="flex flex-col">
                    <span className="text-blue-400 text-[10px] font-bold uppercase tracking-[0.3em] flex items-center gap-2">
                       <i className="fa-solid fa-synagogue"></i> 25KM Sacred Sites
                    </span>
                    <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest">
                        {nearbyPlaces.length > 0 ? `${nearbyPlaces.length} Sites Discovered` : isVerifyingLandmark ? 'Connecting with Akashic Records...' : 'No sites found in radius'}
                    </span>
                  </div>
                  <button onClick={() => { setNearbyPlaces([]); setHasSearched(false); }} className="w-8 h-8 rounded-full bg-slate-900/50 flex items-center justify-center text-slate-500 hover:text-white transition-colors">
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
               </div>
               
               <div className="overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {nearbyPlaces.length === 0 && !isVerifyingLandmark ? (
                      <div className="py-10 text-center space-y-3">
                          <div className="w-12 h-12 rounded-full bg-slate-800/30 flex items-center justify-center mx-auto">
                            <i className="fa-solid fa-moon text-slate-600 text-xl"></i>
                          </div>
                          <p className="text-[10px] text-slate-500 italic px-8 leading-relaxed">Divine landmarks are hidden here. Try moving or retry scanning for up to 25km radius.</p>
                          <button onClick={verifyWithLandmarks} className="px-6 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[9px] uppercase font-bold tracking-widest rounded-xl hover:bg-blue-500/20 transition-all">Retry Scan</button>
                      </div>
                  ) : nearbyPlaces.map((site, i) => (
                    <div key={i} className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50 flex justify-between items-center group hover:border-blue-500/30 transition-all">
                       <div className="flex-1 min-w-0 pr-4">
                          <h4 className="text-[12px] font-bold text-slate-100 group-hover:text-blue-400 transition-colors truncate">{site.name}</h4>
                          <p className="text-[10px] text-slate-500 italic truncate mb-1">{site.approxDistance} km</p>
                          <p className="text-[9px] text-slate-400 line-clamp-2 leading-relaxed opacity-70 group-hover:opacity-100">{site.description}</p>
                       </div>
                       <a href={site.mapUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 hover:bg-blue-500/20 transition-all border border-blue-500/20 shadow-inner">
                          <i className="fa-solid fa-location-arrow text-[12px]"></i>
                       </a>
                    </div>
                  ))}
               </div>
             </div>
           )}
        </div>

        {isMandalaExpanded && (
          <div className="absolute bottom-6 left-0 right-0 z-20 flex flex-col items-center gap-4 animate-slide-up pointer-events-none px-4">
             {nearbyLandmark && (
               <div className="bg-slate-950/90 p-5 rounded-2xl border border-amber-500/30 backdrop-blur-2xl shadow-2xl max-w-sm w-full pointer-events-auto animate-fade-in">
                 <div className="flex justify-between items-start mb-3">
                   <span className="text-amber-500 text-[9px] font-bold uppercase tracking-[0.3em]">Horizon Landmark</span>
                   <button onClick={() => setNearbyLandmark(null)} className="text-slate-600 hover:text-white transition-colors"><i className="fa-solid fa-xmark text-xs"></i></button>
                 </div>
                 <p className="text-slate-200 text-xs italic leading-relaxed font-serif">{nearbyLandmark.text}</p>
                 {nearbyLandmark.links?.length > 0 && (
                   <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-amber-500/10">
                      {nearbyLandmark.links.map((lnk, idx) => (
                        <a key={idx} href={lnk.uri} target="_blank" rel="noopener noreferrer" className="text-[9px] text-blue-400 hover:text-blue-300 font-bold underline truncate max-w-[150px]">{lnk.title || 'Divine Map'}</a>
                      ))}
                   </div>
                 )}
               </div>
             )}
             
             <div className="flex gap-4 pointer-events-auto">
                <button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="px-7 py-3.5 bg-slate-900/90 border border-slate-700 text-amber-500 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-3 backdrop-blur-xl shadow-xl hover:border-amber-500/50 transition-all active:scale-95">
                  <i className={`fa-solid ${isGeneratingPdf ? 'fa-spinner animate-spin' : 'fa-file-pdf'}`}></i> {isGeneratingPdf ? 'GENERATING...' : 'PDF SCROLL'}
                </button>
                <button onClick={handleShareWhatsApp} disabled={isSharing} className="px-7 py-3.5 bg-green-950/40 border border-green-500/30 text-green-400 rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] flex items-center gap-3 backdrop-blur-xl shadow-xl hover:bg-green-900/30 transition-all active:scale-95">
                  <i className={`fa-solid ${isSharing ? 'fa-circle-notch animate-spin' : 'fa-brands fa-whatsapp'}`}></i> SHARE
                </button>
             </div>
          </div>
        )}
      </main>

      <footer className="z-20 w-full max-w-md flex flex-col gap-5 mt-4 pb-6 shrink-0">
        <div className="flex justify-center gap-4">
          <button onClick={() => setShowArchive(true)} className="w-16 h-16 rounded-[1.5rem] bg-slate-900/80 border border-slate-700 text-amber-500 flex items-center justify-center hover:bg-slate-800 transition-all active:scale-95 shadow-xl"><i className="fa-solid fa-scroll text-xl"></i></button>
          
          <button onClick={toggleMandala} className={`flex-1 py-4 rounded-[1.5rem] font-cinzel font-bold text-lg tracking-[0.1em] transition-all shadow-2xl active:scale-[0.97] flex items-center justify-center gap-4 border ${isMandalaExpanded ? 'bg-red-700 text-white border-red-500' : 'bg-amber-500 text-slate-950 border-amber-400'}`}>
            <i className={`fa-solid ${isMandalaExpanded ? 'fa-compress' : 'fa-location-dot'}`}></i>
            {isMandalaExpanded ? 'BACK' : markedLocation ? 'MANDALA' : "MARK POINT 'X'"}
          </button>
          
          <div className="relative group">
            <button 
              onClick={verifyWithLandmarks} 
              disabled={isVerifyingLandmark || !currentPosition || quotaLockRemaining > 0} 
              className={`w-16 h-16 rounded-[1.5rem] bg-blue-500/10 border-2 ${quotaLockRemaining > 0 ? 'border-red-500/30 grayscale' : nearbyPlaces.length === 0 ? 'border-blue-500/60 animate-pulse' : 'border-blue-500/30'} text-blue-400 flex flex-col items-center justify-center hover:bg-blue-500/20 transition-all active:scale-95 shadow-xl ${isVerifyingLandmark ? 'opacity-50' : ''}`}
            >
              {quotaLockRemaining > 0 ? (
                  <>
                    <i className="fa-solid fa-hourglass-half text-red-500"></i>
                    <span className="text-[8px] font-bold mt-1 text-red-500">{quotaLockRemaining}s</span>
                  </>
              ) : (
                  <>
                    <i className={`fa-solid ${isVerifyingLandmark ? 'fa-radar fa-spin text-amber-500' : 'fa-radar text-xl'}`}></i>
                    <span className="text-[7px] font-bold uppercase tracking-tighter mt-1">25KM DISCOVER</span>
                  </>
              )}
            </button>
            {!isVerifyingLandmark && nearbyPlaces.length === 0 && quotaLockRemaining === 0 && (
              <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[8px] px-3 py-1.5 rounded-lg whitespace-nowrap animate-bounce pointer-events-none uppercase font-bold shadow-xl border border-blue-400 z-50">
                <span className="flex items-center gap-1"><i className="fa-solid fa-wand-sparkles"></i> Scan 25km radius</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center px-4">
           <button onClick={() => setIsCalibrating(true)} className="text-[9px] text-slate-500 uppercase tracking-[0.3em] font-bold hover:text-slate-300 transition-colors py-2 border-b border-transparent hover:border-slate-800">Compass Config</button>
           <button onClick={() => setShowTimerSettings(true)} className="text-[9px] text-amber-500/40 uppercase tracking-[0.3em] font-bold hover:text-amber-500 transition-colors py-2 border-b border-transparent hover:border-amber-900/30">Meditation Timer</button>
        </div>
      </footer>

      {isCalibrating && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in">
           <div className="bg-[#0f172a] border border-blue-500/30 p-10 rounded-[3rem] w-full max-w-xs space-y-10 shadow-2xl">
              <div className="flex justify-between items-center">
                 <h3 className="text-xl font-cinzel text-blue-400 font-bold uppercase tracking-widest">Alignment</h3>
                 <button onClick={() => setIsCalibrating(false)} className="text-slate-600 hover:text-white"><i className="fa-solid fa-xmark text-lg"></i></button>
              </div>
              <div className="flex items-center justify-between gap-6 py-4">
                 <button onClick={() => setCalibrationOffset(prev => (prev-1+360)%360)} className="w-14 h-14 bg-slate-800 rounded-2xl text-white active:scale-90 transition-all shadow-lg"><i className="fa-solid fa-minus"></i></button>
                 <div className="text-center">
                    <span className="text-4xl font-mono text-blue-400 font-bold tracking-tighter">{calibrationOffset}°</span>
                    <p className="text-[9px] text-slate-500 mt-2 uppercase font-bold tracking-widest">Manual Shift</p>
                 </div>
                 <button onClick={() => setCalibrationOffset(prev => (prev+1+360)%360)} className="w-14 h-14 bg-slate-800 rounded-2xl text-white active:scale-90 transition-all shadow-lg"><i className="fa-solid fa-plus"></i></button>
              </div>
              <div className="bg-slate-900/50 p-5 rounded-3xl flex items-center justify-between border border-slate-800 shadow-inner">
                 <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">GPS Realignment</span>
                 <button onClick={() => setIsAutoGpsEnabled(!isAutoGpsEnabled)} className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isAutoGpsEnabled ? 'bg-green-500' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-md ${isAutoGpsEnabled ? 'right-1' : 'left-1'}`}></div>
                 </button>
              </div>
              <button 
                onClick={() => { setShowFigure8(true); setIsCalibrating(false); }}
                className="w-full py-4 bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold rounded-2xl text-[10px] uppercase tracking-widest hover:bg-blue-500/20 transition-all"
              >
                Perform Infinity Calib
              </button>
           </div>
        </div>
      )}

      {showTimerSettings && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-fade-in">
           <div className="bg-[#0f172a] border border-amber-500/30 p-10 rounded-[3rem] w-full max-w-xs space-y-8 shadow-2xl">
              <div className="flex justify-between items-center">
                 <h3 className="text-xl font-cinzel text-amber-500 font-bold uppercase tracking-widest">Dhyana Timer</h3>
                 <button onClick={() => setShowTimerSettings(false)} className="text-slate-600 hover:text-white"><i className="fa-solid fa-xmark text-lg"></i></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 {[60, 300, 600, 1200].map(s => (
                   <button key={s} onClick={() => startTimer(s)} className="p-5 bg-slate-900/50 border border-slate-800 rounded-3xl text-amber-400 font-bold hover:border-amber-500/50 transition-all shadow-lg active:scale-95">{s/60}m</button>
                 ))}
              </div>
              <p className="text-[9px] text-slate-500 text-center uppercase tracking-widest font-bold opacity-60">Focus on the Breath</p>
           </div>
        </div>
      )}

      <DeityModal deity={selectedDeity} onClose={() => setSelectedDeity(null)} onStartMeditation={(d) => startTimer(300, d)} />
      {timer.isActive && <TimerOverlay timer={timer} onCancel={() => setTimer(p => ({...p, isActive: false}))} />}
      {showFigure8 && <CalibrationOverlay onComplete={() => setShowFigure8(false)} />}
    </div>
  );
};

export default App;
