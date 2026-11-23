# HidroDunăre — Ghid Complet Compilare APK Semnat (Android) & Aplicație iOS (Xcode / TestFlight / App Store)

## 1. Starea Pachetului Mobil în Proiect
- **Platformă**: Capacitor 8 (`ro.hidrodunare.app`, nume afișat `HidroDunăre`) + Progressive Web App (PWA `vite-plugin-pwa`).
- **Push Notifications**:
  - Web / PWA: Web Push API + Service Worker + Server-Sent Events (`/api/alerts/stream`).
  - Nativ Android & iOS: `@capacitor/push-notifications` integrat în `src/hooks/usePushAlerts.ts`.

---

## 2. Android — Compilare și Semnare APK Release

### Cerințe Locale
- Node.js 20+
- JDK 17 sau JDK 21 (include `keytool`)
- Android SDK (API Level 35 / Build-Tools 35) și Gradle

### Pași Rapizi (Script Automat)
```bash
chmod +x scripts/build-release-apk.sh
./scripts/build-release-apk.sh
```
Scriptul va:
1. Genera cheia privată RSA 2048-bit (`android/hidrodunare-release.jks`) și `android/keystore.properties` (dacă nu există).
2. Compila frontend-ul Vite (`npm run build`) și sincroniza fișierele în `android/` (`npx cap sync android`).
3. Compila și semna APK-ul Release (`./gradlew assembleRelease`), rezultând:
   `android/app/build/outputs/apk/release/app-release.apk`

### Varianta Cloud CI (Fără Android SDK Local)
Workflow-ul `.github/workflows/mobile-build.yml` compilează și semnează automat APK-ul pe GitHub Actions și publică artifact-ul `HidroDunare-signed.apk`.

---

## 3. iOS — Configurare Completă Xcode, APNs Push & Publicare

### Cerințe Obligatorii Apple
1. **Hardware & OS**: Mac (macOS 14+ Sonoma / Sequoia) cu **Xcode 16+**.
2. **Dependențe CLI**:
   ```bash
   sudo gem install cocoapods
   npm run build
   npx cap sync ios
   cd ios/App && pod install
   open App.xcworkspace
   ```
3. **Cont Apple Developer** (`developer.apple.com`, 99 USD/an pentru TestFlight & App Store; contul gratuit permite instalarea pe iPhone-ul propriu prin cablu cu re-semnare la 7 zile).

### Configurare Signing & Capabilities în Xcode
Deschideți `ios/App/App.xcworkspace` → Target **App** → Tab **Signing & Capabilities**:
1. Bifați **Automatically manage signing** și selectați **Team**-ul dvs. Apple.
2. Verificați **Bundle Identifier**: `ro.hidrodunare.app` (trebuie să fie unic global în App Store Connect).
3. Apăsați **+ Capability** și adăugați:
   - **Push Notifications**
   - **Background Modes** → bifați **Remote notifications** și **Background fetch**

### Configurare Notificări Push iOS (APNs)
1. În Apple Developer Portal → *Certificates, Identifiers & Profiles* → *Keys*, creați o cheie **Apple Push Notifications service (APNs)** (`.p8`).
2. Notați **Key ID** și **Team ID**.
3. Încărcați cheia `.p8` în Firebase Cloud Messaging (FCM) sau în serverul dvs. APNs pentru a trimite notificări push native către token-ul colectat de `@capacitor/push-notifications`.

### Setări Cheie în `ios/App/App/Info.plist`
Asigurați prezența următoarelor chei:
- `UIBackgroundModes`: `["remote-notification", "fetch"]`
- `NSLocationWhenInUseUsageDescription`: `"HidroDunăre folosește poziția pentru centrarea hărții pe cea mai apropiată stație de pe Dunăre."`
- `ITSAppUsesNonExemptEncryption`: `<false/>` (evită formularele suplimentare de conformitate criptografică la export în App Store Connect).

### Conectarea la Backend-ul Express din Aplicația Mobilă
În producție, aplicația mobilă încapsulată în WKWebView / WebView apelează API-ul (`/api/overview`, `/api/stations/:id`, `/api/alerts/stream`).
Setați variabila înainte de `npx cap sync`:
```bash
export CAPACITOR_SERVER_URL="https://url-ul-tau-cloud-run.run.app"
npm run build && npx cap sync
```

### Distribuție TestFlight & App Store
1. În Xcode selectați destinația **Any iOS Device (arm64)**.
2. Meniu **Product → Archive**.
3. În fereastra Organizer: **Distribute App → App Store Connect → Upload**.
4. Din `appstoreconnect.apple.com`, activați testarea internă/externă prin **TestFlight** sau trimiteți spre **App Review**.
