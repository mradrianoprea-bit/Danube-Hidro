#!/usr/bin/env bash
set -euo pipefail

# Script complet pentru compilarea aplicației native iOS HidroDunăre (Capacitor 8 + SwiftPM)
# Cerințe locale: macOS 14+, Xcode 16+, Node.js 22+

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo ">>> 1. Instalare dependențe & build frontend Vite..."
if [ ! -d node_modules ]; then
  npm install --legacy-peer-deps --no-audit --no-fund
fi
npm run build

echo ">>> 2. Sincronizare Capacitor iOS (Swift Package Manager)..."
if [ ! -d ios ]; then
  npx cap add ios
fi
npx cap sync ios

if [[ "${1:-}" == "--archive" ]]; then
  echo ">>> 3. Compilare Release iOS (fără semnare automată)..."
  cd "$APP_DIR/ios/App"
  xcodebuild \
    -project App.xcodeproj \
    -scheme App \
    -configuration Release \
    -destination 'generic/platform=iOS' \
    -derivedDataPath build \
    CODE_SIGNING_ALLOWED=NO \
    build
  mkdir -p build/Payload
  cp -R build/Build/Products/Release-iphoneos/App.app build/Payload/
  (cd build && zip -r HidroDunare-ios-unsigned.ipa Payload)
  echo ">>> IPA generat la: $APP_DIR/ios/App/build/HidroDunare-ios-unsigned.ipa"
else
  echo ">>> 3. Deschidere proiect în Xcode pentru semnare și rulare pe iPhone / App Store..."
  npx cap open ios
fi
