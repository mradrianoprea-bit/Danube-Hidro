import { BASIN_ZONES_META, DANUBE_STATIONS_META, type StationMeta } from '../data/danubeStationsMeta.ts';
import type {
  BasinPrecipitationZone,
  BasinZoneId,
  DanubeStation,
  ForecastPoint,
  HistoricalPoint,
  MonthlyClimatologyPoint,
  OverviewResponse,
  PushAlertItem,
  StationDetailPayload,
  StationStatus,
} from '../types/hydrology.ts';

interface ParsedHydroinfoRow {
  code: string;
  name: string;
  yesterdayMorningCm: number | null;
  yesterdayEveningCm: number | null;
  todayMorningCm: number | null;
  change24hCm: number | null;
  dischargeM3s: number | null;
  waterTempC: number | null;
  iceCondition: string | null;
}

interface PegelStationRaw {
  uuid: string;
  shortname: string;
  km?: number;
  latitude?: number;
  longitude?: number;
  timeseries?: Array<{
    shortname: string;
    unit: string;
    currentMeasurement?: {
      timestamp: string;
      value: number;
    };
  }>;
}

interface GlofasBaselineStats {
  todayDischarge: number;
  mean10Yr: number;
  p05_10Yr: number;
  p95_10Yr: number;
  forecast14dDates: string[];
  forecast14dDischarge: number[];
  monthlyMeans: Array<{ month: string; meanQ: number; minQ: number; maxQ: number }>;
  history30d: Array<{ date: string; q: number }>;
}

const OVERVIEW_CACHE_TTL_MS = 15 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 15 * 60 * 1000;

export interface HydrologyHttpTransport {
  getJson<T>(url: string, timeoutMs: number): Promise<T | null>;
  getText(url: string, timeoutMs: number, encoding?: 'utf-8' | 'latin1'): Promise<string | null>;
}

function createTimeoutFetchOptions(timeoutMs: number): { signal?: AbortSignal; cleanup: () => void } {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return { signal: AbortSignal.timeout(timeoutMs), cleanup: () => {} };
  }
  if (typeof AbortController !== 'undefined') {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
  }
  return { cleanup: () => {} };
}

const defaultHttpTransport: HydrologyHttpTransport = {
  async getJson<T>(url: string, timeoutMs: number): Promise<T | null> {
    const { signal, cleanup } = createTimeoutFetchOptions(timeoutMs);
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } finally {
      cleanup();
    }
  },
  async getText(url: string, timeoutMs: number, encoding: 'utf-8' | 'latin1' = 'utf-8'): Promise<string | null> {
    const { signal, cleanup } = createTimeoutFetchOptions(timeoutMs);
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) return null;
      if (encoding === 'latin1') {
        const buf = await res.arrayBuffer();
        return new TextDecoder('latin1').decode(buf);
      }
      return await res.text();
    } finally {
      cleanup();
    }
  },
};

let activeHttpTransport: HydrologyHttpTransport = defaultHttpTransport;

export function setHydrologyHttpTransport(transport: HydrologyHttpTransport): void {
  activeHttpTransport = transport;
}

let overviewCache: { timestamp: number; data: OverviewResponse; glofasZones: Map<BasinZoneId, GlofasBaselineStats> } | null = null;
const stationGlofasCache = new Map<string, { timestamp: number; stats: GlofasBaselineStats }>();
const channelSnapCache = new Map<string, { lat: number; lon: number }>();

function minPlausibleDanubeDischarge(km: number): number {
  if (km >= 2250) return 120; // Ingolstadt – Vilshofen (above Inn confluence)
  if (km >= 1880) return 450; // Passau – Vienna (after Inn)
  if (km >= 1400) return 650; // Bratislava – Mohács
  if (km >= 1170) return 850; // Bezdan – Novi Sad (after Drava)
  return 1200; // Belgrade / Iron Gates – Sulina (after Sava & Tisza)
}

