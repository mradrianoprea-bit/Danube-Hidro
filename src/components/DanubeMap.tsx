import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { History, Search, TrendingUp } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import type { BasinPrecipitationZone, DanubeSector, DanubeStation, StationDetailPayload } from '../types/hydrology';
import { formatSignedCm, getBasinShortName, getCountryName, getStatusPresentation } from '../utils/statusFormat';
import type { ChartMode } from './HydrographChart';

type MapSectorFilter = 'all' | 'ro' | DanubeSector;
type MapStatusFilter = 'all' | 'flood_any' | 'below_avg' | 'nominal';

interface DanubeMapProps {
  stations: DanubeStation[];
  basinZones: BasinPrecipitationZone[];
  selectedStationId: string;
  selectedDetail: StationDetailPayload | null;
  onSelectStation: (stationId: string) => void;
  onOpenDetailTab: (mode: ChartMode) => void;
}

export const DanubeMap: React.FC<DanubeMapProps> = ({
  stations,
  basinZones,
  selectedStationId,
  selectedDetail,
  onSelectStation,
  onOpenDetailTab,
}) => {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const rainGroupRef = useRef<L.LayerGroup | null>(null);
  const markersByIdRef = useRef<Map<string, L.CircleMarker>>(new Map());

  const [showRainZones, setShowRainZones] = useState(true);
  const [sectorFilter, setSectorFilter] = useState<MapSectorFilter>('all');
  const [statusFilter, setStatusFilter] = useState<MapStatusFilter>('all');
  const [mapQuery, setMapQuery] = useState('');

  const visibleStations = useMemo(() => {
    const q = mapQuery.trim().toLowerCase();
    return stations.filter((s) => {
      if (sectorFilter === 'ro' && s.country !== 'RO') return false;
      if (sectorFilter !== 'all' && sectorFilter !== 'ro' && s.sector !== sectorFilter) {
        return false;
      }
      if (
        statusFilter === 'flood_any' &&
        s.status !== 'attention' &&
        s.status !== 'flood' &&
        s.status !== 'danger'
      ) {
        return false;
      }
      if (statusFilter === 'below_avg' && s.status !== 'below_avg') return false;
      if (statusFilter === 'nominal' && s.status !== 'nominal') return false;
      if (
        q &&
        !s.name.toLowerCase().includes(q) &&
        !getCountryName(s.country, 'ro').toLowerCase().includes(q) &&
        !getCountryName(s.country, 'en').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [stations, sectorFilter, statusFilter, mapQuery]);

  const selectedStation = useMemo(
    () => stations.find((s) => s.id === selectedStationId) ?? visibleStations[0] ?? null,
    [stations, visibleStations, selectedStationId],
  );

  // Initialize Leaflet Map with OpenStreetMap (Zero API Key)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [45.6, 21.8],
      zoom: 5,
      minZoom: 4,
      maxZoom: 14,
      zoomControl: true,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    rainGroupRef.current = L.layerGroup().addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      rainGroupRef.current = null;
      markersByIdRef.current.clear();
    };
  }, []);

  // Render Danube course polyline + all filtered official monitoring markers with full interactive popups
  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();
    markersByIdRef.current.clear();

    if (stations.length > 1) {
      const allSorted = [...stations].sort((a, b) => b.km - a.km);
      const riverLatLngs: L.LatLngExpression[] = allSorted.map((s) => [s.lat, s.lon]);
      L.polyline(riverLatLngs, {
        color: '#0284C7',
        weight: 3,
        opacity: 0.65,
      }).addTo(layerGroup);
    }

    for (const st of visibleStations) {
      const isSelected = st.id === selectedStationId;
      const pres = getStatusPresentation(st.status, lang);
      const countryName = getCountryName(st.country, lang);

      const marker = L.circleMarker([st.lat, st.lon], {
        radius: isSelected ? 10 : st.country === 'RO' ? 7 : 5.5,
        color: isSelected ? '#0F172A' : '#FFFFFF',
        weight: isSelected ? 3 : 1.5,
        fillColor: pres.markerColor,
        fillOpacity: 0.95,
      });

      const deltaStr = formatSignedCm(st.change24hCm);
      const devStr = formatSignedCm(st.deviationFrom10YrCm);

      const popupEl = document.createElement('div');
      popupEl.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
      popupEl.style.minWidth = '235px';
      popupEl.innerHTML = `
        <div style="font-weight: 700; font-size: 13px; color: #0F172A;">${st.name}</div>
        <div style="font-size: 11px; color: #64748B; margin-bottom: 6px;">
          ${countryName} · km ${st.km.toFixed(1)} · ${pres.glyph} ${pres.shortLabel}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 6px 0; border-top: 1px solid #E2E8F0; border-bottom: 1px solid #E2E8F0; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #0F172A;">
          <div>
            <div style="font-size: 10px; color: #64748B;">${isEn ? 'Current level' : 'Cotă curentă'}</div>
            <strong>${st.currentLevelCm} cm</strong> <span style="color:#475569">(${deltaStr})</span>
          </div>
          <div>
            <div style="font-size: 10px; color: #64748B;">${isEn ? '10-Yr Mean' : 'Media 10 Ani'}</div>
            <strong>${st.tenYearAvgCm} cm</strong> <span style="color:#0369A1">(${devStr})</span>
          </div>
          <div>
            <div style="font-size: 10px; color: #64748B;">${isEn ? '3-Day Forecast' : 'Prognoză 3 Zile'}</div>
            <strong>${st.forecast3dCm} cm</strong>
          </div>
          <div>
            <div style="font-size: 10px; color: #64748B;">${isEn ? '14-Day Forecast' : 'Prognoză 14 Zile'}</div>
            <strong style="color:#0369A1">${st.forecast14dCm} cm</strong>
          </div>
        </div>
        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <button data-map-tab="history_30d" style="flex:1; background:#0F172A; color:#fff; border:none; border-radius:6px; padding:5px 8px; font-size:11px; font-weight:600; cursor:pointer;">${isEn ? 'History' : 'Istoric'}</button>
          <button data-map-tab="forecast_3d" style="flex:1; background:#0369A1; color:#fff; border:none; border-radius:6px; padding:5px 8px; font-size:11px; font-weight:600; cursor:pointer;">${isEn ? '3 Days' : '3 Zile'}</button>
          <button data-map-tab="forecast_14d" style="flex:1; background:#E0F2FE; color:#0369A1; border:none; border-radius:6px; padding:5px 8px; font-size:11px; font-weight:600; cursor:pointer;">${isEn ? '14 Days' : '14 Zile'}</button>
        </div>
      `;

      popupEl.querySelectorAll<HTMLButtonElement>('button[data-map-tab]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tab = btn.dataset.mapTab as ChartMode;
          onSelectStation(st.id);
          onOpenDetailTab(tab);
        });
      });

      marker.bindTooltip(`${st.name} (${countryName}) · ${st.currentLevelCm} cm`, {
        direction: 'top',
        offset: [0, -6],
      });
      marker.bindPopup(popupEl, { maxWidth: 280 });

      marker.on('click', () => {
        onSelectStation(st.id);
      });

      marker.addTo(layerGroup);
      markersByIdRef.current.set(st.id, marker);
    }
  }, [stations, visibleStations, selectedStationId, onSelectStation, onOpenDetailTab, lang, isEn]);

  // Render 14-day catchment precipitation overlays
  useEffect(() => {
    const rainGroup = rainGroupRef.current;
    if (!rainGroup) return;
    rainGroup.clearLayers();
    if (!showRainZones) return;

    for (const zone of basinZones) {
      const radiusMeters = Math.max(42000, Math.min(115000, 38000 + zone.total14dMm * 950));
      const circle = L.circle([zone.lat, zone.lon], {
        radius: radiusMeters,
        color: '#0369A1',
        weight: 1,
        dashArray: '4 4',
        fillColor: '#38BDF8',
        fillOpacity: Math.min(0.28, 0.08 + zone.total14dMm / 250),
      });

      const zName = getBasinShortName(zone.id, lang);
      circle.bindTooltip(
        isEn
          ? `${zName} · 14-day rain: ${zone.total14dMm.toFixed(1)} mm · Downstream lag: ${zone.lagDaysToLowerDanube}d`
          : `${zone.name} · Ploaie 14 zile: ${zone.total14dMm.toFixed(1)} mm · Tranzit aval: ${zone.lagDaysToLowerDanube}z`,
      );
      circle.addTo(rainGroup);
    }
  }, [basinZones, showRainZones, lang, isEn]);

  const focusSectorBounds = (sector: MapSectorFilter) => {
    setSectorFilter(sector);
    const map = mapRef.current;
    if (!map) return;
    if (sector === 'ro') {
      map.flyTo([44.45, 25.3], 6, { duration: 0.55 });
    } else if (sector === 'superior') {
      map.flyTo([48.55, 14.2], 7, { duration: 0.55 });
    } else if (sector === 'mijlociu') {
      map.flyTo([46.65, 19.0], 6, { duration: 0.55 });
    } else if (sector === 'inferior_delta') {
      map.flyTo([44.5, 25.3], 6, { duration: 0.55 });
    } else {
      map.flyTo([46.1, 20.4], 5, { duration: 0.55 });
    }
  };

  const jumpToStation = (st: DanubeStation) => {
    onSelectStation(st.id);
    const map = mapRef.current;
    if (map) {
      map.flyTo([st.lat, st.lon], 9, { duration: 0.55 });
      setTimeout(() => {
        markersByIdRef.current.get(st.id)?.openPopup();
      }, 320);
    }
  };

  // Mini 30-day sparkline points for selected station quick bar
  const sparklinePath = useMemo(() => {
    const pts = selectedDetail?.station.id === selectedStation?.id ? selectedDetail?.history30d ?? [] : [];
    if (pts.length < 2) return '';
    const min = Math.min(...pts.map((p) => p.levelCm));
    const max = Math.max(...pts.map((p) => p.levelCm));
    const span = Math.max(10, max - min);
    return pts
      .map((p, idx) => {
        const x = (idx / (pts.length - 1)) * 116;
        const y = 26 - ((p.levelCm - min) / span) * 22;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [selectedDetail, selectedStation]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Map Header & Layer Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {isEn
              ? `Interactive Danube Basin Map · ${visibleStations.length} / ${stations.length} points shown`
              : `Hartă Interactivă Bazinul Dunării · ${visibleStations.length} / ${stations.length} puncte afișate`}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isEn
              ? 'OpenStreetMap (no API key) · Click any point for water level, 3D/14D forecast, and history'
              : 'OpenStreetMap (fără API Key) · Click pe orice punct pentru cotă, prognoză 3Z/14Z și istoric'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRainZones((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              showRainZones
                ? 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/60 dark:border-sky-800 dark:text-sky-300'
                : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300'
            }`}
          >
            {showRainZones
              ? isEn
                ? '14D Rain: On'
                : 'Ploi 14Z: Activ'
              : isEn
                ? '14D Rain: Off'
                : 'Ploi 14Z: Oprit'}
          </button>
        </div>
      </div>

      {/* Interactive Map Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(
            [
              { id: 'all', label: isEn ? 'Entire Basin' : 'Tot Bazinul' },
              { id: 'ro', label: isEn ? 'Romania' : 'România' },
              { id: 'superior', label: isEn ? 'Upper' : 'Superior' },
              { id: 'mijlociu', label: isEn ? 'Middle' : 'Mijlociu' },
              { id: 'inferior_delta', label: isEn ? 'Lower & Delta' : 'Inferior & Deltă' },
            ] as const
          ).map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => focusSectorBounds(sec.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sectorFilter === sec.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MapStatusFilter)}
            aria-label={isEn ? 'Filter points by status' : 'Filtrare puncte după stare'}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="all">{isEn ? 'All statuses' : 'Toate stările'}</option>
            <option value="flood_any">
              {isEn ? 'Flood Alerts (CA/CI/CP)' : 'Alerte Inundație (CA/CI/CP)'}
            </option>
            <option value="below_avg">{isEn ? 'Below 10-Yr Mean' : 'Sub Media 10 Ani'}</option>
            <option value="nominal">{isEn ? 'Nominal Regime' : 'Regim Nominal'}</option>
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={mapQuery}
              onChange={(e) => setMapQuery(e.target.value)}
              placeholder={isEn ? 'Filter / jump to point...' : 'Filtrează / sari la punct...'}
              className="pl-8 pr-3 py-1.5 w-44 sm:w-52 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
            {mapQuery.trim().length > 0 && visibleStations.length > 0 && visibleStations.length <= 8 && (
              <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-[1000] divide-y divide-slate-100 dark:divide-slate-800">
                {visibleStations.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setMapQuery('');
                      jumpToStation(st);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-sky-50 dark:hover:bg-slate-800 flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {st.name} ({st.country})
                    </span>
                    <span className="font-mono tabular-nums text-sky-700 dark:text-sky-400 shrink-0">
                      {st.currentLevelCm} cm
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leaflet Interactive Map Canvas */}
      <div ref={containerRef} className="w-full h-[350px] sm:h-[400px] z-0" />

      {/* Synchronized Selected Point Quick-Access Strip */}
      {selectedStation && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/70 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {isEn ? 'Selected point' : 'Punct selectat'} · km {selectedStation.km.toFixed(1)}
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-slate-100">
                {selectedStation.name} ({getCountryName(selectedStation.country, lang)})
              </div>
            </div>

            <div className="font-mono tabular-nums">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {isEn ? 'Current level' : 'Cotă curentă'}
              </div>
              <div className="font-bold text-slate-900 dark:text-slate-100">
                {selectedStation.currentLevelCm} cm ({formatSignedCm(selectedStation.change24hCm)})
              </div>
            </div>

            <div className="font-mono tabular-nums">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {isEn ? '3-day forecast' : 'Previziune 3 zile'}
              </div>
              <div className="font-bold text-slate-900 dark:text-slate-100">
                {selectedStation.forecast3dCm} cm
              </div>
            </div>

            <div className="font-mono tabular-nums">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {isEn ? '2-week forecast' : 'Prognoză 2 săpt.'}
              </div>
              <div className="font-bold text-sky-700 dark:text-sky-400">
                {selectedStation.forecast14dCm} cm
              </div>
            </div>

            {sparklinePath && (
              <div className="hidden sm:flex items-center gap-2">
                <svg width="116" height="28" viewBox="0 0 116 28" className="overflow-visible">
                  <path d={sparklinePath} fill="none" stroke="#0369A1" strokeWidth="1.8" />
                </svg>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isEn ? '30 days' : '30 zile'}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => jumpToStation(selectedStation)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isEn ? 'Zoom to Point' : 'Zoom pe Punct'}
            </button>
            <button
              type="button"
              onClick={() => onOpenDetailTab('forecast_14d')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 hover:bg-sky-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              {isEn ? '3D / 14D Forecast' : 'Prognoză 3Z / 14Z'}
            </button>
            <button
              type="button"
              onClick={() => onOpenDetailTab('history_30d')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-sky-700 dark:hover:bg-sky-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              {isEn ? 'Water Level History' : 'Istoric Nivel Apă'}
            </button>
          </div>
        </div>
      )}

      {/* Map Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
        <span className="font-medium text-emerald-700 dark:text-emerald-400">● Nominal</span>
        <span className="font-medium text-sky-700 dark:text-sky-400">
          {isEn ? '▼ Below 10Y Avg' : '▼ Sub Media 10 Ani'}
        </span>
        <span className="font-medium text-amber-700 dark:text-amber-400">
          {isEn ? '▲ Attention (CA)' : '▲ Atenție (CA)'}
        </span>
        <span className="font-medium text-red-700 dark:text-red-400">
          {isEn ? '■ Flood (CI)' : '■ Inundație (CI)'}
        </span>
        <span className="font-medium text-rose-700 dark:text-rose-400">
          {isEn ? '◆ Danger (CP)' : '◆ Pericol (CP)'}
        </span>
        <span className="text-slate-400 dark:text-slate-500">·</span>
        <span>
          {isEn
            ? 'Blue circles: estimated 14-day basin rainfall'
            : 'Cercuri albastre: precipitații estimate 14 zile'}
        </span>
      </div>
    </div>
  );
};
