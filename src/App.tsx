import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, Download, Info, Languages, MapPin, Moon, RefreshCw, Search, ShieldAlert, Smartphone, Sun, Table2, X } from 'lucide-react';
import { AboutView } from './components/AboutView';
import { AlertsView } from './components/AlertsView';
import { DanubeMap } from './components/DanubeMap';
import type { ChartMode } from './components/HydrographChart';
import { StationDetailPanel } from './components/StationDetailPanel';
import { StationsTableView } from './components/StationsTableView';
import { useOnlineStatus, usePWAInstall } from './hooks/usePWAInstall';
import { usePushAlerts } from './hooks/usePushAlerts';
import { useLanguage } from './i18n/LanguageContext';
import { fetchOverviewData, fetchStationDetailData, isStandaloneNativeApp } from './services/apiClient';
import type { DanubeStation, OverviewResponse, StationDetailPayload } from './types/hydrology';
import { exportBasinBulletinPdf } from './utils/pdfReport';
import { formatSignedCm, getCountryName, getStatusPresentation } from './utils/statusFormat';

type WorkspaceTab = 'dashboard' | 'table' | 'alerts' | 'about';
type StationListFilter = 'all' | 'ro' | 'flood' | 'below_avg';

export default function App() {
  const { lang, setLang } = useLanguage();
  const isEn = lang === 'en';

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [selectedStationId, setSelectedStationId] = useState<string>('742027'); // Giurgiu default
  const [stationDetail, setStationDetail] = useState<StationDetailPayload | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [listFilter, setListFilter] = useState<StationListFilter>('ro');
  const [darkMode, setDarkMode] = useState(false);
  const [requestedChartMode, setRequestedChartMode] = useState<{ mode: ChartMode; seq: number } | null>(null);
  const detailContainerRef = useRef<HTMLDivElement | null>(null);

  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, install } = usePWAInstall();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const fetchOverview = useCallback(async (forceRefresh = false) => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const data = await fetchOverviewData(forceRefresh);
      setOverview(data);
      setSelectedStationId((prev) => {
        if (data.stations.some((s) => s.id === prev)) return prev;
        const roDefault = data.stations.find((s) => s.country === 'RO');
        return roDefault?.id ?? data.stations[0]?.id ?? '';
      });
    } catch (err) {
      setOverviewError(
        err instanceof Error
          ? err.message
          : 'Eroare de conexiune la sursele oficiale.',
      );
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview(false);
  }, [fetchOverview]);

  const fetchStationDetail = useCallback(async (stationId: string) => {
    if (!stationId) return;
    setLoadingDetail(true);
    try {
      const data = await fetchStationDetailData(stationId);
      if (data) setStationDetail(data);
    } catch (err) {
      console.warn('Station detail load error:', err);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStationId) {
      void fetchStationDetail(selectedStationId);
    }
  }, [selectedStationId, fetchStationDetail]);

  // Real-time alerts: SSE stream in web/server mode, periodic direct refresh in standalone APK/iOS mode
  useEffect(() => {
    if (isStandaloneNativeApp()) {
      const timer = setInterval(() => {
        void fetchOverview(true);
      }, 15 * 60 * 1000);
      return () => clearInterval(timer);
    }

    const es = new EventSource('/api/alerts/stream');
    es.addEventListener('alerts', (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as {
          observedDateLabel: string;
          fetchedAt: string;
          alerts: OverviewResponse['alerts'];
        };
        setOverview((prev) => (prev ? { ...prev, alerts: payload.alerts, fetchedAt: payload.fetchedAt } : prev));
      } catch {
        // ignore parse errors
      }
    });
    return () => es.close();
  }, [fetchOverview]);

  const alerts = overview?.alerts ?? [];
  const push = usePushAlerts(alerts, lang);

  const stations = overview?.stations ?? [];

  const filteredSidebarStations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return stations.filter((s) => {
      if (listFilter === 'ro' && s.country !== 'RO') return false;
      if (listFilter === 'flood' && s.status !== 'attention' && s.status !== 'flood' && s.status !== 'danger') {
        return false;
      }
      if (listFilter === 'below_avg' && s.status !== 'below_avg') return false;
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
  }, [stations, listFilter, searchQuery]);

  const stats = useMemo(() => {
    const roCount = stations.filter((s) => s.country === 'RO').length;
    const floodCount = stations.filter(
      (s) => s.status === 'attention' || s.status === 'flood' || s.status === 'danger',
    ).length;
    const belowAvgCount = stations.filter((s) => s.status === 'below_avg').length;
    const avgRain14d =
      overview && overview.basinZones.length > 0
        ? overview.basinZones.reduce((sum, z) => sum + z.total14dMm, 0) / overview.basinZones.length
        : 0;
    return { roCount, floodCount, belowAvgCount, avgRain14d };
  }, [stations, overview]);

  const handleSelectStationFromAnyView = useCallback((stationId: string) => {
    setSelectedStationId(stationId);
    setActiveTab('dashboard');
  }, []);

  const handleExportGlobalPdf = () => {
    if (!overview) return;
    const targetStations = listFilter === 'ro' ? stations.filter((s) => s.country === 'RO') : stations;
    exportBasinBulletinPdf(overview, targetStations, lang);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 pb-16 md:pb-0">
      {/* Top Bar Contract: 1 row, 3 zones, gap-8 */}
      <header className="sticky top-0 z-30 h-[52px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-8">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          HidroDunăre
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
          {(
            [
              { id: 'dashboard', label: isEn ? 'Dashboard & Map' : 'Panou & Hartă' },
              { id: 'table', label: isEn ? 'Danube Stations' : 'Stații Dunăre' },
              { id: 'alerts', label: isEn ? 'Push Alerts' : 'Alerte Push' },
              { id: 'about', label: isEn ? 'About' : 'Despre' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === item.id
                  ? 'border-sky-700 text-slate-900 dark:border-sky-400 dark:text-white font-semibold'
                  : 'border-transparent hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={handleExportGlobalPdf}
            disabled={!overview}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-700 text-white hover:bg-sky-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {isEn ? 'Export PDF' : 'Exportă PDF'}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main id="top" className="flex-1 w-full max-w-[1440px] mx-auto px-4 lg:px-6 py-5 space-y-5">
        {/* Workspace Control Bar (below top bar) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {isEn
                ? 'Danube Water Levels · This application is not official, but uses information from official sources'
                : 'Cotele Apelor Dunării · Aplicația nu este oficială, dar folosește informații din surse oficiale'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {isEn ? 'Observation:' : 'Observație:'}{' '}
              {overview?.observedDateLabel ?? (isEn ? 'Loading...' : 'Se încarcă...')}
            </span>
            <span aria-hidden="true">·</span>
            <span>OVF Hydroinfo / AFDJ Galați / WSV Pegelonline / Copernicus GloFAS</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Language Switcher RO / EN */}
            <div
              role="group"
              aria-label={isEn ? 'Select language' : 'Selectare limbă'}
              className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs"
            >
              <Languages className="w-3.5 h-3.5 text-slate-400 mx-1.5 shrink-0" />
              <button
                type="button"
                onClick={() => setLang('ro')}
                className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  lang === 'ro'
                    ? 'bg-sky-700 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                RO
              </button>
              <button
                type="button"
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  lang === 'en'
                    ? 'bg-sky-700 text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                {isEn ? 'Install App' : 'Instalează App'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void fetchOverview(true)}
              disabled={loadingOverview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingOverview ? 'animate-spin' : ''}`} />
              {isEn ? 'Refresh Data' : 'Actualizează Datele'}
            </button>
            <button
              type="button"
              onClick={() => setDarkMode((v) => !v)}
              aria-label={isEn ? 'Toggle light/dark theme' : 'Comută tema zi/noapte'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              {darkMode ? (isEn ? 'Light Mode' : 'Mod Zi') : isEn ? 'Dark Mode' : 'Mod Noapte'}
            </button>
          </div>
        </div>

        {/* Error banner if API unavailable */}
        {overviewError && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center justify-between gap-3 text-xs text-red-800 dark:text-red-300">
            <span>
              {isEn
                ? `Error connecting to official hydrological sources: ${overviewError}`
                : `Eroare la conectarea cu sursele hidrologice oficiale: ${overviewError}`}
            </span>
            <button
              type="button"
              onClick={() => void fetchOverview(true)}
              className="px-3 py-1.5 font-semibold rounded-md bg-red-700 text-white hover:bg-red-800 cursor-pointer shrink-0"
            >
              {isEn ? 'Retry' : 'Reîncearcă'}
            </button>
          </div>
        )}

        {/* 4-Column Hydrological Summary Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          <div className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isEn ? 'Monitored Localities' : 'Localități Monitorizate'}
            </div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {stations.length || '—'}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {isEn
                ? `${stats.roCount} ports in Romania`
                : `${stats.roCount} porturi în România`}
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isEn ? 'Flood Threshold Exceedances' : 'Depășiri Cote Inundație'}
            </div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {stats.floodCount}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {stats.floodCount > 0
                ? isEn
                  ? '■ CA / CI / CP thresholds reached'
                  : '■ Praguri CA / CI / CP atinse'
                : isEn
                  ? '● No CA/CI/CP threshold exceeded'
                  : '● Nicio depășire de prag CA/CI/CP'}
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isEn ? 'Below 10-Yr Annual Mean' : 'Sub Media Anuală 10 Ani'}
            </div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-sky-700 dark:text-sky-400">
              {stats.belowAvgCount}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {isEn ? '▼ vs. 2016–2025 mean (GloFAS)' : '▼ Față de media 2016–2025 (GloFAS)'}
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isEn ? 'Basin Precipitation (14 Days)' : 'Precipitații Bazin (14 Zile)'}
            </div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {stats.avgRain14d.toFixed(1)} <span className="text-xs font-normal text-slate-400">mm</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {isEn ? 'ECMWF average across 6 Danube sub-basins' : 'Medie ECMWF pe 6 sub-bazine Dunăre'}
            </div>
          </div>
        </section>

        {/* Workspace Content */}
        {activeTab === 'dashboard' && (
          <div className="flex flex-col lg:flex-row items-start gap-5">
            {/* Left Station Selector Column */}
            <aside className="w-full lg:w-[350px] shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isEn ? 'Search station or country...' : 'Caută stație sau țară...'}
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-600"
                  />
                </div>

                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {(
                    [
                      { id: 'ro', label: isEn ? 'Romania' : 'România' },
                      { id: 'all', label: isEn ? 'All' : 'Toate' },
                      { id: 'flood', label: isEn ? 'Floods' : 'Inundații' },
                      { id: 'below_avg', label: isEn ? '< 10Y' : 'Sub 10A' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setListFilter(tab.id)}
                      className={`py-1.5 px-2 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap truncate cursor-pointer ${
                        listFilter === tab.id
                          ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[540px] lg:max-h-[840px] overflow-y-auto">
                {loadingOverview && stations.length === 0 ? (
                  Array.from({ length: 8 }, (_, i) => (
                    <div key={i} className="p-3.5 space-y-2">
                      <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                      <div className="h-3 w-48 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
                    </div>
                  ))
                ) : filteredSidebarStations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                    {isEn ? 'No station found for the current filter.' : 'Nicio stație găsită pentru filtrul curent.'}
                  </div>
                ) : (
                  filteredSidebarStations.map((st: DanubeStation) => {
                    const isSelected = st.id === selectedStationId;
                    const pres = getStatusPresentation(st.status, lang);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSelectedStationId(st.id)}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-sky-50/80 dark:bg-sky-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {st.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {getCountryName(st.country, lang)} · km {st.km.toFixed(0)} ·{' '}
                            <span className={pres.textClass}>
                              {pres.glyph} {pres.shortLabel}
                            </span>
                          </div>
                        </div>
                        <div className="text-right font-mono tabular-nums shrink-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {st.currentLevelCm} cm
                          </div>
                          <div
                            className={`text-[11px] ${
                              st.change24hCm > 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : st.change24hCm < 0
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-slate-400'
                            }`}
                          >
                            {formatSignedCm(st.change24hCm)}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Interactive Map & Selected Station Deep Telemetry */}
            <div className="flex-1 min-w-0 w-full space-y-5">
              <DanubeMap
                stations={stations}
                basinZones={overview?.basinZones ?? []}
                selectedStationId={selectedStationId}
                selectedDetail={stationDetail}
                onSelectStation={setSelectedStationId}
                onOpenDetailTab={(mode) => {
                  setRequestedChartMode((prev) => ({ mode, seq: (prev?.seq ?? 0) + 1 }));
                  detailContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
              <div ref={detailContainerRef}>
                <StationDetailPanel
                  detail={stationDetail}
                  loading={loadingDetail}
                  requestedChartMode={requestedChartMode}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'table' && (
          <StationsTableView
            stations={stations}
            selectedStationId={selectedStationId}
            onInspectStation={handleSelectStationFromAnyView}
            onExportBulletin={(filtered) => overview && exportBasinBulletinPdf(overview, filtered, lang)}
          />
        )}

        {activeTab === 'alerts' && (
          <AlertsView
            alerts={alerts}
            stations={stations}
            settings={push.settings}
            setSettings={push.setSettings}
            permissionState={push.permissionState}
            statusMessage={push.statusMessage}
            onEnablePush={push.enablePushAlerts}
            onDisablePush={push.disablePushAlerts}
            onSendTestPush={push.sendTestPushAlert}
            onSelectStation={handleSelectStationFromAnyView}
          />
        )}

        {activeTab === 'about' && <AboutView />}
      </main>

      {/* Offline Connectivity Indicator */}
      {!isOnline && (
        <div className="fixed bottom-16 md:bottom-4 left-4 z-40 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white shadow-lg">
          {isEn
            ? 'Offline Mode — Showing latest cached levels.'
            : 'Mod Offline — Se utilizează ultimele cote salvate în cache.'}
        </div>
      )}

      {/* Real-Time In-App Push Toast */}
      {push.inAppToast && (
        <div className="fixed bottom-16 md:bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm bg-slate-900 text-white border border-slate-700 rounded-xl p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{isEn ? 'Hydrological Push Alert' : 'Alertă Push Hidrologie'}</span>
            </div>
            <button
              type="button"
              onClick={push.dismissToast}
              aria-label={isEn ? 'Dismiss alert' : 'Închide alerta'}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-200 leading-relaxed">{push.inAppToast.message}</p>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 items-center">
        {(
          [
            { id: 'dashboard', label: isEn ? 'Map' : 'Hartă', Icon: MapPin },
            { id: 'table', label: isEn ? 'Stations' : 'Stații', Icon: Table2 },
            { id: 'alerts', label: isEn ? 'Alerts' : 'Alerte', Icon: BellRing },
            { id: 'about', label: isEn ? 'About' : 'Despre', Icon: Info },
          ] as const
        ).map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center h-full text-[10px] font-medium cursor-pointer ${
                active ? 'text-sky-700 dark:text-sky-400 font-semibold' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