async function resolveDanubeChannelCoords(
  lat: number,
  lon: number,
  cacheKey: string,
  km: number,
): Promise<{ lat: number; lon: number } | null> {
  const cached = channelSnapCache.get(cacheKey);
  if (cached) return cached;

  // Query a 5x5 grid (±0.15°, ~15 km) in one fast request to snap onto the
  // Copernicus GloFAS 0.05° routed Danube main channel (critical around split
  // branches such as Călărași/Borcea, Cernavodă, Hârșova, Brăila, and Tulcea).
  const offsets = [-0.15, -0.075, 0, 0.075, 0.15];
  const grid: Array<[number, number]> = [];
  for (const dLat of offsets) {
    for (const dLon of offsets) {
      grid.push([Number((lat + dLat).toFixed(4)), Number((lon + dLon).toFixed(4))]);
    }
  }

  const lats = grid.map((p) => p[0]).join(',');
  const lons = grid.map((p) => p[1]).join(',');
  const probeUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${lats}&longitude=${lons}&daily=river_discharge&forecast_days=1`;

  try {
    const arr = await activeHttpTransport.getJson<Array<{ daily?: { river_discharge?: Array<number | null> } }>>(
      probeUrl,
      8000,
    );
    if (!arr || !Array.isArray(arr)) return null;
    const minQ = minPlausibleDanubeDischarge(km);

    let bestIdx = -1;
    let bestScore = -1;

    arr.forEach((item, idx) => {
      const q = item?.daily?.river_discharge?.[0] ?? 0;
      if (!Number.isFinite(q) || q <= 0) return;
      // Prefer the highest-discharge main-channel cell, with slight distance tie-breaker
      const distDeg = Math.hypot(grid[idx][0] - lat, grid[idx][1] - lon);
      const score = q - distDeg * 120;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0) {
      const bestQ = arr[bestIdx]?.daily?.river_discharge?.[0] ?? 0;
      if (bestQ >= minQ) {
        const snapped = { lat: grid[bestIdx][0], lon: grid[bestIdx][1] };
        channelSnapCache.set(cacheKey, snapped);
        return snapped;
      }
    }
  } catch (err) {
    console.warn(`GloFAS channel snap (${cacheKey}) warning:`, err instanceof Error ? err.message : err);
  }

  return null;
}

function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    '&aacute;': 'á',
    '&eacute;': 'é',
    '&iacute;': 'í',
    '&oacute;': 'ó',
    '&uacute;': 'ú',
    '&ucirc;': 'û',
    '&Ucirc;': 'Û',
    '&ouml;': 'ö',
    '&Ouml;': 'Ö',
    '&uuml;': 'ü',
    '&Uuml;': 'Ü',
    '&scaron;': 'š',
    '&Scaron;': 'Š',
    '&amp;': '&',
  };
  let s = input;
  for (const [k, v] of Object.entries(named)) {
    s = s.split(k).join(v);
  }
  s = s.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)));
  return s;
}

function parseNumericCell(raw: string): number | null {
  const cleaned = raw.trim();
  if (!cleaned || cleaned === '//' || cleaned === '-' || cleaned === '---') return null;
  const n = Number(cleaned.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function fetchHydroinfoDanube(): Promise<{
  observedDateLabel: string;
  rows: Map<string, ParsedHydroinfoRow>;
  live: boolean;
}> {
  const rows = new Map<string, ParsedHydroinfoRow>();
  let observedDateLabel = new Date().toISOString().slice(0, 10);
  let live = false;

  try {
    const [hText, html] = await Promise.all([
      activeHttpTransport.getText('https://www.hydroinfo.hu/tables/ENG/dunhid_f.html', 9000, 'utf-8'),
      activeHttpTransport.getText('https://www.hydroinfo.hu/tables/ENG/dunhif_a.html', 10000, 'latin1'),
    ]);

    if (hText) {
      const dateMatch = hText.match(/Observed on:\s*([^<\n]+)/i);
      if (dateMatch?.[1]) {
        observedDateLabel = dateMatch[1].replace(/\s+/g, ' ').trim();
      }
    }

    if (html) {
      const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

      for (const tr of trMatches) {
        const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
          decodeHtmlEntities(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
        );
        if (tds.length < 7) continue;
        const code = tds[0];
        const name = tds[1];
        const river = tds[2];
        if (!/^\d{6}$/.test(code) || !/^Danube$/i.test(river)) continue;

        rows.set(code, {
          code,
          name,
          yesterdayMorningCm: parseNumericCell(tds[3]),
          yesterdayEveningCm: parseNumericCell(tds[4]),
          todayMorningCm: parseNumericCell(tds[5]),
          change24hCm: parseNumericCell(tds[6]),
          dischargeM3s: parseNumericCell(tds[7] ?? ''),
          waterTempC: parseNumericCell(tds[8] ?? ''),
          iceCondition: tds[9] && tds[9] !== '//' ? tds[9] : null,
        });
      }
      if (rows.size > 20) live = true;
    }
  } catch (err) {
    console.warn('Hydroinfo fetch warning:', err instanceof Error ? err.message : err);
  }

  return { observedDateLabel, rows, live };
}

async function fetchPegelonlineDanube(): Promise<{ stations: Map<string, PegelStationRaw>; live: boolean }> {
  const map = new Map<string, PegelStationRaw>();
  let live = false;
  try {
    const data = await activeHttpTransport.getJson<PegelStationRaw[]>(
      'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json?waters=DONAU&includeTimeseries=true&includeCurrentMeasurement=true',
      9000,
    );
    if (Array.isArray(data)) {
      for (const st of data) {
        map.set(st.shortname.toLowerCase(), st);
      }
      if (map.size > 0) live = true;
    }
  } catch (err) {
    console.warn('Pegelonline fetch warning:', err instanceof Error ? err.message : err);
  }
  return { stations: map, live };
}

async function fetchBasinPrecipitation14d(): Promise<BasinPrecipitationZone[]> {
  const lats = BASIN_ZONES_META.map((z) => z.lat).join(',');
  const lons = BASIN_ZONES_META.map((z) => z.lon).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&daily=precipitation_sum&forecast_days=14&timezone=UTC`;

  try {
    const json = await activeHttpTransport.getJson<
      | Array<{ daily: { time: string[]; precipitation_sum: Array<number | null> } }>
      | { daily: { time: string[]; precipitation_sum: Array<number | null> } }
    >(url, 10000);
    if (json) {
      const arr = Array.isArray(json) ? json : [json];

      return BASIN_ZONES_META.map((meta, idx) => {
        const entry = arr[idx]?.daily;
        const times = entry?.time ?? [];
        const precips = entry?.precipitation_sum ?? [];
        const daily = times.map((date, i) => ({
          date,
          precipitationMm: Number((precips[i] ?? 0).toFixed(1)),
        }));
        const total14dMm = Number(daily.reduce((sum, d) => sum + d.precipitationMm, 0).toFixed(1));
        const maxDailyMm = Number(Math.max(0, ...daily.map((d) => d.precipitationMm)).toFixed(1));
        return {
          ...meta,
          total14dMm,
          maxDailyMm,
          daily,
        };
      });
    }
  } catch (err) {
    console.warn('Open-Meteo precipitation fetch warning:', err instanceof Error ? err.message : err);
  }

  // Fallback empty structure if offline
  const today = new Date();
  return BASIN_ZONES_META.map((meta) => ({
    ...meta,
    total14dMm: 0,
    maxDailyMm: 0,
    daily: Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today.getTime() + i * 86400000);
      return { date: d.toISOString().slice(0, 10), precipitationMm: 0 };
    }),
  }));
}

