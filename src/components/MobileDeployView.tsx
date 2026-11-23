import React, { useState } from 'react';
import { Check, Copy, Download, Smartphone, Terminal } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const MobileDeployView: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copySnippet = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const androidScript = `./scripts/build-release-apk.sh`;
  const iosCommands = `npm run build
npx cap sync ios
cd ios/App && pod install
open App.xcworkspace`;

  return (
    <div className="space-y-6">
      {/* PWA Instant Install Banner */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Instalare Directă pe Telefon (PWA Android & iOS Safari)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
              Aplicația funcționează nativ în mod standalone cu caching offline (Service Worker Workbox) și notificări push pe Android Chrome și iOS 16.4+ Safari (Adăugare la Ecranul Principal).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isInstalled ? (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                ● Aplicația rulează deja în mod instalat
              </span>
            ) : isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-sky-700 text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Instalează Aplicația (Android / Desktop)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowIOSGuide((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                {isIOS ? 'Instrucțiuni Instalare iPhone / iPad' : 'Ghid Instalare Mobilă PWA'}
              </button>
            )}
          </div>
        </div>

        {(showIOSGuide || isIOS) && !isInstalled && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 space-y-1">
            <div className="font-semibold text-slate-900 dark:text-slate-100">Instalare pe iOS (iPhone / iPad):</div>
            <p>1. Deschideți aplicația în Safari pe iOS 16.4 sau mai nou.</p>
            <p>2. Apăsați butonul <strong>Share (Partajare)</strong> din bara inferioară Safari.</p>
            <p>3. Selectați <strong>Add to Home Screen (Adaugă pe ecranul principal)</strong> pentru mod standalone și Web Push iOS.</p>
          </div>
        )}
      </div>

      {/* Native Android APK & iOS Packaging Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Android APK Compilation & Signing */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Android · Compilare și Semnare APK (Capacitor)
            </h3>
            <span className="text-xs font-mono text-sky-700 dark:text-sky-400">ro.hidrodunare.app</span>
          </div>

          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            Proiectul nativ Android este configurat cu <strong>Capacitor 8</strong>, manifest cu permisiuni <span className="font-mono">POST_NOTIFICATIONS</span> și <span className="font-mono">INTERNET</span>, configurare Gradle pentru semnare Release (<span className="font-mono">signingConfigs.release</span>) și pipeline CI GitHub Actions gata să compileze și să semneze fișierul <span className="font-mono">app-release.apk</span>.
          </p>

          <div className="space-y-2 text-xs">
            <div className="font-semibold text-slate-900 dark:text-slate-100">Fișiere native pregătite în proiect:</div>
            <ul className="space-y-1 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
              <li>· capacitor.config.ts (Configurație Android + iOS + Push)</li>
              <li>· android/app/build.gradle (Semnare Release JKS / keystore.properties)</li>
              <li>· android/app/src/main/AndroidManifest.xml (Permisiuni Push Android 13+)</li>
              <li>· scripts/build-release-apk.sh (Generare Keystore + Build & Sign APK)</li>
              <li>· .github/workflows/mobile-build.yml (Build APK semnat automat în CI)</li>
            </ul>
          </div>

          <div className="bg-slate-950 text-slate-100 rounded-lg p-3 font-mono text-[11px] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-x-auto">
              <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <code>{androidScript}</code>
            </div>
            <button
              type="button"
              onClick={() => copySnippet('apk', androidScript)}
              className="p-1.5 text-slate-300 hover:text-white cursor-pointer shrink-0"
              aria-label="Copiază comanda Android"
            >
              {copiedId === 'apk' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            Cerințe locale pentru rularea scriptului: JDK 17+, Android SDK (Build-Tools 35) și Gradle. Dacă nu aveți Android Studio instalat local, rulați workflow-ul <span className="font-mono">.github/workflows/mobile-build.yml</span> pe GitHub Actions pentru a descărca direct <span className="font-mono">HidroDunare-signed.apk</span>.
          </div>
        </div>

        {/* Comprehensive iOS Guide */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              iOS · Arhitectură Xcode, APNs Push & TestFlight
            </h3>
            <span className="text-xs font-mono text-sky-700 dark:text-sky-400">iOS 15.0+ · Swift/WKWebView</span>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <div>
              <strong className="text-slate-900 dark:text-slate-100">1. Mediu necesar macOS:</strong> Xcode 16+, CocoaPods (<span className="font-mono">sudo gem install cocoapods</span>) și cont Apple Developer (pentru TestFlight / App Store sau dispozitiv fizic prin provisioning gratuit 7 zile).
            </div>
            <div>
              <strong className="text-slate-900 dark:text-slate-100">2. Capabilități Xcode (Signing & Capabilities):</strong>
              <ul className="mt-1 space-y-0.5 pl-3">
                <li>· Activați <strong>Push Notifications</strong> și generați cheia <strong>APNs Auth Key (.p8)</strong> din Apple Developer Portal.</li>
                <li>· Activați <strong>Background Modes</strong>: bifați <em>Remote notifications</em> și <em>Background fetch</em> pentru verificarea periodică a cotelor de inundație.</li>
                <li>· În <span className="font-mono">ios/App/App/Info.plist</span> sunt configurate cheile <span className="font-mono">UIBackgroundModes</span>, <span className="font-mono">ITSAppUsesNonExemptEncryption=false</span> și descrierea permisiunilor.</li>
              </ul>
            </div>
            <div>
              <strong className="text-slate-900 dark:text-slate-100">3. Backend & Export PDF pe iOS:</strong> Schimbați <span className="font-mono">server.url</span> în <span className="font-mono">capacitor.config.ts</span> către URL-ul public HTTPS al serverului Express (ex. Cloud Run), apoi arhivați din Xcode cu <em>Product → Archive → Distribute App → TestFlight</em>.
            </div>
          </div>

          <div className="bg-slate-950 text-slate-100 rounded-lg p-3 font-mono text-[11px] flex items-start justify-between gap-2">
            <pre className="overflow-x-auto leading-relaxed">{iosCommands}</pre>
            <button
              type="button"
              onClick={() => copySnippet('ios', iosCommands)}
              className="p-1.5 text-slate-300 hover:text-white cursor-pointer shrink-0"
              aria-label="Copiază comenzile iOS"
            >
              {copiedId === 'ios' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
