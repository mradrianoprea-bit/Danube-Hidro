import React from 'react';
import { Download, Droplets, TrendingDown, TrendingUp } from 'lucide-react';
import type { StationDetailPayload } from '../types/hydrology';
import { exportStationReportPdf } from '../utils/pdfReport';
import { BASIN_SHORT_NAMES, COUNTRY_NAMES_RO, formatSignedCm, getStatusPresentation } from '../utils/statusFormat';
import { HydrographChart, type ChartMode } from './HydrographChart';

interface StationDetailPanelProps {
  detail: StationDetailPayload | null;
  loading: boolean;
  requestedChartMode?: { mode: ChartMode; seq: number } | null;
}

export const StationDetailPanel: React.FC<StationDetailPanelProps> = ({ detail, loading, requestedChartMode }) => {
  if (loading && !detail) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
        <div className="h-6 w-64 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Selectați o stație hidrometrică din listă sau de pe hartă pentru a vizualiza prognoza și istoricul detaliat.
        </p>
      </div>
    );
  }

  const { station, forecast3d, forecast14d, basinZones, methodologyNote } = detail;
  const statusInfo = getStatusPresentation(station.status);
  const localBasin = basinZones.find((b) => b.id === station.basinZoneId);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Station Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{COUNTRY_NAMES_RO[station.country]}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">km {station.km.toFixed(1)}</span>
            <span aria-hidden="true">·</span>
            <span>{station.agency}</span>
            <span aria-hidden="true">·</span>
            <span>Observație: {station.observedAt}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-3 mt-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {station.name}
            </h2>
            <span className={`text-xs font-semibold ${statusInfo.textClass}`}>
              {statusInfo.glyph} {statusInfo.label}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => exportStationReportPdf(detail)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 dark:bg-sky-700 dark:hover:bg-sky-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Exportă PDF Stație
        </button>
      </div>

      {/* Key Metrics Strip (Flat hairline grid) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800">
        <div className="p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Cotă Curentă</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {station.currentLevelCm}
            </span>
            <span className="text-xs font-mono text-slate-400">cm</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs font-mono tabular-nums">
            {station.change24hCm >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            )}
            <span className={station.change24hCm >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
              {formatSignedCm(station.change24hCm)} / 24h
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Media Anuală 10 Ani (2016–2025)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {station.tenYearAvgCm}
            </span>
            <span className="text-xs font-mono text-slate-400">cm</span>
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-sky-700 dark:text-sky-400">
            Deviație: {formatSignedCm(station.deviationFrom10YrCm)}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Prognoză 3 Zile · 14 Zile
          </div>
          <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {forecast3d[2]?.predictedCm ?? station.forecast3dCm}
            </span>
            <span className="text-slate-400">/</span>
            <span className="text-xl font-bold text-sky-700 dark:text-sky-400">
              {forecast14d[13]?.predictedCm ?? station.forecast14dCm}
            </span>
            <span className="text-xs text-slate-400">cm</span>
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Droplets className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>
              {localBasin ? `${localBasin.total14dMm.toFixed(1)} mm ploaie 14Z` : BASIN_SHORT_NAMES[station.basinZoneId]}
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Cote Apărare (CA / CI / CP)
          </div>
          <div className="mt-1 text-base font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
            {station.thresholds.ca ?? '—'} / {station.thresholds.ci ?? '—'} / {station.thresholds.cp ?? '—'}
          </div>
          <div className="mt-1 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
            Debit: {station.dischargeM3s ?? station.glofasDischargeM3s} m³/s
            {station.waterTempC !== null ? ` · ${station.waterTempC} °C` : ''}
          </div>
        </div>
      </div>

      {/* Interactive Hydrograph */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800">
        <HydrographChart detail={detail} requestedMode={requestedChartMode} />
      </div>

      {/* Short-Term 3-Day & Long-Term 14-Day Table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 divide-y xl:divide-y-0 xl:divide-x divide-slate-200 dark:divide-slate-800">
        <div className="p-5">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Previziune pe Termen Scurt (3 Zile) și Termen Lung (14 Zile)
          </h3>
          <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium text-right">Cotă (cm)</th>
                  <th className="px-3 py-2 font-medium text-right">Interval</th>
                  <th className="px-3 py-2 font-medium text-right">Debit (m³/s)</th>
                  <th className="px-3 py-2 font-medium text-right">Ploaie (mm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono tabular-nums">
                {forecast14d.map((f, idx) => (
                  <tr
                    key={f.date}
                    className={
                      idx < 3
                        ? 'bg-sky-50/40 dark:bg-sky-950/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }
                  >
                    <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300">
                      {f.date} {idx < 3 ? '· 3Z' : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-slate-900 dark:text-slate-100">
                      {f.predictedCm}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-500 dark:text-slate-400">
                      {f.minCm}..{f.maxCm}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-700 dark:text-slate-300">{f.dischargeM3s}</td>
                    <td className="px-3 py-1.5 text-right text-sky-700 dark:text-sky-400">
                      {(f.localPrecipMm + f.upstreamBasinPrecipMm).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-5">
          <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-3">
            Regimul Pluviometric pe 14 Zile în Zonele Traversate de Dunăre
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
            {basinZones.map((zone) => {
              const isLocal = zone.id === station.basinZoneId;
              return (
                <div
                  key={zone.id}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 text-xs ${
                    isLocal ? 'bg-sky-50/60 dark:bg-sky-950/30' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {zone.name} {isLocal ? '· Zonă Stație' : ''}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {zone.region} · Tranzit spre aval: {zone.lagDaysToLowerDanube} zile
                    </div>
                  </div>
                  <div className="text-right font-mono tabular-nums shrink-0">
                    <div className="font-semibold text-sky-700 dark:text-sky-400">
                      {zone.total14dMm.toFixed(1)} mm
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Max/zi: {zone.maxDailyMm.toFixed(1)} mm
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            {methodologyNote}
          </p>
        </div>
      </div>
    </div>
  );
};
