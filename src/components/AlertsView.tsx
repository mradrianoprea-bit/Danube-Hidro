import React from 'react';
import { BellOff, BellRing, ShieldAlert } from 'lucide-react';
import { formatAlertMessage, type PushSettings } from '../hooks/usePushAlerts';
import { useLanguage } from '../i18n/LanguageContext';
import type { DanubeStation, PushAlertItem } from '../types/hydrology';
import { getCountryName } from '../utils/statusFormat';

interface AlertsViewProps {
  alerts: PushAlertItem[];
  stations: DanubeStation[];
  settings: PushSettings;
  setSettings: React.Dispatch<React.SetStateAction<PushSettings>>;
  permissionState: NotificationPermission | 'unsupported';
  statusMessage: string | null;
  onEnablePush: () => Promise<boolean>;
  onDisablePush: () => Promise<void>;
  onSendTestPush: () => Promise<void>;
  onSelectStation: (stationId: string) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  stations,
  settings,
  setSettings,
  permissionState,
  statusMessage,
  onEnablePush,
  onDisablePush,
  onSendTestPush,
  onSelectStation,
}) => {
  const { lang } = useLanguage();
  const isEn = lang === 'en';
  const floodAlerts = alerts.filter((a) => a.type !== 'below_10yr_avg');
  const romanianStations = stations.filter((s) => s.country === 'RO');

  const toggleWatched = (id: string) => {
    setSettings((prev) => {
      const exists = prev.watchedStationIds.includes(id);
      return {
        ...prev,
        watchedStationIds: exists
          ? prev.watchedStationIds.filter((x) => x !== id)
          : [...prev.watchedStationIds, id],
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Push Notification Activation, Deactivation & Rules Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {isEn ? 'Real-Time Push Alerts System' : 'Sistem Alerte Push în Timp Real'}
              </h2>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                  settings.enabled
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                }`}
              >
                {settings.enabled
                  ? isEn
                    ? '● Active'
                    : '● Active'
                  : isEn
                    ? '○ Disabled'
                    : '○ Dezactivate'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              {isEn
                ? 'This application is not official, but uses information from official sources for Attention, Flood, and Danger threshold alerts (CA / CI / CP) on mobile and web.'
                : 'Aplicația nu este oficială, dar folosește informații din surse oficiale pentru notificări la depășirea cotelor de atenție, inundație și pericol (CA / CI / CP), pe telefon și în browser.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {settings.enabled ? (
              <button
                type="button"
                onClick={() => void onDisablePush()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BellOff className="w-3.5 h-3.5" />
                {isEn ? 'Disable Push Alerts' : 'Dezactivează Alertele Push'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onEnablePush()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-700 text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BellRing className="w-3.5 h-3.5" />
                {isEn ? 'Enable Push Alerts' : 'Activează Alertele Push'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void onSendTestPush()}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isEn ? 'Test Flood Push' : 'Testează Push Inundație'}
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-3 px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200">
            {statusMessage}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifyFloodThresholds}
              onChange={(e) => setSettings((p) => ({ ...p, notifyFloodThresholds: e.target.checked }))}
              className="mt-0.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {isEn ? 'Defense Threshold Exceedances (CA / CI / CP)' : 'Depășire Cote de Apărare (CA / CI / CP)'}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {isEn
                  ? 'Priority alert when Attention, Flood, or Danger levels are reached'
                  : 'Alertă prioritară la atingerea Cotelor de Atenție, Inundație sau Pericol'}
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.romaniaOnly}
              onChange={(e) => setSettings((p) => ({ ...p, romaniaOnly: e.target.checked }))}
              className="mt-0.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {isEn
                  ? `Romanian Sector Only (${romanianStations.length} stations)`
                  : `Doar Sectorul Românesc (${romanianStations.length} stații)`}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                {isEn ? 'Notification permission:' : 'Stare permisiune notificări:'}{' '}
                <span className="font-mono">{permissionState}</span>
              </div>
            </div>
          </label>
        </div>

        {/* Watched Romanian ports selector */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {isEn ? 'Watched Locations Filter' : 'Filtru Localități Urmărite'} (
              {settings.watchedStationIds.length === 0
                ? isEn
                  ? 'All'
                  : 'Toate'
                : settings.watchedStationIds.length}
              )
            </span>
            {settings.watchedStationIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSettings((p) => ({ ...p, watchedStationIds: [] }))}
                className="text-xs text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
              >
                {isEn ? 'Reset to all stations' : 'Resetează la toate stațiile'}
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {romanianStations.map((st) => {
              const active = settings.watchedStationIds.includes(st.id);
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => toggleWatched(st.id)}
                  className={`px-2.5 py-1 text-xs rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-sky-700 border-sky-700 text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  {st.name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Flood Threshold Alerts Feed */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isEn
                ? 'Attention / Flood / Danger Threshold Exceedances (CA / CI / CP)'
                : 'Depășiri Cote de Atenție / Inundație / Pericol (CA / CI / CP)'}
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {floodAlerts.length} {isEn ? 'active' : 'active'}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {floodAlerts.length === 0 ? (
            <div className="p-6 text-xs text-slate-600 dark:text-slate-400">
              {isEn
                ? 'No monitoring station currently exceeds Attention (CA), Flood (CI), or Danger (CP) thresholds. Automated monitoring runs continuously.'
                : 'Nicio stație nu depășește în prezent Cota de Atenție (CA), Inundație (CI) sau Pericol (CP). Monitorizarea automată rulează continuu.'}
            </div>
          ) : (
            floodAlerts.map((a) => (
              <div
                key={a.id}
                onClick={() => onSelectStation(a.stationId)}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                    ■ {a.stationName} ({getCountryName(a.country, lang)})
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">km {a.km.toFixed(1)}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{formatAlertMessage(a, lang)}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
