
import { GoogleGenAI, Type } from "@google/genai";

const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const CACHE_PREFIX = 'kasi_mandala_v3_';
const TTL_4HR = 1000 * 60 * 60 * 4;
const TTL_24HR = 1000 * 60 * 60 * 24;
const TTL_7DAY = 1000 * 60 * 60 * 24 * 7;

export const checkQuotaLock = () => {
  const lock = localStorage.getItem('kasi_quota_lock');
  if (lock) {
    const lockTime = parseInt(lock);
    if (Date.now() < lockTime) {
      return { isLocked: true, remaining: Math.ceil((lockTime - Date.now()) / 1000) };
    } else {
      localStorage.removeItem('kasi_quota_lock');
    }
  }
  return { isLocked: false, remaining: 0 };
};

const setQuotaLock = () => {
  localStorage.setItem('kasi_quota_lock', (Date.now() + 300000).toString()); // 5 min lock
};

const getStored = (key: string) => {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (Date.now() > parsed.expiry) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return parsed.data;
  } catch { return null; }
};

const setStored = (key: string, data: any, ttl: number) => {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, expiry: Date.now() + ttl }));
  } catch (e) { console.warn("Cache write failed", e); }
};

async function retry<T>(fn: () => Promise<T>, retries = 1, initialDelay = 3000): Promise<T> {
  let delay = initialDelay;
  for (let i = 0; i <= retries; i++) {
    const lock = checkQuotaLock();
    if (lock.isLocked) throw new Error("429 QUOTA_LOCK_ACTIVE");
    
    try {
      return await fn();
    } catch (error: any) {
      if (error?.message?.includes('429')) {
        setQuotaLock();
        if (i < retries) {
          await new Promise(r => setTimeout(r, delay));
          delay *= 2;
          continue;
        }
      }
      throw error;
    }
  }
  return await fn();
}

async function safeAiCall<T>(call: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await retry(call);
  } catch (error: any) {
    if (error?.message === "429 QUOTA_LOCK_ACTIVE") {
      console.warn("Call blocked: Quota Lock Active");
    } else {
      console.error("Gemini API Error:", error);
    }
    return fallback;
  }
}

export async function getFullDeityData(deityName: string, direction: string) {
  const cacheKey = `deity_full_${deityName}`;
  const cached = getStored(cacheKey);
  if (cached) return cached;

  const result = await safeAiCall(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Short spiritual data for ${deityName} in ${direction} of Kasi Mandala. Insight, astrology (planet/significance), myth. JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insight: { type: Type.STRING },
            astrology: {
              type: Type.OBJECT,
              properties: {
                planet: { type: Type.STRING },
                significance: { type: Type.STRING }
              },
              required: ["planet", "significance"]
            },
            myth: { type: Type.STRING }
          },
          required: ["insight", "astrology", "myth"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  }, null);

  if (result) setStored(cacheKey, result, TTL_7DAY);
  return result || {
    insight: "The cosmic energies are aligning. Meditate to connect.",
    astrology: { planet: "Navagraha", significance: "Universal influences are present." },
    myth: "The legends of Kasi are eternal."
  };
}

export async function getTodayNakshatra() {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `nak_${today}`;
  const cached = getStored(cacheKey);
  if (cached) return cached;

  const result = await safeAiCall(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Vedic Nakshatra for ${today}. JSON: name, angle(0-360), significance.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            angle: { type: Type.NUMBER },
            significance: { type: Type.STRING }
          },
          required: ["name", "angle", "significance"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  }, null);

  if (result) setStored(cacheKey, result, TTL_24HR);
  return result || { name: "Chandra", angle: 0, significance: "The lunar cycle continues." };
}

