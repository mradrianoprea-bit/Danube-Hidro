import React from 'react';
import { Bell, BellRing, ShieldAlert, Waves } from 'lucide-react';
import type { PushSettings } from '../hooks/usePushAlerts';
import type { DanubeStation, PushAlertItem } from '../types/hydrology';
import { COUNTRY_NAMES_RO } from '../utils/statusFormat';

interface AlertsViewProps {
  alerts: PushAlertItem[];
  stations: DanubeStation[];
  settings: PushSettings;
  setSettings: React.Dispatch<React.SetStateAction<PushSettings>>;
  permissionState: NotificationPermission | 'unsupported';
  nativeToken: string | null;
  onEnablePush: () => Promise<boolean>;
  onSendTestPush: (kind: 'flood' | 'below_avg') => Promise<void>;
  onSelectStation: (stationId: string) => void;
}

export const AlertsView: React.FC<AlertsViewProps> = ({
  alerts,
  stations,
  settings,
  setSettings,
  permissionState,
  nativeToken,
  onEnablePush,
  onSendTestPush,
  onSelectStation,
}) => {
  const floodAlerts = alerts.filter((a) => a.type !== 'below_10yr_avg');
  const lowWaterAlerts = alerts.filter((a) => a.type === 'below_10yr_avg');

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
      {/* Push Notification Activation & Rules Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Sistem Alerte Push în Timp Real
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Monitorizare continuă prin flux SSE + Service Worker Web Push (și FCM/APNs în pachetul nativ Android/iOS) pentru depășirea cotelor oficiale CA/CI/CP și scăderea sub media anuală pe ultimii 10 ani (2016–2025).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onEnablePush}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-700 text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BellRing className="w-3.5 h-3.5" />
              {settings.enabled && permissionState === 'granted'
                ? 'Notificări Push Active'
                : 'Activează Alertele Push'}
            </button>
            <button
              type="button"
              onClick={() => onSendTestPush('flood')}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Testează Push Inundație
            </button>
            <button
              type="button"
              onClick={() => onSendTestPush('below_avg')}
              className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Testează Push Sub Media 10A
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifyFloodThresholds}
              onChange={(e) => setSettings((p) => ({ ...p, notifyFloodThresholds: e.target.checked }))}
              className="mt-0.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Depășire Cote de Apărare (CA / CI / CP)
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Alertă prioritară la atingerea Cotelor de Atenție, Inundație sau Pericol
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notifyBelow10YrAvg}
              onChange={(e) => setSettings((p) => ({ ...p, notifyBelow10YrAvg: e.target.checked }))}
              className="mt-0.5 rounded border-slate-300 text-sky-700 focus:ring-sky-600"
            />
            <div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Scădere Sub Media Anuală pe 10 Ani
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Notificare la scăderea cu minimum 15 cm sub media multianuală 2016–2025
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
                Doar Sectorul Românesc ({romanianStations.length} stații)
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                Permisiune browser: <span className="font-mono">{permissionState}</span>
                {nativeToken ? ` · Token nativ: ${nativeToken.slice(0, 10)}...` : ''}
              </div>
            </div>
          </label>
        </div>

        {/* Watched Romanian ports selector */}
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Filtru Localități Urmărite ({settings.watchedStationIds.length === 0 ? 'Toate' : settings.watchedStationIds.length})
            </span>
            {settings.watchedStationIds.length > 0 && (
              <button
                type="button"
                onClick={() => setSettings((p) => ({ ...p, watchedStationIds: [] }))}
                className="text-xs text-sky-700 dark:text-sky-400 hover:underline cursor-pointer"
              >
                Resetează la toate stațiile
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

      {/* Split Live Alert Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flood Threshold Alerts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Depășiri Cote de Inundație / Atenție
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">{floodAlerts.length} active</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {floodAlerts.length === 0 ? (
              <div className="p-6 text-xs text-slate-600 dark:text-slate-400">
                Nicio stație nu depășește în prezent Cota de Atenție (CA), Inundație (CI) sau Pericol (CP). Monitorizarea automată rulează continuu.
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
                      ■ {a.stationName} ({COUNTRY_NAMES_RO[a.country]})
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-500">km {a.km.toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1">{a.message}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Below 10-Year Annual Average Alerts */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Waves className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Scăderi Sub Media Anuală pe 10 Ani
              </h3>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">{lowWaterAlerts.length} active</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
            {lowWaterAlerts.length === 0 ? (
              <div className="p-6 text-xs text-slate-600 dark:text-slate-400">
                Toate stațiile se situează în prezent peste media multianuală pe 10 ani.
              </div>
            ) : (
              lowWaterAlerts.map((a) => (
                <div
                  key={a.id}
                  onClick={() => onSelectStation(a.stationId)}
                  className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-sky-700 dark:text-sky-400">
                      ▼ {a.stationName} ({COUNTRY_NAMES_RO[a.country]})
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      km {a.km.toFixed(1)} · {a.deltaCm} cm
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{a.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