function summarizeGlofasSeries(
  histDates: string[],
  histQ: Array<number | null>,
  fcDates: string[],
  fcQ: Array<number | null>,
): GlofasBaselineStats {
  const validHist = histQ.filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);
  const sorted = [...validHist].sort((a, b) => a - b);
  const mean10Yr = validHist.length > 0 ? validHist.reduce((s, v) => s + v, 0) / validHist.length : 3500;
  const p05_10Yr = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.05)] : mean10Yr * 0.5;
  const p95_10Yr = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : mean10Yr * 1.85;

  const monthBuckets = Array.from({ length: 12 }, () => [] as number[]);
  for (let i = 0; i < histDates.length; i++) {
    const val = histQ[i];
    if (val === null || !Number.isFinite(val)) continue;
    const m = Number(histDates[i].slice(5, 7)) - 1;
    if (m >= 0 && m < 12) monthBuckets[m].push(val);
  }
  const monthLabels = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyMeans = monthBuckets.map((vals, idx) => {
    const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : mean10Yr;
    const min = vals.length > 0 ? Math.min(...vals) : mean10Yr * 0.5;
    const max = vals.length > 0 ? Math.max(...vals) : mean10Yr * 1.8;
    return { month: monthLabels[idx], meanQ: avg, minQ: min, maxQ: max };
  });

  const cleanFc = fcQ.map((v) => (v !== null && Number.isFinite(v) ? v : mean10Yr * 0.65));
  const todayDischarge = cleanFc[0] ?? mean10Yr * 0.65;

  // Last 30 days from historical + forecast overlap
  const history30d: Array<{ date: string; q: number }> = [];
  const startIdx = Math.max(0, histDates.length - 30);
  for (let i = startIdx; i < histDates.length; i++) {
    const q = histQ[i];
    if (q !== null && Number.isFinite(q)) {
      history30d.push({ date: histDates[i], q });
    }
  }

  return {
    todayDischarge,
    mean10Yr,
    p05_10Yr,
    p95_10Yr,
    forecast14dDates: fcDates,
    forecast14dDischarge: cleanFc,
    monthlyMeans,
    history30d,
  };
}

