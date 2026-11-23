import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { OverviewResponse, StationDetailPayload } from '../types/hydrology';
import {
  getDanubeOverview,
  getStationDetail,
  setHydrologyHttpTransport,
  type HydrologyHttpTransport,
} from './hydrologyEngine';

const OVERVIEW_STORAGE_KEY = 'hidrodunare_last_overview_v1';
let nativeTransportInitialized = false;

function decodeBase64ToLatin1(b64: string): string {
  const cleaned = b64.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('latin1').decode(bytes);
}

const capacitorNativeTransport: HydrologyHttpTransport = {
  async getJson<T>(url: string, timeoutMs: number): Promise<T | null> {
    const res = await CapacitorHttp.get({
      url,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
      responseType: 'json',
      headers: {
        Accept: 'application/json',
      },
    });
    if (res.status < 200 || res.status >= 300) return null;
    if (typeof res.data === 'string') {
      try {
        return JSON.parse(res.data) as T;
      } catch {
        return null;
      }
    }
    return (res.data ?? null) as T | null;
  },
  async getText(url: string, timeoutMs: number, encoding: 'utf-8' | 'latin1' = 'utf-8'): Promise<string | null> {
    const res = await CapacitorHttp.get({
      url,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
      responseType: encoding === 'latin1' ? 'arraybuffer' : 'text',
    });
    if (res.status < 200 || res.status >= 300) return null;
    if (res.data == null) return null;
    if (encoding === 'latin1' && typeof res.data === 'string') {
      try {
        return decodeBase64ToLatin1(res.data);
      } catch {
        return res.data;
      }
    }
    return typeof res.data === 'string' ? res.data : String(res.data);
  },
};

export function isStandaloneNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (!Capacitor.isNativePlatform()) return false;
  const host = window.location.hostname;
  const proto = window.location.protocol;
  return host === 'localhost' || host === '127.0.0.1' || proto === 'capacitor:' || proto === 'file:';
}

function ensureNativeTransport(): void {
  if (Capacitor.isNativePlatform() && !nativeTransportInitialized) {
    setHydrologyHttpTransport(capacitorNativeTransport);
    nativeTransportInitialized = true;
  }
}

function saveOverviewCache(data: OverviewResponse): void {
  try {
    localStorage.setItem(OVERVIEW_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

function loadOverviewCache(): OverviewResponse | null {
  try {
    const raw = localStorage.getItem(OVERVIEW_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OverviewResponse;
    return Array.isArray(parsed.stations) && parsed.stations.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

async function fetchJsonIfBackendAvailable<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return null;
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return null;
  }
  return (await res.json()) as T;
}

export async function fetchOverviewData(forceRefresh = false): Promise<OverviewResponse> {
  if (isStandaloneNativeApp()) {
    ensureNativeTransport();
    try {
      const data = await getDanubeOverview(forceRefresh);
      if (data.stations.length > 0) {
        saveOverviewCache(data);
        return data;
      }
      const cached = loadOverviewCache();
      if (cached) return cached;
      throw new Error('Nu s-au putut încărca datele oficiale. Verificați conexiunea la internet.');
    } catch (err) {
      const cached = loadOverviewCache();
      if (cached) return cached;
      throw err;
    }
  }

  // Web / PWA or remote-hosted backend mode
  try {
    const backendData = await fetchJsonIfBackendAvailable<OverviewResponse>(
      `/api/overview${forceRefresh ? '?refresh=1' : ''}`,
    );
    if (backendData) {
      saveOverviewCache(backendData);
      return backendData;
    }
  } catch {
    // Fall through to direct mode / cache
  }

  // Fallback if hosted statically without Express backend
  ensureNativeTransport();
  try {
    const directData = await getDanubeOverview(forceRefresh);
    if (directData.stations.length > 0) {
      saveOverviewCache(directData);
      return directData;
    }
  } catch {
    // Fall through to cached snapshot
  }

  const cached = loadOverviewCache();
  if (cached) return cached;

  throw new Error('Nu s-a putut stabili conexiunea cu sursele hidrologice oficiale.');
}

export async function fetchStationDetailData(stationId: string): Promise<StationDetailPayload | null> {
  if (!stationId) return null;

  if (isStandaloneNativeApp()) {
    ensureNativeTransport();
    return await getStationDetail(stationId);
  }

  try {
    const backendDetail = await fetchJsonIfBackendAvailable<StationDetailPayload>(
      `/api/stations/${encodeURIComponent(stationId)}`,
    );
    if (backendDetail) return backendDetail;
  } catch {
    // Fall through to direct mode
  }

  ensureNativeTransport();
  return await getStationDetail(stationId);
}
