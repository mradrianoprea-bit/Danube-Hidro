import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import type { PushAlertItem } from '../types/hydrology';

export interface PushSettings {
  enabled: boolean;
  notifyFloodThresholds: boolean;
  notifyBelow10YrAvg: boolean;
  romaniaOnly: boolean;
  watchedStationIds: string[];
}

const STORAGE_KEY = 'hidrodunare_push_settings_v1';

const DEFAULT_SETTINGS: PushSettings = {
  enabled: false,
  notifyFloodThresholds: true,
  notifyBelow10YrAvg: true,
  romaniaOnly: true,
  watchedStationIds: [],
};

export function usePushAlerts(alerts: PushAlertItem[]) {
  const [settings, setSettings] = useState<PushSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch {
      // ignore storage errors
    }
    return DEFAULT_SETTINGS;
  });

  const [permissionState, setPermissionState] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [nativeToken, setNativeToken] = useState<string | null>(null);
  const [inAppToast, setInAppToast] = useState<PushAlertItem | null>(null);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const dispatchBrowserNotification = useCallback(async (title: string, body: string, tag: string) => {
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
  }, []);

  const requestPushPermission = useCallback(async () => {
    // 1. Native Capacitor Android/iOS FCM/APNs registration
    if (Capacitor.isNativePlatform()) {
      try {
        const permStatus = await PushNotifications.requestPermissions();
        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
          PushNotifications.addListener('registration', (token) => {
            setNativeToken(token.value);
          });
          setSettings((prev) => ({ ...prev, enabled: true }));
          return true;
        }
      } catch (err) {
        console.warn('Native push registration error:', err);
      }
    }

    // 2. Web Push / Notification API for PWA & Desktop
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setPermissionState(perm);
        if (perm === 'granted') {
          setSettings((prev) => ({ ...prev, enabled: true }));
          await dispatchBrowserNotification(
            'HidroDunăre · Alerte Push Activate',
            'Veți primi notificări în timp real pentru depășirea cotelor de inundație și scăderea sub media pe 10 ani.',
            'hidrodunare-welcome',
          );
          return true;
        }
      } catch {
        // Fallback: allow in-app real-time SSE alerts even inside sandboxed iframes
      }
    }

    setSettings((prev) => ({ ...prev, enabled: true }));
    return true;
  }, [dispatchBrowserNotification]);

  // Evaluate incoming alerts against user rules and dispatch push notifications
  useEffect(() => {
    if (!settings.enabled || alerts.length === 0) return;

    const matching = alerts.filter((a) => {
      if (settings.romaniaOnly && a.country !== 'RO') return false;
      if (settings.watchedStationIds.length > 0 && !settings.watchedStationIds.includes(a.stationId)) return false;
      if (a.type === 'below_10yr_avg' && !settings.notifyBelow10YrAvg) return false;
      if (a.type !== 'below_10yr_avg' && !settings.notifyFloodThresholds) return false;
      return true;
    });

    const firstUnnotified = matching.find((a) => !notifiedIdsRef.current.has(a.id));
    if (firstUnnotified) {
      notifiedIdsRef.current.add(firstUnnotified.id);
      const title =
        firstUnnotified.type === 'below_10yr_avg'
          ? `Nivel Scăzut · ${firstUnnotified.stationName}`
          : `Alertă Inundație · ${firstUnnotified.stationName}`;
      void dispatchBrowserNotification(title, firstUnnotified.message, firstUnnotified.id);
      setInAppToast(firstUnnotified);
    }
  }, [alerts, settings, dispatchBrowserNotification]);

  const sendTestPushAlert = useCallback(
    async (kind: 'flood' | 'below_avg') => {
      const sample: PushAlertItem =
        kind === 'flood'
          ? {
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
              message: 'TEST ALERTĂ: Galați (km 150) — Cota simulată 614 cm depășește Cota de Inundație (600 cm) cu +14 cm.',
              timestamp: new Date().toISOString(),
            }
          : {
              id: `test-low-${Date.now()}`,
              stationId: '742027',
              stationName: 'Giurgiu',
              country: 'RO',
              km: 493,
              type: 'below_10yr_avg',
              severity: 'warning',
              currentLevelCm: -114,
              referenceCm: 72,
              deltaCm: -186,
              message: 'TEST ALERTĂ: Giurgiu (km 493) — Cota -114 cm este cu 186 cm sub media multianuală pe 10 ani (+72 cm).',
              timestamp: new Date().toISOString(),
            };

      setInAppToast(sample);
      const title = kind === 'flood' ? 'Alertă Inundație · Galați (TEST)' : 'Sub Media 10 Ani · Giurgiu (TEST)';
      await dispatchBrowserNotification(title, sample.message, sample.id);
    },
    [dispatchBrowserNotification],
  );

  return {
    settings,
    setSettings,
    permissionState,
    nativeToken,
    inAppToast,
    dismissToast: () => setInAppToast(null),
    requestPushPermission,
    sendTestPushAlert,
  };
}