async function fetchGlofasForZoneAnchors(): Promise<Map<BasinZoneId, GlofasBaselineStats>> {
  const result = new Map<BasinZoneId, GlofasBaselineStats>();
  const lats = BASIN_ZONES_META.map((z) => z.lat).join(',');
  const lons = BASIN_ZONES_META.map((z) => z.lon).join(',');

  const endHist = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const startHist = '2016-01-01';

  const histUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${lats}&longitude=${lons}&daily=river_discharge&start_date=${startHist}&end_date=${endHist}`;
  const fcUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${lats}&longitude=${lons}&daily=river_discharge&forecast_days=14&past_days=30`;

  try {
    const [histJson, fcJson] = await Promise.all([
      activeHttpTransport.getJson<Array<{ daily: { time: string[]; river_discharge: Array<number | null> } }>>(
        histUrl,
        14000,
      ),
      activeHttpTransport.getJson<Array<{ daily: { time: string[]; river_discharge: Array<number | null> } }>>(
        fcUrl,
        10000,
      ),
    ]);

    if (Array.isArray(histJson) && Array.isArray(fcJson)) {

      BASIN_ZONES_META.forEach((zone, idx) => {
        const h = histJson[idx]?.daily;
        const f = fcJson[idx]?.daily;
        if (h && f) {
          // Split f into past 30 days and forecast 14 days (starting today)
          const todayIso = new Date().toISOString().slice(0, 10);
          let splitIdx = f.time.findIndex((t) => t >= todayIso);
          if (splitIdx < 0) splitIdx = Math.max(0, f.time.length - 14);
          const recentDates = f.time.slice(0, splitIdx);
          const recentQ = f.river_discharge.slice(0, splitIdx);
          const fcDates = f.time.slice(splitIdx, splitIdx + 14);
          const fcQ = f.river_discharge.slice(splitIdx, splitIdx + 14);

          const stats = summarizeGlofasSeries(h.time, h.river_discharge, fcDates, fcQ);
          stats.history30d = recentDates.map((date, i) => ({
            date,
            q: recentQ[i] ?? stats.todayDischarge,
          }));
          result.set(zone.id, stats);
        }
      });
    }
  } catch (err) {
    console.warn('GloFAS batch zone fetch warning:', err instanceof Error ? err.message : err);
  }

  return result;
}

async function fetchGlofasForSingleStation(
  lat: number,
  lon: number,
  cacheKey: string,
  km: number,
): Promise<GlofasBaselineStats | null> {
  const cached = stationGlofasCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < DETAIL_CACHE_TTL_MS) {
    return cached.stats;
  }

  const snapped = await resolveDanubeChannelCoords(lat, lon, cacheKey, km);
  if (!snapped) {
    return null;
  }

  const endHist = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const startHist = '2016-01-01';
  const histUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${snapped.lat}&longitude=${snapped.lon}&daily=river_discharge&start_date=${startHist}&end_date=${endHist}`;
  const fcUrl = `https://flood-api.open-meteo.com/v1/flood?latitude=${snapped.lat}&longitude=${snapped.lon}&daily=river_discharge&forecast_days=14&past_days=30`;

  try {
    const [histJson, fcJson] = await Promise.all([
      activeHttpTransport.getJson<{ daily: { time: string[]; river_discharge: Array<number | null> } }>(histUrl, 12000),
      activeHttpTransport.getJson<{ daily: { time: string[]; river_discharge: Array<number | null> } }>(fcUrl, 10000),
    ]);

    if (histJson?.daily && fcJson?.daily) {

      const todayIso = new Date().toISOString().slice(0, 10);
      let splitIdx = fcJson.daily.time.findIndex((t) => t >= todayIso);
      if (splitIdx < 0) splitIdx = Math.max(0, fcJson.daily.time.length - 14);
      const recentDates = fcJson.daily.time.slice(0, splitIdx);
      const recentQ = fcJson.daily.river_discharge.slice(0, splitIdx);
      const fcDates = fcJson.daily.time.slice(splitIdx, splitIdx + 14);
      const fcQ = fcJson.daily.river_discharge.slice(splitIdx, splitIdx + 14);

      const stats = summarizeGlofasSeries(histJson.daily.time, histJson.daily.river_discharge, fcDates, fcQ);
      const minQ = minPlausibleDanubeDischarge(km);
      if (stats.todayDischarge < minQ || stats.mean10Yr < minQ) {
        return null;
      }

      stats.history30d = recentDates.map((date, i) => ({
        date,
        q: recentQ[i] ?? stats.todayDischarge,
      }));
      stationGlofasCache.set(cacheKey, { timestamp: Date.now(), stats });
      return stats;
    }
  } catch (err) {
    console.warn(`GloFAS single station (${cacheKey}) warning:`, err instanceof Error ? err.message : err);
  }
  return null;
}