export async function getNearbyLandmark(lat: number, lng: number, heading: number) {
  const gridLat = lat.toFixed(2);
  const gridLng = lng.toFixed(2);
  const gridHeading = Math.round(heading / 20) * 20;
  const cacheKey = `lm_${gridLat}_${gridLng}_${gridHeading}`;
  const cached = getStored(cacheKey);
  if (cached) return cached;

  const result = await safeAiCall(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Perform a search to find a major sacred spiritual landmark within exactly a 25km radius of coordinates ${lat}, ${lng} in the direction of ${heading} degrees. provide its spiritual significance.`,
      config: {
        tools: [{ googleSearch: {} }]
      },
    });

    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const links = chunks.filter((c: any) => c.web).map((c: any) => ({ title: c.web.title, uri: c.web.uri }));
    return { text: response.text || "Scanning divine horizons...", links };
  }, null);

  if (result) setStored(cacheKey, result, TTL_4HR);
  return result || { text: "The horizon is currently silent.", links: [] };
}

export interface PlaceOfWorship {
  name: string;
  description: string;
  approxDistance: string;
  mapUrl: string;
}

export async function getPlacesOfWorshipList(lat: number, lng: number): Promise<PlaceOfWorship[]> {
  const gridLat = lat.toFixed(2);
  const gridLng = lng.toFixed(2);
  const cacheKey = `pl_${gridLat}_${gridLng}`;
  const cached = getStored(cacheKey);
  if (cached) return cached;

  const result = await safeAiCall(async () => {
    const ai = getAiClient();
    // Using Gemini 2.5 Flash for Google Maps Grounding as it's the best tool for local place discovery.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Search for the 15 most important sacred sites, temples, shrines, and meditation centers within exactly 25km of my location. 
      For each site, list it in this EXACT format:
      SITE: [Name] | INFO: [Short spiritual history] | DIST: [Distance in km] | LINK: [Google Maps Search URL]`,
      config: {
        tools: [{ googleMaps: {} }, { googleSearch: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: { latitude: lat, longitude: lng }
          }
        }
      },
    });

    const text = response.text || "";
    const lines = text.split('\n');
    const sites: PlaceOfWorship[] = [];

    // Robust parsing for the requested format
    for (const line of lines) {
      if (line.includes('SITE:') && line.includes('|')) {
        try {
          const parts = line.split('|');
          const name = parts[0].replace('SITE:', '').trim();
          const description = parts[1].replace('INFO:', '').trim();
          const distance = parts[2].replace('DIST:', '').trim();
          const mapUrl = parts[3].replace('LINK:', '').trim();
          
          if (name && description) {
            sites.push({ name, description, approxDistance: distance, mapUrl });
          }
        } catch (e) {
          console.warn("Failed to parse site line:", line);
        }
      }
    }

    // Secondary parsing for common list patterns if the specific format failed
    if (sites.length === 0) {
      const siteRegex = /(?:^|\n)(?:\d+\.|\*|-)\s*([^:\n|]+)(?::|\|)\s*([^(\n|]+)(?:\(([^)\n]+)\))?/g;
      let match;
      while ((match = siteRegex.exec(text)) !== null) {
        sites.push({
          name: match[1].trim(),
          description: match[2].trim(),
          approxDistance: match[3] ? match[3].trim() : "Nearby",
          mapUrl: `https://www.google.com/maps/search/${encodeURIComponent(match[1].trim())}`
        });
      }
    }

    // Fallback: If text parsing failed, try to extract from grounding chunks directly
    if (sites.length === 0) {
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      chunks.forEach((chunk: any) => {
        if (chunk.maps) {
          sites.push({
            name: chunk.maps.title || "Sacred Site",
            description: "A manifested point of worship and peace discovered in your 25km radius.",
            approxDistance: "Local",
            mapUrl: chunk.maps.uri || `https://www.google.com/maps/search/${encodeURIComponent(chunk.maps.title || 'sacred site')}`
          });
        } else if (chunk.web) {
            sites.push({
                name: chunk.web.title || "Spiritual Center",
                description: "Spiritual significance found through deep akashic scan.",
                approxDistance: "Discoverable",
                mapUrl: chunk.web.uri
            });
        }
      });
    }

    return sites;
  }, []);

  if (result && result.length > 0) {
    setStored(cacheKey, result, TTL_7DAY);
    return result;
  }
  
  return [];
}
