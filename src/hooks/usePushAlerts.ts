import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Language } from '../i18n/LanguageContext';
import type { PushAlertItem } from '../types/hydrology';

export interface PushSettings {
  enabled: boolean;
  notifyFloodThresholds: boolean;
  romaniaOnly: boolean;
  watchedStationIds: string[];
}

const STORAGE_KEY = 'hidrodunare_push_settings_v2';
const ANDROID_CHANNEL_ID = 'hidrodunare-flood-alerts';

const DEFAULT_SETTINGS: PushSettings = {
  enabled: false,
  notifyFloodThresholds: true,
  romaniaOnly: true,
  watchedStationIds: [],
};

let nextNotificationId = 1000;

function generateNumericNotificationId(): number {
  nextNotificationId = (nextNotificationId % 2000000000) + 1;
  return nextNotificationId;
}

export function formatAlertMessage(alert: PushAlertItem, lang: Language): string {
  if (lang === 'ro') return alert.message;
  if (alert.type === 'flood_cp') {
    return `${alert.stationName} (km ${alert.km}): Current stage ${alert.currentLevelCm} cm exceeds Danger Threshold (${alert.referenceCm} cm) by +${alert.deltaCm} cm.`;
  }
  if (alert.type === 'flood_ci') {
    return `${alert.stationName} (km ${alert.km}): Current stage ${alert.currentLevelCm} cm exceeds Flood Threshold (${alert.referenceCm} cm) by +${alert.deltaCm} cm.`;
  }
  if (alert.type === 'flood_ca') {
    return `${alert.stationName} (km ${alert.km}): Current stage ${alert.currentLevelCm} cm exceeds Attention Threshold (${alert.referenceCm} cm).`;
  }
  return alert.message;
}