function computeStatus(
  currentCm: number,
  thresholds: { ca: number | null; ci: number | null; cp: number | null },
  tenYearAvgCm: number,
): StationStatus {
  if (thresholds.cp !== null && currentCm >= thresholds.cp) return 'danger';
  if (thresholds.ci !== null && currentCm >= thresholds.ci) return 'flood';
  if (thresholds.ca !== null && currentCm >= thresholds.ca) return 'attention';
  if (currentCm < tenYearAvgCm - 10) return 'below_avg';
  return 'nominal';
}

function buildStationForecasts(
  meta: StationMeta,
  currentCm: number,
  change24hCm: number,
  glofas: GlofasBaselineStats,
  basinZones: BasinPrecipitationZone[],
): { forecast3d: ForecastPoint[]; forecast14d: ForecastPoint[] } {
  const localZone = basinZones.find((z) => z.id === meta.basinZoneId) ?? basinZones[0];
  const zoneOrder: BasinZoneId[] = [
    'upper_de_at',
    'pannonian_sk_hu',
    'drava_sava_tisza',
    'iron_gates_west',
    'lower_ro_bg',
    'delta_siret_prut',
  ];
  const myZoneIdx = zoneOrder.indexOf(meta.basinZoneId);
  const upstreamZones = basinZones.filter((z) => zoneOrder.indexOf(z.id) <= myZoneIdx);

  const forecast14d: ForecastPoint[] = [];
  const baseQ = glofas.todayDischarge > 0 ? glofas.todayDischarge : glofas.mean10Yr;

  for (let day = 0; day < 14; day++) {
    const date =
      glofas.forecast14dDates[day] ??
      new Date(Date.now() + (day + 1) * 86400000).toISOString().slice(0, 10);
    const qDay = glofas.forecast14dDischarge[day] ?? baseQ;

    // 1) GloFAS discharge delta mapped via hydraulic sensitivity
    const qDelta = qDay - baseQ;
    const glofasStageDelta = (qDelta / 1000) * meta.stageSensitivityCmPer1000M3s;

    // 2) Short-term 24h momentum decay (days 0..2)
    const momentumFactor = day === 0 ? 0.55 : day === 1 ? 0.35 : day === 2 ? 0.15 : 0;
    const momentumDelta = change24hCm * momentumFactor;

    // 3) Upstream & local precipitation runoff coupling (delayed hydrological routing)
    let routedPrecipMm = 0;
    for (const uz of upstreamZones) {
      const zIdx = zoneOrder.indexOf(uz.id);
      const travelDays = Math.max(0, Math.min(8, (myZoneIdx - zIdx) * 2));
      const rainDayIdx = Math.max(0, day - travelDays);
      const pVal = uz.daily[rainDayIdx]?.precipitationMm ?? 0;
      const weight = uz.id === meta.basinZoneId ? 1.0 : 0.65 / Math.max(1, myZoneIdx - zIdx + 1);
      routedPrecipMm += pVal * weight;
    }
    const localPrecipMm = localZone?.daily[day]?.precipitationMm ?? 0;
    // Precipitation runoff amplification (beyond GloFAS baseline trend)
    const precipRunoffCm = routedPrecipMm * 0.42;

    const predictedCm = Math.round(currentCm + glofasStageDelta + momentumDelta + precipRunoffCm);
    const uncertaintyCm = Math.round(8 + day * 3.8);

    forecast14d.push({
      date,
      predictedCm,
      minCm: predictedCm - uncertaintyCm,
      maxCm: predictedCm + uncertaintyCm,
      dischargeM3s: Math.round(qDay),
      localPrecipMm: Number(localPrecipMm.toFixed(1)),
      upstreamBasinPrecipMm: Number(routedPrecipMm.toFixed(1)),
      horizon: day < 3 ? 'short_3d' : 'long_14d',
    });
  }

  return {
    forecast3d: forecast14d.slice(0, 3),
    forecast14d,
  };
}

