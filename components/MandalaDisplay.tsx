
import React, { useState, useEffect, useMemo } from 'react';
import { DIRECTIONS, MANDALA_COLORS } from '../constants';
import { DeityInfo, Coordinate, NakshatraInfo } from '../types';

interface MandalaDisplayProps {
  heading: number;
  isExpanded: boolean;
  onDeityClick: (deity: DeityInfo) => void;
  isCalibrating?: boolean;
  calibrationOffset?: number;
  currentPosition?: Coordinate | null;
  markedLocation?: Coordinate | null;
  nakshatra?: NakshatraInfo | null;
}

const MandalaDisplay: React.FC<MandalaDisplayProps> = ({ 
  heading, 
  isExpanded, 
  onDeityClick,
  isCalibrating = false,
  calibrationOffset = 0,
  currentPosition,
  markedLocation,
  nakshatra
}) => {
  const [activeDeityName, setActiveDeityName] = useState<string | null>(null);
  const [hoveredDeity, setHoveredDeity] = useState<DeityInfo | null>(null);
  const [lastOffset, setLastOffset] = useState(calibrationOffset);
  const [flashAdjustment, setFlashAdjustment] = useState(false);
  
  const size = isExpanded ? 400 : 80;
  const radius = size / 2.2;
  const center = size / 2;

  // Visual scaling: 50 meters is the maximum distance shown on the ring
  const MAX_VISUAL_DISTANCE = 50;

  // We want the mandala to rotate with the compass
  const rotation = -heading;

  // Trigger visual feedback for calibration
  useEffect(() => {
    if (calibrationOffset !== lastOffset) {
      setFlashAdjustment(true);
      const timer = setTimeout(() => setFlashAdjustment(false), 300);
      setLastOffset(calibrationOffset);
      return () => clearTimeout(timer);
    }
  }, [calibrationOffset, lastOffset]);

  // Calculate relative position of 'X' marker if user has moved
  const relativeXMarker = useMemo(() => {
    if (!currentPosition || !markedLocation) return { x: center, y: center, distance: 0 };

    const toRad = (n: number) => (n * Math.PI) / 180;
    const toDeg = (n: number) => (n * 180) / Math.PI;

    const lat1 = toRad(currentPosition.lat);
    const lon1 = toRad(currentPosition.lng);
    const lat2 = toRad(markedLocation.lat);
    const lon2 = toRad(markedLocation.lng);

    // Haversine distance in meters
    const R = 6371e3;
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // Initial bearing
    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;

    // Calculate visual offset from center based on bearing and distance
    const visualAngleRad = toRad(bearing - 90);
    const visualDistance = Math.min(distance, MAX_VISUAL_DISTANCE) * (radius / MAX_VISUAL_DISTANCE);
    
    return {
      x: center + visualDistance * Math.cos(visualAngleRad),
      y: center + visualDistance * Math.sin(visualAngleRad),
      distance: distance
    };
  }, [currentPosition, markedLocation, center, radius]);

  // Chandra (Moon) Nakshatra Position
  const chandraMarker = useMemo(() => {
    if (!nakshatra) return null;
    const angleRad = ((nakshatra.angle - 90) * Math.PI) / 180;
    return {
      x: center + (radius * 0.9) * Math.cos(angleRad),
      y: center + (radius * 0.9) * Math.sin(angleRad)
    };
  }, [nakshatra, center, radius]);

  const handleLocalClick = (dir: DeityInfo) => {
    setActiveDeityName(dir.name);
    setTimeout(() => {
      onDeityClick(dir);
      setActiveDeityName(null);
    }, 700);
  };

  const getDirectionAbbr = (angle: number) => {
    if (angle === 270) return "N";
    if (angle === 315) return "NE";
    if (angle === 0) return "E";
    if (angle === 45) return "SE";
    if (angle === 90) return "S";
    if (angle === 135) return "SW";
    if (angle === 180) return "W";
    if (angle === 225) return "NW";
    return "";
  };

  return (
    <div 
      className={`relative transition-all duration-1000 ease-out transform ${
        isExpanded ? 'scale-100' : 'scale-50'
      }`}
      style={{ width: size, height: size }}
    >
      <style>{`
        @keyframes deity-pulse { 0% { r: 14; opacity: 1; } 100% { r: 35; opacity: 0; } }
        @keyframes x-glow { 0%, 100% { filter: drop-shadow(0 0 5px #ef4444); transform: scale(1); } 50% { filter: drop-shadow(0 0 15px #ef4444); transform: scale(1.1); } }
        @keyframes chandra-glow { 0%, 100% { filter: drop-shadow(0 0 5px #60a5fa); opacity: 0.8; } 50% { filter: drop-shadow(0 0 15px #60a5fa); opacity: 1; } }
        @keyframes magnetic-pulse { 0% { opacity: 0.2; } 50% { opacity: 0.6; } 100% { opacity: 0.2; } }
        .animate-x-glow { animation: x-glow 2s infinite ease-in-out; }
        .animate-deity-pulse { animation: deity-pulse 0.7s infinite; }
        .animate-chandra-glow { animation: chandra-glow 3s ease-in-out infinite; }
        .animate-magnetic-pulse { animation: magnetic-pulse 2s infinite; }
      `}</style>

      {/* Deity Tooltip */}
      {isExpanded && hoveredDeity && (
        <div 
          className="absolute z-50 bg-slate-900/90 border border-amber-500/40 p-3 rounded-xl backdrop-blur-md shadow-2xl w-48 pointer-events-none animate-fade-in"
          style={{ left: '50%', top: '50%', transform: `translate(-50%, -180%)` }}
        >
          <h3 className="text-amber-500 font-cinzel font-bold text-xs tracking-widest uppercase mb-1">{hoveredDeity.name}</h3>
          <p className="text-[10px] text-slate-300 italic leading-tight">{hoveredDeity.description}</p>
        </div>
      )}
      
      <svg 
        viewBox={`0 0 ${size} ${size}`} 
        className={`w-full h-full drop-shadow-2xl transition-all duration-150 linear ${flashAdjustment ? 'brightness-125' : ''}`}
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        {/* Outer Sacred Grid */}
        <circle cx={center} cy={center} r={radius + 10} fill="none" stroke={MANDALA_COLORS.primary} strokeWidth="0.5" strokeDasharray="1 10" className="opacity-20" />

        {/* Alignment Ring */}
        {isCalibrating && (
          <circle cx={center} cy={center} r={radius + 15} fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 4" className="animate-magnetic-pulse" />
        )}

        <circle cx={center} cy={center} r={radius} fill="none" stroke={MANDALA_COLORS.primary} strokeWidth="2" strokeDasharray="4 2" className="opacity-40" />
        <circle cx={center} cy={center} r={radius * 0.8} fill="none" stroke={MANDALA_COLORS.secondary} strokeWidth="1" className="opacity-30" />

        {/* Chandra (Nakshatra) Marker */}
        {chandraMarker && isExpanded && (
          <g className="animate-chandra-glow transition-all duration-1000">
             <circle cx={chandraMarker.x} cy={chandraMarker.y} r={10} fill="#1e3a8a" className="opacity-40" />
             <text 
              x={chandraMarker.x} 
              y={chandraMarker.y + 4} 
              fill="#93c5fd" 
              textAnchor="middle" 
              className="text-[14px] font-bold"
              style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: `${chandraMarker.x}px ${chandraMarker.y}px` }}
             >
              🌙
             </text>
             <circle cx={chandraMarker.x} cy={chandraMarker.y} r={12} fill="none" stroke="#60a5fa" strokeWidth="1" strokeDasharray="2 2" />
          </g>
        )}

        {/* Directions */}
        {DIRECTIONS.map((dir) => {
          const angleRad = (dir.angle * Math.PI) / 180;
          const x = center + radius * Math.cos(angleRad);
          const y = center + radius * Math.sin(angleRad);
          const lx = center + (radius + 35) * Math.cos(angleRad);
          const ly = center + (radius + 35) * Math.sin(angleRad);
          const isActive = activeDeityName === dir.name;
          const isNorth = getDirectionAbbr(dir.angle) === 'N';

          return (
            <g key={dir.name} onClick={() => handleLocalClick(dir)} onMouseEnter={() => setHoveredDeity(dir)} onMouseLeave={() => setHoveredDeity(null)} className="cursor-pointer group">
              <line x1={center} y1={center} x2={x} y2={y} stroke={isActive ? MANDALA_COLORS.secondary : MANDALA_COLORS.primary} strokeWidth={isActive ? "2" : "1"} className="opacity-40 group-hover:opacity-100 transition-opacity" />
              {isExpanded && (
                <text x={lx} y={ly + 5} fill={isNorth ? MANDALA_COLORS.secondary : MANDALA_COLORS.primary} textAnchor="middle" className="text-sm font-cinzel font-bold pointer-events-none" style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: `${lx}px ${ly}px` }}>{getDirectionAbbr(dir.angle)}</text>
              )}
              <circle cx={x} cy={y} r={isExpanded ? (isActive ? 18 : 14) : 4} fill={isActive ? MANDALA_COLORS.primary : MANDALA_COLORS.bg} stroke={isActive ? "#fff" : MANDALA_COLORS.primary} strokeWidth="2" className="transition-all duration-300" />
            </g>
          );
        })}

        {/* Center Pointer (User Current Dynamic Position) */}
        <circle cx={center} cy={center} r={5} fill="white" className="animate-pulse shadow-xl" />

        {/* Established Spatial Point 'X' */}
        {markedLocation && (
            <g className="transition-all duration-700 ease-out" style={{ transform: `translate(${relativeXMarker.x - center}px, ${relativeXMarker.y - center}px)` }}>
               <circle cx={center} cy={center} r={isExpanded ? 18 : 10} fill={MANDALA_COLORS.secondary} className="animate-x-glow opacity-90" />
               <text x={center} y={center + 4} fill="white" textAnchor="middle" className="text-xs font-bold pointer-events-none" style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: `${center}px ${center}px` }}>X</text>
               {isExpanded && relativeXMarker.distance > 2 && (
                 <text x={center} y={center + 28} fill={MANDALA_COLORS.secondary} textAnchor="middle" className="text-[10px] font-bold uppercase tracking-widest bg-black/40 px-1 rounded shadow-lg" style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: `${center}px ${center}px` }}>{Math.round(relativeXMarker.distance)}m Away</text>
               )}
            </g>
        )}
      </svg>
    </div>
  );
};

export default MandalaDisplay;
