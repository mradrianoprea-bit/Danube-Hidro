import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
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

export function usePushAlerts(alerts: PushAlertItem[]) {
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
        name: 'Alerte Inundații Dunăre (CA/CI/CP)',
        description: 'Notificări prioritare pentru depășirea cotelor oficiale de atenție, inundație și pericol.',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
      channelCreatedRef.current = true;
    } catch {
      // ignore channel creation issues on older Android versions
    }
  }, []);

  const dispatchNotification = useCallback(
    async (title: string, body: string, tag: string) => {
      // 1. Native Android / iOS notifications via LocalNotifications (no Firebase crash!)
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

      // 2. Web / PWA Notification API
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

    // 1. Native Capacitor Android/iOS via LocalNotifications (zero Firebase dependency)
    if (Capacitor.isNativePlatform()) {
      try {
        await ensureNativeChannel();
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display === 'granted') {
          setPermissionState('granted');
          setSettings((prev) => ({ ...prev, enabled: true }));
          setStatusMessage('Alertele push pentru depășirea cotelor CA / CI / CP au fost activate.');
          await dispatchNotification(
            'HidroDunăre · Alerte Push Active',
            'Veți primi notificări în timp real pentru depășirea cotelor oficiale de atenție, inundație și pericol (CA / CI / CP).',
            'hidrodunare-welcome',
          );
          return true;
        }
        setPermissionState('denied');
        setSettings((prev) => ({ ...prev, enabled: false }));
        setStatusMessage(
          'Permisiunea de notificări a fost refuzată. Activați notificările pentru HidroDunăre din Setările telefonului.',
        );
        return false;
      } catch (err) {
        console.warn('Native notification permission error:', err);
        setSettings((prev) => ({ ...prev, enabled: true }));
        setStatusMessage('Alertele în aplicație au fost activate.');
        return true;
      }
    }

    // 2. Web Push / Notification API for PWA & Desktop
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setPermissionState(perm);
        if (perm === 'granted') {
          setSettings((prev) => ({ ...prev, enabled: true }));
          setStatusMessage('Alertele push pentru depășirea cotelor CA / CI / CP au fost activate.');
          await dispatchNotification(
            'HidroDunăre · Alerte Push Active',
            'Veți primi notificări în timp real pentru depășirea cotelor oficiale de atenție, inundație și pericol (CA / CI / CP).',
            'hidrodunare-welcome',
          );
          return true;
        }
        if (perm === 'denied') {
          setSettings((prev) => ({ ...prev, enabled: false }));
          setStatusMessage('Notificările browser sunt blocate. Permiteți notificările din setările browserului.');
          return false;
        }
      } catch {
        // Fallback: allow in-app alerts inside sandboxed iframes
      }
    }

    setSettings((prev) => ({ ...prev, enabled: true }));
    setStatusMessage('Alertele în aplicație au fost activate.');
    return true;
  }, [dispatchNotification, ensureNativeChannel]);

  const disablePushAlerts = useCallback(async () => {
    setSettings((prev) => ({ ...prev, enabled: false }));
    setInAppToast(null);
    notifiedIdsRef.current.clear();
    setStatusMessage('Alertele push au fost dezactivate. Nu veți mai primi notificări până la reactivare.');

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
  }, []);

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
      const title = `Alertă Inundație · ${firstUnnotified.stationName}`;
      void dispatchNotification(title, firstUnnotified.message, firstUnnotified.id);
      setInAppToast(firstUnnotified);
    }
  }, [alerts, settings, dispatchNotification]);

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
        'TEST ALERTĂ: Galați (km 150) — Cota simulată 614 cm depășește Cota de Inundație (600 cm) cu +14 cm.',
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
    await dispatchNotification('Alertă Inundație · Galați (TEST)', sample.message, sample.id);
  }, [dispatchNotification, permissionState]);

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