function evaluateAlerts(stations: DanubeStation[]): PushAlertItem[] {
  const alerts: PushAlertItem[] = [];
  const nowIso = new Date().toISOString();

  for (const st of stations) {
    if (st.thresholds.cp !== null && st.currentLevelCm >= st.thresholds.cp) {
      alerts.push({
        id: `${st.id}-cp`,
        stationId: st.id,
        stationName: st.name,
        country: st.country,
        km: st.km,
        type: 'flood_cp',
        severity: 'critical',
        currentLevelCm: st.currentLevelCm,
        referenceCm: st.thresholds.cp,
        deltaCm: st.currentLevelCm - st.thresholds.cp,
        message: `${st.name} (km ${st.km}): Cota curentă ${st.currentLevelCm} cm depășește Cota de Pericol (${st.thresholds.cp} cm) cu +${st.currentLevelCm - st.thresholds.cp} cm.`,
        timestamp: nowIso,
      });
    } else if (st.thresholds.ci !== null && st.currentLevelCm >= st.thresholds.ci) {
      alerts.push({
        id: `${st.id}-ci`,
        stationId: st.id,
        stationName: st.name,
        country: st.country,
        km: st.km,
        type: 'flood_ci',
        severity: 'high',
        currentLevelCm: st.currentLevelCm,
        referenceCm: st.thresholds.ci,
        deltaCm: st.currentLevelCm - st.thresholds.ci,
        message: `${st.name} (km ${st.km}): Cota curentă ${st.currentLevelCm} cm depășește Cota de Inundație (${st.thresholds.ci} cm) cu +${st.currentLevelCm - st.thresholds.ci} cm.`,
        timestamp: nowIso,
      });
    } else if (st.thresholds.ca !== null && st.currentLevelCm >= st.thresholds.ca) {
      alerts.push({
        id: `${st.id}-ca`,
        stationId: st.id,
        stationName: st.name,
        country: st.country,
        km: st.km,
        type: 'flood_ca',
        severity: 'warning',
        currentLevelCm: st.currentLevelCm,
        referenceCm: st.thresholds.ca,
        deltaCm: st.currentLevelCm - st.thresholds.ca,
        message: `${st.name} (km ${st.km}): Cota curentă ${st.currentLevelCm} cm depășește Cota de Atenție (${st.thresholds.ca} cm).`,
        timestamp: nowIso,
      });
    }
  }

  // Sort: critical flood first, then high, warning, then largest negative deviation
  const rank: Record<PushAlertItem['severity'], number> = {
    critical: 0,
    high: 1,
    warning: 2,
    info: 3,
  };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || Math.abs(b.deltaCm) - Math.abs(a.deltaCm));
}

