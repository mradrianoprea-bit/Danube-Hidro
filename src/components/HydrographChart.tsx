import React, { useMemo, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import type { StationDetailPayload } from '../types/hydrology';
import { translateMonthLabel } from '../utils/statusFormat';

export type ChartMode = 'forecast_3d' | 'forecast_14d' | 'history_30d' | 'climatology_10y';

interface HydrographChartProps {
  detail: StationDetailPayload;
  requestedMode?: { mode: ChartMode; seq: number } | null;
}

export const HydrographChart: React.FC<HydrographChartProps> = ({ detail, requestedMode }) => {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const [mode, setMode] = useState<ChartMode>('forecast_14d');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  React.useEffect(() => {
    if (requestedMode?.mode) {
      setMode(requestedMode.mode);
      setHoverIdx(null);
    }
  }, [requestedMode]);

  const { station, forecast3d, forecast14d, history30d, monthlyClimatology10Yr } = detail;

  const series = useMemo(() => {
    if (mode === 'forecast_3d') {
      return [
        {
          label: isEn ? 'Today' : 'Astăzi',
          value: station.currentLevelCm,
          min: station.currentLevelCm,
          max: station.currentLevelCm,
          precip: 0,
          sub: `${station.dischargeM3s ?? station.glofasDischargeM3s} m³/s`,
        },
        ...forecast3d.map((f) => ({
          label: f.date.slice(5),
          value: f.predictedCm,
          min: f.minCm,
          max: f.maxCm,
          precip: f.localPrecipMm + f.upstreamBasinPrecipMm * 0.4,
          sub: isEn
            ? `${f.dischargeM3s} m³/s · Rain ${f.localPrecipMm.toFixed(1)} mm`
            : `${f.dischargeM3s} m³/s · Ploaie ${f.localPrecipMm.toFixed(1)} mm`,
        })),
      ];
    }
    if (mode === 'forecast_14d') {
      return forecast14d.map((f) => ({
        label: f.date.slice(5),
        value: f.predictedCm,
        min: f.minCm,
        max: f.maxCm,
        precip: Number((f.localPrecipMm + f.upstreamBasinPrecipMm).toFixed(1)),
        sub: isEn
          ? `Local ${f.localPrecipMm.toFixed(1)} mm · Upstream ${f.upstreamBasinPrecipMm.toFixed(1)} mm`
          : `Local ${f.localPrecipMm.toFixed(1)} mm · Aport amonte ${f.upstreamBasinPrecipMm.toFixed(1)} mm`,
      }));
    }
    if (mode === 'history_30d') {
      return history30d.map((h) => ({
        label: h.date.slice(5),
        value: h.levelCm,
        min: h.levelCm,
        max: h.levelCm,
        precip: 0,
        sub: isEn
          ? `Discharge: ${h.dischargeM3s} m³/s · 10Y Avg: ${h.tenYearClimatologyCm} cm`
          : `Debit: ${h.dischargeM3s} m³/s · Media 10A: ${h.tenYearClimatologyCm} cm`,
      }));
    }
    return monthlyClimatology10Yr.map((m) => ({
      label: translateMonthLabel(m.month, lang),
      value: m.avgCm,
      min: m.minCm,
      max: m.maxCm,
      precip: 0,
      sub: isEn
        ? `10Y Min: ${m.minCm} cm · 10Y Max: ${m.maxCm} cm`
        : `Min 10A: ${m.minCm} cm · Max 10A: ${m.maxCm} cm`,
    }));
  }, [mode, station, forecast3d, forecast14d, history30d, monthlyClimatology10Yr, isEn, lang]);

  const width = 820;
  const height = 270;
  const padL = 56;
  const padR = 52;
  const padT = 20;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const { yMin, yMax, maxPrecip } = useMemo(() => {
    const vals: number[] = [station.tenYearAvgCm, station.currentLevelCm];
    for (const s of series) {
      vals.push(s.value, s.min, s.max);
    }
    if (mode !== 'climatology_10y' && station.thresholds.ca !== null && station.thresholds.ca - Math.max(...vals) < 220) {
      vals.push(station.thresholds.ca);
    }
    const rawMin = Math.min(...vals);
    const rawMax = Math.max(...vals);
    const span = Math.max(80, rawMax - rawMin);
    const pMax = Math.max(10, ...series.map((s) => s.precip));
    return {
      yMin: Math.floor((rawMin - span * 0.14) / 10) * 10,
      yMax: Math.ceil((rawMax + span * 0.14) / 10) * 10,
      maxPrecip: pMax,
    };
  }, [series, station, mode]);

  const xAt = (i: number) =>
    series.length <= 1 ? padL + plotW / 2 : padL + (i / (series.length - 1)) * plotW;
  const yAt = (v: number) => padT + (1 - (v - yMin) / Math.max(1, yMax - yMin)) * plotH;

  const linePath = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(s.value).toFixed(1)}`).join(' ');

  const bandPath = useMemo(() => {
    if (series.length < 2) return '';
    const upper = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(s.max).toFixed(1)}`).join(' ');
    const lower = [...series]
      .reverse()
      .map((s, idx) => {
        const origIdx = series.length - 1 - idx;
        return `L ${xAt(origIdx).toFixed(1)} ${yAt(s.min).toFixed(1)}`;
      })
      .join(' ');
    return `${upper} ${lower} Z`;
  }, [series, yMin, yMax]);

  const activePoint = hoverIdx !== null && series[hoverIdx] ? series[hoverIdx] : null;
  const yTicks = 5;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(
            [
              { id: 'forecast_3d', label: isEn ? '3-Day Forecast' : 'Prognoză 3 Zile' },
              {
                id: 'forecast_14d',
                label: isEn ? '14-Day Forecast (Rainfall)' : 'Prognoză 14 Zile (Pluviometrie)',
              },
              { id: 'history_30d', label: isEn ? '30-Day History' : 'Istoric 30 Zile' },
              { id: 'climatology_10y', label: isEn ? '10-Yr Mean (2016–2025)' : 'Medie 10 Ani (2016–2025)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setMode(tab.id);
                setHoverIdx(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === tab.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          {activePoint ? (
            <span>
              <strong className="text-slate-900 dark:text-white">{activePoint.label}</strong>: {activePoint.value} cm · {activePoint.sub}
            </span>
          ) : (
            <span>
              {isEn ? 'Hover or tap chart for point values' : 'Mișcați cursorul pe grafic pentru citire punctuală'}
            </span>
          )}
        </div>
      </div>

      <div className="border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50/50 dark:bg-slate-950/60 p-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[540px] h-auto select-none cursor-crosshair"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Horizontal grid ticks */}
          {Array.from({ length: yTicks }, (_, i) => {
            const val = Math.round(yMin + ((yMax - yMin) * i) / (yTicks - 1));
            const y = yAt(val);
            return (
              <g key={i}>
                <line
                  x1={padL}
                  y1={y}
                  x2={width - padR}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="1"
                />
                <text
                  x={padL - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Y axis unit label */}
          <text x={padL - 8} y={11} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
            cm
          </text>
          {mode === 'forecast_14d' && (
            <text x={width - padR + 8} y={11} textAnchor="start" className="fill-sky-600 dark:fill-sky-400 text-[10px] font-mono">
              {isEn ? 'mm rain' : 'mm ploaie'}
            </text>
          )}

          {/* Precipitation bars for 14-day rainfall forecast */}
          {mode === 'forecast_14d' &&
            series.map((s, i) => {
              const barH = (s.precip / maxPrecip) * (plotH * 0.42);
              const barW = Math.max(8, plotW / series.length - 12);
              const x = xAt(i) - barW / 2;
              const y = padT + plotH - barH;
              return (
                <rect
                  key={`rain-${i}`}
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(1, barH)}
                  rx={2}
                  className="fill-sky-400/35 dark:fill-sky-500/30"
                />
              );
            })}

          {/* Right axis precipitation ticks */}
          {mode === 'forecast_14d' &&
            [0, Math.round(maxPrecip / 2), Math.round(maxPrecip)].map((pVal, idx) => {
              const y = padT + plotH - (pVal / maxPrecip) * (plotH * 0.42);
              return (
                <text
                  key={`ptick-${idx}`}
                  x={width - padR + 8}
                  y={y + 3}
                  textAnchor="start"
                  className="fill-sky-600 dark:fill-sky-400 text-[10px] font-mono tabular-nums"
                >
                  {pVal}
                </text>
              );
            })}

          {/* 10-year annual average reference line */}
          {station.tenYearAvgCm >= yMin && station.tenYearAvgCm <= yMax && (
            <g>
              <line
                x1={padL}
                y1={yAt(station.tenYearAvgCm)}
                x2={width - padR}
                y2={yAt(station.tenYearAvgCm)}
                stroke="#0284C7"
                strokeWidth="1.5"
                strokeDasharray="5 4"
              />
              <text
                x={width - padR - 4}
                y={yAt(station.tenYearAvgCm) - 5}
                textAnchor="end"
                className="fill-sky-700 dark:fill-sky-300 text-[10px] font-mono"
              >
                {isEn ? `10-Yr Mean (${station.tenYearAvgCm} cm)` : `Media 10 Ani (${station.tenYearAvgCm} cm)`}
              </text>
            </g>
          )}

          {/* Official CA / CI flood lines if within scale */}
          {station.thresholds.ca !== null &&
            station.thresholds.ca >= yMin &&
            station.thresholds.ca <= yMax && (
              <g>
                <line
                  x1={padL}
                  y1={yAt(station.thresholds.ca)}
                  x2={width - padR}
                  y2={yAt(station.thresholds.ca)}
                  stroke="#D97706"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <text
                  x={padL + 6}
                  y={yAt(station.thresholds.ca) - 4}
                  className="fill-amber-700 dark:fill-amber-400 text-[10px] font-mono"
                >
                  CA ({station.thresholds.ca} cm)
                </text>
              </g>
            )}

          {station.thresholds.ci !== null &&
            station.thresholds.ci >= yMin &&
            station.thresholds.ci <= yMax && (
              <g>
                <line
                  x1={padL}
                  y1={yAt(station.thresholds.ci)}
                  x2={width - padR}
                  y2={yAt(station.thresholds.ci)}
                  stroke="#DC2626"
                  strokeWidth="1.4"
                  strokeDasharray="4 2"
                />
                <text
                  x={padL + 6}
                  y={yAt(station.thresholds.ci) - 4}
                  className="fill-red-700 dark:fill-red-400 text-[10px] font-mono"
                >
                  CI ({station.thresholds.ci} cm)
                </text>
              </g>
            )}

          {/* Uncertainty / Min-Max Envelope */}
          {bandPath && <path d={bandPath} className="fill-sky-500/15 dark:fill-sky-400/15" />}

          {/* Primary stage curve */}
          {series.length > 1 && (
            <path d={linePath} fill="none" stroke="#0369A1" className="dark:stroke-sky-400" strokeWidth="2.4" />
          )}

          {/* Hover vertical hairline */}
          {hoverIdx !== null && series[hoverIdx] && (
            <line
              x1={xAt(hoverIdx)}
              y1={padT}
              x2={xAt(hoverIdx)}
              y2={padT + plotH}
              stroke="#64748B"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
          )}

          {/* Data nodes & interactive hit columns */}
          {series.map((s, i) => {
            const x = xAt(i);
            const y = yAt(s.value);
            const isHovered = hoverIdx === i;
            const showXLabel = series.length <= 14 || i % 3 === 0 || i === series.length - 1;
            const hitW = Math.max(12, plotW / Math.max(1, series.length));

            return (
              <g key={`pt-${i}`}>
                {showXLabel && (
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    className="fill-slate-500 dark:fill-slate-400 text-[10px] font-mono tabular-nums"
                  >
                    {s.label}
                  </text>
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={isHovered ? 5 : 3}
                  className={
                    isHovered
                      ? 'fill-sky-700 stroke-white dark:fill-sky-300 dark:stroke-slate-900'
                      : 'fill-sky-700 dark:fill-sky-400'
                  }
                  strokeWidth={isHovered ? 2 : 0}
                />
                <rect
                  x={x - hitW / 2}
                  y={padT}
                  width={hitW}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHoverIdx(i)}
                  onClick={() => setHoverIdx(i)}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
