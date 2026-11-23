#!/usr/bin/env bash
set -euo pipefail

# Script complet pentru compilarea și semnarea APK-ului Android HidroDunăre (Capacitor)
# Cerințe locale: Node.js 20+, JDK 17+, Android SDK (Build-Tools 35)

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

KEYSTORE_PATH="$APP_DIR/android/hidrodunare-release.jks"
KEYSTORE_PROPS="$APP_DIR/android/keystore.properties"

if [ ! -f "$KEYSTORE_PATH" ]; then
  echo ">>> Generare keystore JKS nou pentru semnare Release..."
  KEY_PASS="${ANDROID_KEYSTORE_PASSWORD:-HidroDunare2026!}"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE_PATH" \
    -alias hidrodunare \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass "$KEY_PASS" \
    -keypass "$KEY_PASS" \
    -dname "CN=HidroDunare, OU=Hidrologie, O=HidroDunare, L=Bucuresti, S=Bucuresti, C=RO"

  cat > "$KEYSTORE_PROPS" <<EOF
storeFile=hidrodunare-release.jks
storePassword=$KEY_PASS
keyAlias=hidrodunare
keyPassword=$KEY_PASS
EOF
fi

echo ">>> 1. Build frontend Vite..."
npm run build

echo ">>> 2. Sincronizare Capacitor Android..."
npx cap sync android

echo ">>> 3. Compilare & Semnare APK Release via Gradle..."
cd "$APP_DIR/android"
chmod +x ./gradlew
./gradlew assembleRelease

APK_OUT="$APP_DIR/android/app/build/outputs/apk/release/app-release.apk"
echo ">>> APK compilat și semnat disponibil la: $APK_OUT"
