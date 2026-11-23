import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Download, Search } from 'lucide-react';
import type { CountryCode, DanubeStation } from '../types/hydrology';
import { COUNTRY_NAMES_RO, formatSignedCm, getStatusPresentation } from '../utils/statusFormat';

interface StationsTableViewProps {
  stations: DanubeStation[];
  selectedStationId: string;
  onInspectStation: (stationId: string) => void;
  onExportBulletin: (filtered: DanubeStation[]) => void;
}

type SortKey = 'km' | 'currentLevelCm' | 'change24hCm' | 'deviationFrom10YrCm' | 'forecast3dCm' | 'forecast14dCm';

export const StationsTableView: React.FC<StationsTableViewProps> = ({
  stations,
  selectedStationId,
  onInspectStation,
  onExportBulletin,
}) => {
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState<'ALL' | CountryCode>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('km');
  const [sortAsc, setSortAsc] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = stations.filter((s) => {
      if (countryFilter !== 'ALL' && s.country !== countryFilter) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.code.includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      const diff = a[sortKey] - b[sortKey];
      return sortAsc ? diff : -diff;
    });
  }, [stations, query, countryFilter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Registru Complet Stații Hidrometrice Dunăre
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filtered.length} localități afișate din {stations.length} puncte oficiale monitorizate
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Caută localitate..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-600"
            />
          </div>

          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value as 'ALL' | CountryCode)}
            aria-label="Filtrare după țară"
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-600"
          >
            <option value="ALL">Toate țările ({stations.length})</option>
            {(['RO', 'DE', 'AT', 'SK', 'HU', 'HR', 'RS', 'BG'] as CountryCode[]).map((c) => (
              <option key={c} value={c}>
                {COUNTRY_NAMES_RO[c]}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onExportBulletin(filtered)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-sky-700 text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportă Tabel PDF
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Localitate · Țară</th>
              <th className="px-3 py-2.5 font-semibold text-right">
                <button type="button" onClick={() => toggleSort('km')} className="inline-flex items-center gap-1 cursor-pointer">
                  Km <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold text-right">
                <button type="button" onClick={() => toggleSort('currentLevelCm')} className="inline-flex items-center gap-1 cursor-pointer">
                  Cotă (cm) <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold text-right">
                <button type="button" onClick={() => toggleSort('change24hCm')} className="inline-flex items-center gap-1 cursor-pointer">
                  Var. 24h <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold text-right">Media 10A</th>
              <th className="px-3 py-2.5 font-semibold text-right">
                <button type="button" onClick={() => toggleSort('deviationFrom10YrCm')} className="inline-flex items-center gap-1 cursor-pointer">
                  Deviație 10A <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold text-right">
                <button type="button" onClick={() => toggleSort('forecast3dCm')} className="inline-flex items-center gap-1 cursor-pointer">
                  Prog. 3Z <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold text-right">
                <button type="button" onClick={() => toggleSort('forecast14dCm')} className="inline-flex items-center gap-1 cursor-pointer">
                  Prog. 14Z <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="px-3 py-2.5 font-semibold text-right">CA / CI / CP</th>
              <th className="px-4 py-2.5 font-semibold">Stare</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((s) => {
              const pres = getStatusPresentation(s.status);
              const isSelected = s.id === selectedStationId;
              return (
                <tr
                  key={s.id}
                  onClick={() => onInspectStation(s.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sky-50/70 dark:bg-sky-950/40'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{s.name}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {COUNTRY_NAMES_RO[s.country]} · {s.agency}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                    {s.km.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                    {s.currentLevelCm}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono tabular-nums font-medium ${
                      s.change24hCm > 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : s.change24hCm < 0
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-slate-500'
                    }`}
                  >
                    {formatSignedCm(s.change24hCm)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {s.tenYearAvgCm}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right font-mono tabular-nums font-medium ${
                      s.deviationFrom10YrCm < 0
                        ? 'text-sky-700 dark:text-sky-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {formatSignedCm(s.deviationFrom10YrCm)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                    {s.forecast3dCm}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-sky-700 dark:text-sky-400 font-semibold">
                    {s.forecast14dCm}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {s.thresholds.ca ?? '—'}/{s.thresholds.ci ?? '—'}/{s.thresholds.cp ?? '—'}
                  </td>
                  <td className={`px-4 py-2.5 font-semibold whitespace-nowrap ${pres.textClass}`}>
                    {pres.glyph} {pres.shortLabel}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                  Nicio localitate nu corespunde criteriilor de căutare.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
