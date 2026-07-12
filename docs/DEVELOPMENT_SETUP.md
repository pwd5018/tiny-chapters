# Tiny Chapters Development Setup

Phase 7 makes the installed Expo Development Build the primary daily workflow for Tiny Chapters. Phase 7.1 adds repo-level tooling so Metro stays on a fixed port and the Android rebuild path is one command instead of a handful of manual steps. Expo Go is still useful for quick UI checks, but reminder testing, native permission prompts, and real-device debugging should happen in the development build.

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
EXPO_DEV_SERVER_MODE=local
EXPO_DEV_SERVER_HOST=
```

Important:

- Every `EXPO_PUBLIC_*` value is bundled into the app and must be treated as public.
- `EXPO_PUBLIC_SUPABASE_URL` is safe to expose.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` is intended for client apps, but still should not be pasted casually into screenshots or docs.
- `EXPO_PUBLIC_PHOTO_SOURCE_MODE` is safe to expose.
- `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL` is safe to expose if you are comfortable sharing the host address.
- `EXPO_PUBLIC_NAS_PHOTO_API_KEY` is not a real secret once shipped inside a mobile build. Keep it out of git, use it only for personal/dev use, and plan to replace this auth model before any wider distribution.
- Provider keys for OpenAI, Groq, or Gemini should never go in the Expo app `.env`. Keep them only in `photo-api/.env` because the mobile bundle treats `EXPO_PUBLIC_*` values as public.
- `EXPO_DEV_SERVER_MODE` controls how `npm run dev`, `npm run start:clear`, `npm run android:launch`, and `npm run rebuild` pick the Metro host. Use `local` for home-network LAN work, `tailscale` for remote dev-client work, or leave it unset for the older auto behavior.
- `EXPO_DEV_SERVER_HOST` is the specific host override used when the mode needs a fixed host, especially Tailscale. It is not bundled into the app.

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
- Tailscale
  `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=http://100.x.x.x:5055`
- Future cloud
  `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=https://photo-api.example.com`

Metro host examples:

- local home-network development
  `EXPO_DEV_SERVER_MODE=local`
- away-from-home development through Tailscale
  `EXPO_DEV_SERVER_MODE=tailscale`
  `EXPO_DEV_SERVER_HOST=100.101.102.103`

Photo source mode is still controlled by:

- `EXPO_PUBLIC_PHOTO_SOURCE_MODE=mock`
- `EXPO_PUBLIC_PHOTO_SOURCE_MODE=nas`

## Daily workflow

Normal JS and TS work does not need a rebuild.

1. Start the Photo API when testing NAS mode.
2. Start Metro on port `8081`.
3. Open the already-installed Tiny Chapters development build on the phone.
4. Make code changes.
5. Let hot reload update the device.
6. Test on the physical phone.
7. Commit changes.

Recommended commands:

```powershell
npm run photo-api
npm run dev
```

If Metro cache gets stale:

```powershell
npm run start:clear
```

If the app is already installed but needs to reconnect to Metro without a rebuild:

```powershell
npm run android:launch
```

If you want a preflight check of your local setup:

```powershell
npm run doctor
```

## Building and installing the Development Build

Use a rebuild when any native dependency, Android config, Expo plugin config, package-level native module, or generated native project setting changes.

Recommended rebuild command:

```powershell
npm run rebuild
```

`npm run rebuild` will:

- verify Java, `JAVA_HOME`, `adb`, and an authorized phone
- ensure Metro is running on `8081`
- start Metro in a new PowerShell window if it is not already running
- build and install the Android development client
- launch the installed app back to the correct Metro URL

The older raw install commands still exist when you want the lower-level Expo behavior directly:

```powershell
npm run android
npm run android:device
```

These repo scripts now do two Windows-specific setup steps automatically before they call Expo:

- set `JAVA_HOME` from Android Studio's bundled JDK when possible
- use `C:\Users\wolf-ai\AppData\Local\tc-gradle` as `GRADLE_USER_HOME` to avoid the default user-profile cache and lock issues

The repo now also fixes Metro to port `8081` for all dev-client flows. That matches the default Expo development-client expectation and avoids the confusing case where Metro falls back to `8082` while the installed app still looks for `8081`.

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

`npm run doctor` and the rebuild scripts will also look for `adb` inside the standard Android SDK Platform Tools folder under `%LOCALAPPDATA%\Android\Sdk`.

## Metro host and LAN IP selection

`npm run android:launch` and `npm run rebuild` launch the dev client with a URL shaped like:

```text
tinychapters://expo-development-client/?url=http://YOUR_LAN_IP:8081
```

The scripts choose the host in this order:

1. `EXPO_DEV_SERVER_HOST` if you set it in your shell
2. the first likely Wi-Fi or Ethernet IPv4 address that is up and not loopback

The auto-detection tries to avoid loopback, disconnected adapters, and obvious virtual adapters.

If you want to force a specific address for USB, Wi-Fi, Tailscale, or a multi-adapter machine, you can either set it in the shell for one session or keep it in `.env` as a persistent local toggle:

```powershell
$env:EXPO_DEV_SERVER_HOST='192.168.1.50'
npm run android:launch
```

```text
EXPO_DEV_SERVER_MODE=tailscale
EXPO_DEV_SERVER_HOST=100.101.102.103
```

With that `.env` value in place, `npm run dev`, `npm run start:clear`, `npm run android:launch`, and `npm run rebuild` will all reuse the same host automatically.

Use USB debugging first if the phone and computer are not reliably reachable over Wi-Fi. The app still needs to reach the host machine on port `8081`.

## Photo API verification

Tiny Chapters should point at the host machine or mini-PC address, not `localhost`, when the app runs on a phone.

Phase 12 remote-access stance:

- keep the same Photo API on the Windows host or mini-PC
- keep port `5055`
- run Tailscale on both the phone and the Photo API host
- switch only `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL` between LAN and Tailscale-reachable hostnames or IPs
- do not open router ports for Tiny Chapters
- Android remote Photo API access through Tailscale is now confirmed in the current workflow

Example:

- home LAN
  `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=http://192.168.1.50:5055`
- away from home through Tailscale
  `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL=http://100.101.102.103:5055`

Check the service directly from the host:

```powershell
cd photo-api
npm run status
```

From the app:

- enable Developer Mode in Settings
- look at the startup environment banner
- confirm the Metro path says `LAN` or `Tailscale` for the currently connected dev server
- open `Developer Mode -> Diagnostics`
- confirm the Metro network path reflects the current dev-server host
- confirm the Photo API network path says `LAN` or `Tailscale` instead of `Localhost only`
- run `Test NAS /health`
- run `Test NAS /status`

Important:

- Tailscale remote access for Tiny Chapters is primarily about the Photo API on port `5055`.
- Metro on port `8081` is only needed when you are actively loading a new JS bundle or using hot reload from the development machine.
- `EXPO_DEV_SERVER_MODE=local` is the normal home-network default.
- For away-from-home dev-client use, set `EXPO_DEV_SERVER_MODE=tailscale` and point `EXPO_DEV_SERVER_HOST` at the host machine's Tailscale IP in `.env`.

If you want real AI-guided memory follow-ups or cleanup:

1. open `photo-api/.env`
2. set `AI_PROVIDER` to `openai`, `groq`, or `gemini`
3. add the matching provider key and model there
4. restart `photo-api`

The mobile app reuses the existing local gateway URL and bearer token. Provider secrets remain server-side in `photo-api/.env`.

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

- Port `8081` is already occupied
  Run `npm run doctor` first. If the port belongs to Metro, you can keep using it.
  If the port belongs to some other process, the scripts will show the PID and process name instead of killing it automatically.
  You can stop that process manually, or rerun the rebuild script with:
  ```powershell
  powershell -ExecutionPolicy Bypass -File ./scripts/rebuild-android.ps1 -ForcePortKill
  ```
- `JAVA_HOME` is not set and Gradle cannot find Java
  On this machine, Android Studio already includes a valid JDK at `C:\Program Files\Android\Android Studio\jbr`.
  Temporary fix for the current PowerShell session:
  ```powershell
  $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
  $env:Path = "$env:JAVA_HOME\bin;" + $env:Path
  ```
  Then rerun `npm run android` or `npm run android:device`.
- Gradle fails under `C:\Users\...\ .gradle` with lock or access-denied errors
  The repo's Android scripts now set `GRADLE_USER_HOME` to `C:\Users\wolf-ai\AppData\Local\tc-gradle` automatically so Gradle stays out of the user-profile default cache and out of the repo tree. If you run Gradle manually, set it yourself first:
  ```powershell
  $env:GRADLE_USER_HOME='C:\Users\wolf-ai\AppData\Local\tc-gradle'
  ```
- Gradle fails moving transform or data binding workspaces inside `.gradle-local`
  The repo's Android script now forces a more conservative Windows-friendly Gradle mode by disabling the daemon, build cache, parallel execution, and file-system watching for `npm run android` and `npm run android:device`.
- Metro opens but the phone does not connect
  Confirm both devices are on the same network or use USB debugging first.
  Then run `npm run android:launch` so the installed dev client reconnects to the current `http://HOST:8081` URL.
- Metro starts on the wrong port
  Use the repo scripts instead of raw `expo start`. `npm run dev` and `npm run start:clear` now force `8081`.
- App cannot reach the Photo API
  Use a LAN or Tailscale IP, not `localhost`. Also check Windows Firewall for port `5055`, confirm Tailscale is connected on both devices for remote use, and re-check the diagnostics network-path label.
- Notifications do not fire
  Make sure you are in the Development Build and Android permission is granted.
- Dev build feels stale after native config changes
  Re-run `npm run rebuild` so the installed build includes the new native config and reconnects to the correct Metro URL.
- Env updates do not appear
  Restart Metro with `npm run start:clear`.
- Typecheck passes but the phone still behaves differently
  Treat that as expected. Typecheck is not runtime validation.
