#!/usr/bin/env bash
set -euo pipefail
# Reproduce the tested SDK on hosts such as Vercel that do not ship Flutter.
SDK_VERSION=3.35.1
SDK_REVISION=20f82749394e68bcfbbeee96bad384abaae09c13
if command -v flutter >/dev/null 2>&1; then
  FLUTTER_EXECUTABLE=$(command -v flutter)
else
  SERS_SDK_DIR="${PWD}/.tooling/flutter"
  if [ ! -x "$SERS_SDK_DIR/bin/flutter" ]; then
    git clone --depth 1 --branch "$SDK_VERSION" https://github.com/flutter/flutter.git "$SERS_SDK_DIR"
  fi
  if [ "$(git -C "$SERS_SDK_DIR" rev-parse HEAD)" != "$SDK_REVISION" ]; then
    echo 'The downloaded Flutter revision does not match the tested SDK.' >&2
    exit 1
  fi
  FLUTTER_EXECUTABLE="$SERS_SDK_DIR/bin/flutter"
fi
export CI=true
export FLUTTER_SUPPRESS_ANALYTICS=true
"$FLUTTER_EXECUTABLE" --no-version-check pub get --enforce-lockfile
"$FLUTTER_EXECUTABLE" --no-version-check build web --release --no-web-resources-cdn --pwa-strategy=none