export async function getDanubeOverview(forceRefresh = false): Promise<OverviewResponse> {
  if (!forceRefresh && overviewCache && Date.now() - overviewCache.timestamp < OVERVIEW_CACHE_TTL_MS) {
    return overviewCache.data;
  }

  const [hydroinfo, pegel, basinZones, glofasZones] = await Promise.all([
    fetchHydroinfoDanube(),
    fetchPegelonlineDanube(),
    fetchBasinPrecipitation14d(),
    fetchGlofasForZoneAnchors(),
  ]);

  const stations: DanubeStation[] = [];

  for (const meta of DANUBE_STATIONS_META) {
    const hRow = hydroinfo.rows.get(meta.code);
    let pegelMatch: PegelStationRaw | undefined;
    for (const key of meta.matchKeys) {
      for (const [pKey, pVal] of pegel.stations.entries()) {
        if (pKey.includes(key) && (pVal.km === undefined || Math.abs(pVal.km - meta.km) < 6)) {
          pegelMatch = pVal;
          break;
        }
      }
      if (pegelMatch) break;
    }

    const pegelLevel = pegelMatch?.timeseries?.find((t) => t.shortname === 'W')?.currentMeasurement?.value;
    const pegelTs = pegelMatch?.timeseries?.find((t) => t.shortname === 'W')?.currentMeasurement?.timestamp;

    // Prefer Hydroinfo morning reading for unified daily datum; fallback to Pegelonline if missing
    const currentLevelCm =
      hRow?.todayMorningCm ??
      (pegelLevel !== undefined ? Math.round(pegelLevel) : hRow?.yesterdayMorningCm ?? null);

    if (currentLevelCm === null) continue;

    const change24hCm =
      hRow?.change24hCm ??
      (hRow?.yesterdayMorningCm !== null && hRow?.yesterdayMorningCm !== undefined
        ? currentLevelCm - hRow.yesterdayMorningCm
        : 0);

    const glofas = glofasZones.get(meta.basinZoneId) ?? {
      todayDischarge: hRow?.dischargeM3s ?? 3200,
      mean10Yr: 4500,
      p05_10Yr: 2100,
      p95_10Yr: 8200,
      forecast14dDates: [],
      forecast14dDischarge: [],
      monthlyMeans: [],
      history30d: [],
    };

    const tenYearAvgCm = Math.round(
      currentLevelCm + ((glofas.mean10Yr - glofas.todayDischarge) / 1000) * meta.stageSensitivityCmPer1000M3s,
    );
    const tenYearMinCm = Math.round(
      currentLevelCm + ((glofas.p05_10Yr - glofas.todayDischarge) / 1000) * meta.stageSensitivityCmPer1000M3s,
    );
    const tenYearMaxCm = Math.round(
      currentLevelCm + ((glofas.p95_10Yr - glofas.todayDischarge) / 1000) * meta.stageSensitivityCmPer1000M3s,
    );
    const deviationFrom10YrCm = currentLevelCm - tenYearAvgCm;

    const { forecast3d, forecast14d } = buildStationForecasts(meta, currentLevelCm, change24hCm, glofas, basinZones);

    const status = computeStatus(currentLevelCm, meta.thresholds, tenYearAvgCm);

    stations.push({
      id: meta.code,
      code: meta.code,
      name: meta.displayName,
      country: meta.country,
      sector: meta.sector,
      basinZoneId: meta.basinZoneId,
      km: meta.km,
      lat: pegelMatch?.latitude ?? meta.lat,
      lon: pegelMatch?.longitude ?? meta.lon,
      agency: meta.agency,
      sourceUrl: pegelMatch && !hRow ? 'https://www.pegelonline.wsv.de' : 'https://www.hydroinfo.hu/en/hidinfo/duna.html',
      currentLevelCm,
      yesterdayMorningCm: hRow?.yesterdayMorningCm ?? null,
      yesterdayEveningCm: hRow?.yesterdayEveningCm ?? null,
      change24hCm,
      dischargeM3s: hRow?.dischargeM3s ?? null,
      glofasDischargeM3s: Math.round(glofas.todayDischarge),
      waterTempC: hRow?.waterTempC ?? null,
      iceCondition: hRow?.iceCondition ?? null,
      thresholds: meta.thresholds,
      tenYearAvgCm,
      tenYearMinCm,
      tenYearMaxCm,
      deviationFrom10YrCm,
      forecast3dCm: forecast3d[2]?.predictedCm ?? currentLevelCm,
      forecast14dCm: forecast14d[13]?.predictedCm ?? currentLevelCm,
      status,
      observedAt: pegelTs ?? hydroinfo.observedDateLabel,
      pegelUuid: pegelMatch?.uuid,
    });
  }

  // Sort downstream from Upper Danube (highest km) to Sulina (km 0)
  stations.sort((a, b) => b.km - a.km);

  const alerts = evaluateAlerts(stations);

  const response: OverviewResponse = {
    observedDateLabel: hydroinfo.observedDateLabel,
    fetchedAt: new Date().toISOString(),
    sources: [
      {
        name: 'OVF Hydroinfo Danube Exchange (AFDJ / INHGA / RHMZ / SHMÚ)',
        authority: 'Schimb Oficial de Date Hidrologice Bazinul Dunării',
        url: 'https://www.hydroinfo.hu/en/hidinfo/duna.html',
        status: hydroinfo.live ? 'live' : 'cached',
      },
      {
        name: 'WSV / VIA DONAU Pegelonline REST API v2',
        authority: 'Wasserstraßen- und Schifffahrtsverwaltung (DE / AT)',
        url: 'https://www.pegelonline.wsv.de/',
        status: pegel.live ? 'live' : 'cached',
      },
      {
        name: 'Copernicus EMS GloFAS v4 (Reanaliză 2016–2025 & Prognoză)',
        authority: 'Centrul European ECMWF / Copernicus',
        url: 'https://flood-api.open-meteo.com/',
        status: glofasZones.size > 0 ? 'live' : 'cached',
      },
      {
        name: 'ECMWF / DWD ICON Regim Pluviometric Bazin Dunăre',
        authority: 'Serviciul Meteorologic European (14 zile)',
        url: 'https://api.open-meteo.com/',
        status: basinZones.some((b) => b.daily.length > 0) ? 'live' : 'cached',
      },
    ],
    stations,
    alerts,
    basinZones,
  };

  overviewCache = { timestamp: Date.now(), data: response, glofasZones };
  return response;
}

