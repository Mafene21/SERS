# SERS Community — Flutter user app

A separate Flutter project for Android and web. There are **no user accounts, login, profile or settings screens**. Citizens report as guests. The existing Next.js dashboard remains at the repository root.

## Included

- Mobile interface for road accidents and fire outbreaks only.
- GPS location with a permission prompt, or explicit map selection and a landmark.
- Optional name, contact phone and scene photo (JPEG/PNG/WebP, up to 3 MB).
- Review before submission and a server-confirmed reference number.
- Private report tracking, on-device report history, restore via a private tracking code.
- In-app response updates while open: checks every 30 seconds, plus manual refresh.
- Idempotent retries: a failed connection does not create duplicate reports.
- Android project, manifest permissions, branding, and web support in this folder.

This is a university project prototype. It does not contact public emergency services or send SMS/push notifications. Submission requires internet. A report is only confirmed received when the server returns its reference number.

## Run and test here

The tested SDK is Flutter **3.35.1 / Dart 3.9.0**. Dependencies and their resolved versions are pinned in `pubspec.yaml` and `pubspec.lock`.

```bash
cd citizen-app
flutter --no-version-check pub get --enforce-lockfile
flutter --no-version-check run -d chrome
```

For a browser served over the local network:

```bash
flutter --no-version-check run -d web-server --web-hostname 0.0.0.0 --web-port 8080
```

Browser GPS requires HTTPS or localhost. When testing from a phone against a LAN HTTP address, use the map picker or the HTTPS deployment.

```bash
flutter --no-version-check analyze
flutter --no-version-check test
flutter --no-version-check build web --release --no-web-resources-cdn --pwa-strategy=none
```

The release output is `build/web/`; source remains in `lib/`. Open the **whole `citizen-app` folder** in Android Studio later, rather than opening the dashboard or only `android/`.

## Continue on the Android Studio PC

1. Clone/pull `https://github.com/Mafene21/SERS` and open `SERS/citizen-app`.
2. Install the Flutter and Dart plugins, Flutter SDK, Android SDK and emulator/device tools.
3. Select the installed Flutter SDK and run `flutter doctor` to resolve local setup requirements.
4. Run `flutter pub get --enforce-lockfile`, select an Android device/emulator and press Run.
5. Allow foreground location and camera/photo selection when requested. Permission denial still allows manual location selection and reporting without a photo.
6. For an installable test package, run `flutter build apk --debug`.

The Android project has not been built or tested on a physical Android device in this environment. A Play Store release needs your own signing configuration and current store requirements; debug signing is only for development.

## Shared backend and configuration

`SERS_API_URL` is a public endpoint, not a secret:

```bash
flutter run -d chrome --dart-define=SERS_API_URL=https://YOUR_PROJECT.supabase.co/functions/v1/sers-citizen
```

The default points to the existing SERS project. Flutter contains no service-role key, admin password or staff session. It calls the `sers-citizen` Edge Function. Shared backend migrations/functions live in `../supabase/` so the dashboard and app use one schema.

Each report has a random 256-bit private tracking key. Only its hash is stored in a private database schema. The key is sent in POST bodies/headers, never in public query strings. Reference numbers are not access credentials. History and tracking codes remain on the device; users can copy a private code to restore a report elsewhere. Clearing browser/app data loses local history unless the code was saved. Contact details and photos are restricted to authorized staff. Internal response notes and staff contact details are excluded from guest tracking responses.

Anonymous submission is intentionally supported. The server enforces payload validation, upload limits, a private photo bucket, request throttling, and submission limits. A shared IP is limited to 20 reports/hour and a device to 3 reports/10 minutes. Additional abuse controls can be added before a wider public rollout.

## Web hosting

Create/use a Vercel project with root directory **citizen-app**, framework **Other**, build command `bash scripts/build-web.sh`, install command `true`, output `build/web`. The build script uses a local Flutter SDK or downloads the pinned SDK revision from the official Flutter Git repository. Web and Android continue to use the same Dart source.
