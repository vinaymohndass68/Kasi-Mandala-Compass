
export interface Coordinate {
  lat: number;
  lng: number;
}

export interface DeityInfo {
  name: string;
  direction: string;
  angle: number;
  description: string;
  element: string;
  shakti: string;
  mantra: string;
}

export interface NakshatraInfo {
  name: string;
  angle: number;
  significance: string;
}

export type HeadingSource = 'sensor' | 'gps' | 'manual';

export interface MeditationTimer {
  duration: number; // in seconds
  timeLeft: number;
  isActive: boolean;
  associatedDeity?: DeityInfo;
}

export interface SavedLocation {
  id: string;
  timestamp: number;
  coords: Coordinate;
  heading: number;
  landmark?: string;
  nakshatra?: string;
}

export interface AppState {
  markedLocation: Coordinate | null;
  currentHeading: number;
  calibrationOffset: number;
  isMandalaExpanded: boolean;
  statusMessage: string;
  headingSource: HeadingSource;
}
