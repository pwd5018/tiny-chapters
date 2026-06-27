# Tiny Chapters Development Setup

Phase 7 makes the installed Expo Development Build the primary daily workflow for Tiny Chapters. Expo Go is still useful for quick UI checks, but reminder testing, native permission prompts, and real-device debugging should happen in the development build.

## Prerequisites

- Node.js 22 LTS or newer on Windows
- npm that ships with that Node install
- Android Studio with Android SDK Platform Tools
- A physical Android phone with Developer Options enabled
- USB cable or Android wireless debugging
- A running Supabase project for auth and memory storage
- A running `photo-api/` instance when testing NAS mode

## Mobile app install

```powershell
npm install
```

Create `.env` from `.env.example` and keep real values local:

```text
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PHOTO_SOURCE_MODE=mock
EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=http://192.168.1.50:5055
EXPO_PUBLIC_NAS_PHOTO_API_KEY=change-me
```

Important:

- Every `EXPO_PUBLIC_*` value is bundled into the app and must be treated as public.
- `EXPO_PUBLIC_SUPABASE_URL` is safe to expose.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` is intended for client apps, but still should not be pasted casually into screenshots or docs.
- `EXPO_PUBLIC_PHOTO_SOURCE_MODE` is safe to expose.
- `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL` is safe to expose if you are comfortable sharing the host address.
- `EXPO_PUBLIC_NAS_PHOTO_API_KEY` is not a real secret once shipped inside a mobile build. Keep it out of git, use it only for personal/dev use, and plan to replace this auth model before any wider distribution.

## Environment strategy

Tiny Chapters currently supports two practical app environments:

- `development`
  Use this for local work, LAN Photo API access, and installed dev builds.
- `production`
  Reserved for future release work. Do not point this repo at a production mobile workflow yet.

Photo API endpoints should be changed only through `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL`.

Examples:

- LAN
  `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=http://192.168.1.50:5055`
- Tailscale later
  `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=http://100.x.x.x:5055`
- Future cloud
  `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=https://photo-api.example.com`

Photo source mode is still controlled by:

- `EXPO_PUBLIC_PHOTO_SOURCE_MODE=mock`
- `EXPO_PUBLIC_PHOTO_SOURCE_MODE=nas`

## Daily workflow

1. Start the Photo API when testing NAS mode.
2. Start Metro in dev-client mode.
3. Launch the installed Development Build on the phone.
4. Make code changes.
5. Let hot reload update the device.
6. Test on the physical phone.
7. Commit changes.

Recommended commands:

```powershell
npm run photo-api:dev
npm run dev
```

If Metro cache gets stale:

```powershell
npm run start:clear
```

## Building and installing the Development Build

First-time or after native config changes:

```powershell
npm run android
```

For a specific attached phone:

```powershell
npm run android:device
```

Expo Go is no longer the main validation path for:

- `expo-notifications`
- camera and gallery permission prompts
- installed-app deep link behavior
- device-specific debugging

## Android phone setup

1. On the phone, enable Developer Options.
2. Enable USB debugging.
3. Connect the phone over USB.
4. Accept the RSA debugging prompt on the phone.
5. Confirm the phone is visible:

```powershell
adb devices
```

Optional wireless debugging:

```powershell
adb tcpip 5555
adb connect PHONE_IP:5555
adb devices
```

If `adb` is not on `PATH`, use Android Studio's Platform Tools path or add it to your shell profile.

## Photo API verification

Tiny Chapters should point at the host machine or mini-PC address, not `localhost`, when the app runs on a phone.

Check the service directly from the host:

```powershell
cd photo-api
npm run status
```

From the app:

- enable Developer Mode in Settings
- look at the startup environment banner
- open `Developer Mode -> Diagnostics`
- run `Test NAS /health`
- run `Test NAS /status`

## Supabase verification

From the app:

- sign in
- enable Developer Mode
- open Diagnostics
- run `Test Supabase Connection`

The startup diagnostics log also records whether Supabase was reachable when the authenticated app shell started.

## Notifications verification

Reminder validation should happen in the installed Development Build, not Expo Go.

Current workflow:

1. Open Settings.
2. Allow notifications.
3. Save reminder settings.
4. Tap `Test Notification`.
5. Confirm the notification appears on the phone.

Later phases should add fuller real-device reminder timing checks, but Phase 7 already makes the installed dev build the correct place to test them.

## Troubleshooting

- Metro opens but the phone does not connect
  Confirm both devices are on the same network or use USB debugging first.
- App cannot reach the Photo API
  Use a LAN or Tailscale IP, not `localhost`. Also check Windows Firewall for port `5055`.
- Notifications do not fire
  Make sure you are in the Development Build and Android permission is granted.
- Dev build feels stale after native config changes
  Re-run `npm run android` so the installed build includes the new native config.
- Env updates do not appear
  Restart Metro with `npm run start:clear`.
- Typecheck passes but the phone still behaves differently
  Treat that as expected. Typecheck is not runtime validation.