export function usePushAlerts(alerts: PushAlertItem[], lang: Language) {
  const [settings, setSettings] = useState<PushSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<PushSettings>;
        return {
          enabled: Boolean(parsed.enabled),
          notifyFloodThresholds: parsed.notifyFloodThresholds ?? true,
          romaniaOnly: parsed.romaniaOnly ?? true,
          watchedStationIds: Array.isArray(parsed.watchedStationIds) ? parsed.watchedStationIds : [],
        };
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_SETTINGS;
  });

  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined') return 'unsupported';
    if (Capacitor.isNativePlatform()) return 'default';
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [inAppToast, setInAppToast] = useState<PushAlertItem | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());
  const channelCreatedRef = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage errors
    }
  }, [settings]);

  // Synchronize native Android/iOS notification permission state on mount
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    LocalNotifications.checkPermissions()
      .then((res) => {
        if (!active) return;
        if (res.display === 'granted') {
          setPermissionState('granted');
        } else if (res.display === 'denied') {
          setPermissionState('denied');
        } else {
          setPermissionState('default');
        }
      })
      .catch(() => {
        if (active) setPermissionState('unsupported');
      });
    return () => {
      active = false;
    };
  }, []);

  const ensureNativeChannel = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || channelCreatedRef.current) return;
    if (Capacitor.getPlatform() !== 'android') {
      channelCreatedRef.current = true;
      return;
    }
    try {
      await LocalNotifications.createChannel({
        id: ANDROID_CHANNEL_ID,
        name: lang === 'en' ? 'Danube Flood Alerts (CA/CI/CP)' : 'Alerte Inundații Dunăre (CA/CI/CP)',
        description:
          lang === 'en'
            ? 'Priority alerts based on official sources when Attention, Flood, or Danger thresholds are exceeded.'
            : 'Notificări prioritare (pe baza surselor oficiale) pentru depășirea cotelor de atenție, inundație și pericol.',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
      channelCreatedRef.current = true;
    } catch {
      // ignore channel creation issues on older Android versions
    }
  }, [lang]);

  const dispatchNotification = useCallback(
    async (title: string, body: string, tag: string) => {
      if (Capacitor.isNativePlatform()) {
        try {
          const perm = await LocalNotifications.checkPermissions();
          if (perm.display !== 'granted') return;
          await ensureNativeChannel();
          await LocalNotifications.schedule({
            notifications: [
              {
                id: generateNumericNotificationId(),
                title,
                body,
                channelId: ANDROID_CHANNEL_ID,
                schedule: { at: new Date(Date.now() + 250) },
                extra: { tag },
              },
            ],
          });
        } catch (err) {
          console.warn('Native local notification dispatch warning:', err);
        }
        return;
      }

      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;

      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            await reg.showNotification(title, {
              body,
              icon: '/pwa-192x192.png',
              badge: '/pwa-192x192.png',
              tag,
            });
            return;
          }
        }
        new Notification(title, { body, icon: '/pwa-192x192.png', tag });
      } catch {
        // ignore Notification fallback errors in restricted iframes
      }
    },
    [ensureNativeChannel],
  );

  const enablePushAlerts = useCallback(async () => {
    setStatusMessage(null);
    const welcomeTitle =
      lang === 'en' ? 'HidroDunăre · Push Alerts Enabled' : 'HidroDunăre · Alerte Push Active';
    const welcomeBody =
      lang === 'en'
        ? 'This application is not official, but uses information from official sources for Attention, Flood, or Danger (CA / CI / CP) alerts.'
        : 'Aplicația nu este oficială, dar folosește informații din surse oficiale pentru alertele de depășire a cotelor CA / CI / CP.';
    const enabledMsg =
      lang === 'en'
        ? 'Push alerts for CA / CI / CP flood thresholds are now enabled.'
        : 'Alertele push pentru depășirea cotelor CA / CI / CP au fost activate.';

    if (Capacitor.isNativePlatform()) {
      try {
        await ensureNativeChannel();
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display === 'granted') {
          setPermissionState('granted');
          setSettings((prev) => ({ ...prev, enabled: true }));
          setStatusMessage(enabledMsg);
          await dispatchNotification(welcomeTitle, welcomeBody, 'hidrodunare-welcome');
          return true;
        }
        setPermissionState('denied');
        setSettings((prev) => ({ ...prev, enabled: false }));
        setStatusMessage(
          lang === 'en'
            ? 'Notification permission was denied. Enable notifications for HidroDunăre in your device Settings.'
            : 'Permisiunea de notificări a fost refuzată. Activați notificările pentru HidroDunăre din Setările telefonului.',
        );
        return false;
      } catch (err) {
        console.warn('Native notification permission error:', err);
        setSettings((prev) => ({ ...prev, enabled: true }));
        setStatusMessage(
          lang === 'en' ? 'In-app alerts have been enabled.' : 'Alertele în aplicație au fost activate.',
        );
        return true;
      }
    }

    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setPermissionState(perm);
        if (perm === 'granted') {
          setSettings((prev) => ({ ...prev, enabled: true }));
          setStatusMessage(enabledMsg);
          await dispatchNotification(welcomeTitle, welcomeBody, 'hidrodunare-welcome');
          return true;
        }
        if (perm === 'denied') {
          setSettings((prev) => ({ ...prev, enabled: false }));
          setStatusMessage(
            lang === 'en'
              ? 'Browser notifications are blocked. Allow notifications in your browser settings.'
              : 'Notificările browser sunt blocate. Permiteți notificările din setările browserului.',
          );
          return false;
        }
      } catch {
        // Fallback: allow in-app alerts inside sandboxed iframes
      }
    }

    setSettings((prev) => ({ ...prev, enabled: true }));
    setStatusMessage(
      lang === 'en' ? 'In-app alerts have been enabled.' : 'Alertele în aplicație au fost activate.',
    );
    return true;
  }, [dispatchNotification, ensureNativeChannel, lang]);

  const disablePushAlerts = useCallback(async () => {
    setSettings((prev) => ({ ...prev, enabled: false }));
    setInAppToast(null);
    notifiedIdsRef.current.clear();
    setStatusMessage(
      lang === 'en'
        ? 'Push alerts have been disabled. You will not receive notifications until re-enabled.'
        : 'Alertele push au fost dezactivate. Nu veți mai primi notificări până la reactivare.',
    );

    if (Capacitor.isNativePlatform()) {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications });
        }
        await LocalNotifications.removeAllDeliveredNotifications();
      } catch {
        // ignore native cleanup errors
      }
    }
  }, [lang]);

  // Evaluate incoming flood threshold alerts (CA/CI/CP only) and dispatch notifications
  useEffect(() => {
    if (!settings.enabled || !settings.notifyFloodThresholds || alerts.length === 0) return;

    const matching = alerts.filter((a) => {
      if (a.type === 'below_10yr_avg') return false;
      if (settings.romaniaOnly && a.country !== 'RO') return false;
      if (settings.watchedStationIds.length > 0 && !settings.watchedStationIds.includes(a.stationId)) return false;
      return true;
    });

    const firstUnnotified = matching.find((a) => !notifiedIdsRef.current.has(a.id));
    if (firstUnnotified) {
      notifiedIdsRef.current.add(firstUnnotified.id);
      const title =
        lang === 'en'
          ? `Flood Alert · ${firstUnnotified.stationName}`
          : `Alertă Inundație · ${firstUnnotified.stationName}`;
      const body = formatAlertMessage(firstUnnotified, lang);
      void dispatchNotification(title, body, firstUnnotified.id);
      setInAppToast({ ...firstUnnotified, message: body });
    }
  }, [alerts, settings, dispatchNotification, lang]);

  const sendTestPushAlert = useCallback(async () => {
    const sample: PushAlertItem = {
      id: `test-flood-${Date.now()}`,
      stationId: '742052',
      stationName: 'Galați',
      country: 'RO',
      km: 150,
      type: 'flood_ci',
      severity: 'high',
      currentLevelCm: 614,
      referenceCm: 600,
      deltaCm: 14,
      message:
        lang === 'en'
          ? 'TEST ALERT: Galați (km 150) — Simulated stage 614 cm exceeds Flood Threshold (600 cm) by +14 cm.'
          : 'TEST ALERTĂ: Galați (km 150) — Cota simulată 614 cm depășește Cota de Inundație (600 cm) cu +14 cm.',
      timestamp: new Date().toISOString(),
    };

    if (Capacitor.isNativePlatform() && permissionState !== 'granted') {
      try {
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display === 'granted') {
          setPermissionState('granted');
        }
      } catch {
        // continue with in-app toast
      }
    }

    setInAppToast(sample);
    await dispatchNotification(
      lang === 'en' ? 'Flood Alert · Galați (TEST)' : 'Alertă Inundație · Galați (TEST)',
      sample.message,
      sample.id,
    );
  }, [dispatchNotification, permissionState, lang]);

  return {
    settings,
    setSettings,
    permissionState,
    statusMessage,
    inAppToast,
    dismissToast: () => setInAppToast(null),
    enablePushAlerts,
    disablePushAlerts,
    sendTestPushAlert,
  };
}