export async function getStationDetail(stationId: string): Promise<StationDetailPayload | null> {
  const overview = await getDanubeOverview();
  const station = overview.stations.find((s) => s.id === stationId);
  if (!station) return null;

  const meta = DANUBE_STATIONS_META.find((m) => m.code === station.code);
  if (!meta) return null;

  const exactGlofas = await fetchGlofasForSingleStation(station.lat, station.lon, station.id, station.km);
  const zoneGlofas = overviewCache?.glofasZones.get(meta.basinZoneId) ?? null;
  const glofas: GlofasBaselineStats = exactGlofas ?? zoneGlofas ?? {
    todayDischarge: station.glofasDischargeM3s,
    mean10Yr: station.glofasDischargeM3s,
    p05_10Yr: station.glofasDischargeM3s * 0.6,
    p95_10Yr: station.glofasDischargeM3s * 1.7,
    forecast14dDates: overview.basinZones[0]?.daily.map((d) => d.date) ?? [],
    forecast14dDischarge: Array(14).fill(station.glofasDischargeM3s),
    monthlyMeans: [],
    history30d: [],
  };

  // Re-calibrate exact station 10-year stats if single-point GloFAS succeeded
  let calibratedStation = station;
  if (exactGlofas) {
    const tenYearAvgCm = Math.round(
      station.currentLevelCm +
        ((exactGlofas.mean10Yr - exactGlofas.todayDischarge) / 1000) * meta.stageSensitivityCmPer1000M3s,
    );
    const tenYearMinCm = Math.round(
      station.currentLevelCm +
        ((exactGlofas.p05_10Yr - exactGlofas.todayDischarge) / 1000) * meta.stageSensitivityCmPer1000M3s,
    );
    const tenYearMaxCm = Math.round(
      station.currentLevelCm +
        ((exactGlofas.p95_10Yr - exactGlofas.todayDischarge) / 1000) * meta.stageSensitivityCmPer1000M3s,
    );
    calibratedStation = {
      ...station,
      tenYearAvgCm,
      tenYearMinCm,
      tenYearMaxCm,
      deviationFrom10YrCm: station.currentLevelCm - tenYearAvgCm,
      glofasDischargeM3s: Math.round(exactGlofas.todayDischarge),
      status: computeStatus(station.currentLevelCm, station.thresholds, tenYearAvgCm),
    };
  }

  const { forecast3d, forecast14d } = buildStationForecasts(
    meta,
    calibratedStation.currentLevelCm,
    calibratedStation.change24hCm,
    glofas,
    overview.basinZones,
  );

  // Build 30-day history (use real Pegelonline 30-day measurements if available, else Copernicus GloFAS calibrated stage)
  let history30d: HistoricalPoint[] = [];

  if (station.pegelUuid) {
    try {
      const measurements = await activeHttpTransport.getJson<Array<{ timestamp: string; value: number }>>(
        `https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/${station.pegelUuid}/W/measurements.json?start=P30D`,
        8000,
      );
      if (Array.isArray(measurements)) {
        const byDay = new Map<string, number[]>();
        for (const m of measurements) {
          const day = m.timestamp.slice(0, 10);
          const list = byDay.get(day) ?? [];
          list.push(m.value);
          byDay.set(day, list);
        }
        history30d = [...byDay.entries()].map(([date, vals]) => {
          const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
          return {
            date,
            levelCm: avg,
            dischargeM3s: calibratedStation.dischargeM3s ?? calibratedStation.glofasDischargeM3s,
            tenYearClimatologyCm: calibratedStation.tenYearAvgCm,
            source: 'pegelonline_15m' as const,
          };
        });
      }
    } catch {
      // Fallback to GloFAS 30-day history below
    }
  }

  if (history30d.length === 0) {
    history30d = glofas.history30d.map((pt) => {
      const levelCm = Math.round(
        calibratedStation.currentLevelCm +
          ((pt.q - glofas.todayDischarge) / 1000) * meta.stageSensitivityCmPer1000M3s,
      );
      return {
        date: pt.date,
        levelCm,
        dischargeM3s: Math.round(pt.q),
        tenYearClimatologyCm: calibratedStation.tenYearAvgCm,
        source: 'glofas_reanalysis' as const,
      };
    });
  }

  const monthlyClimatology10Yr: MonthlyClimatologyPoint[] = glofas.monthlyMeans.map((m) => ({
    month: m.month,
    avgCm: Math.round(
      calibratedStation.currentLevelCm +
        ((m.meanQ - glofas.todayDischarge) / 1000) * meta.stageSensitivityCmPer1000M3s,
    ),
    minCm: Math.round(
      calibratedStation.currentLevelCm +
        ((m.minQ - glofas.todayDischarge) / 1000) * meta.stageSensitivityCmPer1000M3s,
    ),
    maxCm: Math.round(
      calibratedStation.currentLevelCm +
        ((m.maxQ - glofas.todayDischarge) / 1000) * meta.stageSensitivityCmPer1000M3s,
    ),
  }));

  return {
    station: calibratedStation,
    forecast3d,
    forecast14d,
    history30d,
    monthlyClimatology10Yr,
    basinZones: overview.basinZones,
    methodologyNote:
      'Cotele curente provin din schimbul oficial de date al bazinului Dunării (OVF Hydroinfo / AFDJ Galați / INHGA / WSV Pegelonline). Media multianuală pe 10 ani (2016–2025) și prognoza la 3 și 14 zile integrează debitul modelat Copernicus GloFAS v4 cu precipitațiile ECMWF/ICON din sub-bazinele amonte.',
  };
}
