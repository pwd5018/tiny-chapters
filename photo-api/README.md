# Tiny Chapters Photo API

This local service indexes photos from a NAS shared folder and exposes the LAN API that Tiny Chapters mobile can call.

It can also act as the local AI gateway for guided memory follow-ups and optional cleanup or polish suggestions, so provider keys stay on the server side instead of inside the Expo mobile bundle.

## Install

```powershell
cd photo-api
npm install
```

## Configure

Copy `.env.example` to `.env` and set values like:

```text
PORT=5055
PHOTO_LIBRARY_ROOT=\\\\NAS_NAME\\Photos
PHOTO_API_KEY=change-me
ENABLE_SCHEDULED_SCAN=false
SCHEDULED_SCAN_TIME=02:00
SCHEDULED_SCAN_TIMEZONE=America/New_York
THUMBNAIL_CACHE_DIR=./cache/thumbnails
DATABASE_PATH=./data/photo-index.sqlite
AI_PROVIDER=openai
OPENAI_API_KEY=your-openai-key
OPENAI_MODEL=your-openai-model-id
```

Supported roots:
- UNC path: `\\\\NAS_NAME\\Photos`
- mapped drive: `Z:\\Photos`

AI provider notes:
- `AI_PROVIDER` may be `openai`, `groq`, or `gemini`
- keep provider API keys only in `photo-api/.env`
- do not add provider secrets to the Expo app `.env` because `EXPO_PUBLIC_*` values are bundled into the mobile app

## Commands

Start dev server:

```powershell
npm run dev
```

Build:

```powershell
npm run build
```

Run built server:

```powershell
npm run start
```

Index photos from the command line:

```powershell
npm run scan
```

Print operational status:

```powershell
npm run status
```

## Incremental scan behavior

Scans now persist progress as they run and recover more cleanly after interruption.

What this means:
- already indexed files are kept in SQLite as the scan progresses
- if a scan is interrupted, the next run marks the old scan as failed/interrupted
- future scans skip files that are already indexed and unchanged based on:
  - current path
  - file size
  - last modified timestamp

So a follow-up scan does not need to fully re-hash every previously indexed file.

Search and folder browsing apply filtering, sorting, counting, and pagination in SQLite rather than loading the entire active catalog into Node memory. Changed files are processed with bounded concurrency to reduce NAS idle time without allowing an unbounded request fan-out.

## Verify endpoints

Health check without auth:

```powershell
curl http://localhost:5055/health
```

All photo, folder, status, scan, and match endpoints require the bearer token. The health endpoint is intentionally public so a device can perform a basic reachability check before sending credentials.

Status with auth:

```powershell
curl -H "Authorization: Bearer change-me" http://localhost:5055/status
```

AI status with auth:

```powershell
curl -H "Authorization: Bearer change-me" http://localhost:5055/ai/status
```

Trigger scan with auth:

```powershell
curl -X POST -H "Authorization: Bearer change-me" -H "Content-Type: application/json" -d "{\"mode\":\"incremental\"}" http://localhost:5055/index/scan
```

Trigger a full rescan placeholder mode:

```powershell
curl -X POST -H "Authorization: Bearer change-me" -H "Content-Type: application/json" -d "{\"mode\":\"full\"}" http://localhost:5055/index/scan
```

Cancel placeholder:

```powershell
curl -X POST -H "Authorization: Bearer change-me" http://localhost:5055/index/cancel
```

Match a likely NAS photo by metadata:

```powershell
curl -H "Authorization: Bearer change-me" "http://localhost:5055/photos/match?filename=IMG_4432.jpg&takenAt=2026-06-17T14:22:00.000Z&fileSize=3442231&width=4032&height=3024"
```

Generate guided follow-up questions with auth:

```powershell
curl -X POST -H "Authorization: Bearer change-me" -H "Content-Type: application/json" -d "{\"baseQuestion\":\"What tiny moment felt worth keeping?\",\"originalAnswer\":\"He wore the blue shirt and looked tired.\"}" http://localhost:5055/ai/follow-ups
```

Generate a polished memory suggestion with auth:

```powershell
curl -X POST -H "Authorization: Bearer change-me" -H "Content-Type: application/json" -d "{\"baseQuestion\":\"What tiny moment felt worth keeping?\",\"originalAnswer\":\"He wore the blue shirt and looked tired.\",\"composedText\":\"He wore the blue shirt and looked tired.\",\"followUps\":[\"He still smiled at dinner.\"]}" http://localhost:5055/ai/polish
```

## Built-in scheduled scans

The server can run one scan per day without Task Scheduler.

Enable it in `.env`:

```text
ENABLE_SCHEDULED_SCAN=true
SCHEDULED_SCAN_TIME=02:00
SCHEDULED_SCAN_TIMEZONE=America/New_York
```

Notes:
- `ENABLE_SCHEDULED_SCAN=false` or missing means the server will not auto-scan
- scheduled scans reuse the same scan history and overlap protection as `npm run scan`
- `mode=full` currently behaves like `incremental` and is reserved for deeper cleanup later
- the server logs the next scheduled scan time at startup

To test it locally:
- set `SCHEDULED_SCAN_TIME` a few minutes ahead
- restart the server
- watch the server log
- confirm `/status` shows `nextScheduledScanAt` and then updates after the scheduled run

## Scheduled scans on Windows

Option A: development
- run `npm run dev`

Option B: mini PC or always-on Windows machine
- run `npm run build`
- run `npm run start`
- configure a Windows startup task on login
- optionally add a nightly `npm run scan` task if you do not want to use the built-in scheduler

Using Windows Task Scheduler:

Startup task on login:

1. Open `Task Scheduler`
2. Create a new task
3. Trigger: `At log on`
4. Action:
   - Program/script: `C:\Program Files\nodejs\npm.cmd`
   - Start in: `C:\Users\wolf-ai\Workspace\tiny-chapters\photo-api`
   - Arguments: `run start`

Nightly scan task if you are not using the built-in scheduler:

1. Create another task
2. Trigger: nightly
3. Action:
   - Program/script: `C:\Program Files\nodejs\npm.cmd`
   - Start in: `C:\Users\wolf-ai\Workspace\tiny-chapters\photo-api`
   - Arguments: `run scan`

Important:
- mapped drives like `Z:\` can fail inside scheduled tasks
- prefer UNC paths like `\\\\NAS_NAME\\Photos`
- the Windows account running the task must have access to the NAS share
- `Run whether user is logged on or not` can break NAS credentials or share visibility
- start with `Run only when user is logged on`

## Recommended local verification order

1. `npm run build`
2. `npm run start`
3. `curl http://localhost:5055/health`
4. `curl -H "Authorization: Bearer change-me" http://localhost:5055/status`
5. `curl -X POST -H "Authorization: Bearer change-me" -H "Content-Type: application/json" -d "{\"mode\":\"incremental\"}" http://localhost:5055/index/scan`
6. call `/status` again and confirm scan fields changed
7. set `ENABLE_SCHEDULED_SCAN=true`
8. set `SCHEDULED_SCAN_TIME` a few minutes ahead
9. restart the server
10. confirm the scheduled scan runs and `/status` updates

## Troubleshooting

- Android cannot reach `localhost`
  - use the PC or mini-PC LAN IP instead
- Windows firewall blocks `5055`
  - allow inbound TCP on port `5055`
- NAS path is wrong or unreadable
  - verify `PHOTO_LIBRARY_ROOT` manually in File Explorer
- NAS credentials are not saved on Windows
  - the service can only read what the Windows account can access
- UNC path escaping
  - use double backslashes in `.env`, for example `\\\\NAS_NAME\\Photos`
- auth token mismatch
  - the bearer token in app `.env` must match `PHOTO_API_KEY`
- no photos for a date
  - EXIF dates may differ from what you expect
- HEIC thumbnail limitations
  - support depends on the host machine's image decoding stack
- built server env loading
  - run `npm run start` from the `photo-api` folder so `.env` resolves correctly

## Notes

- `/health` does not require auth.
- All other routes, including `/ai/*`, require `Authorization: Bearer <PHOTO_API_KEY>`.
- Open Windows Firewall for port `5055` if testing from a phone.
- From an Android phone, use the PC or mini-PC LAN IP, not `localhost`.
- This service can later move from a laptop to a mini PC without changing the mobile app architecture.
