# Tiny Chapters iOS Readiness

This checklist reflects the repo after Phase 8. Tiny Chapters is being prepared for future iPhone support, but it is not fully validated or released on iOS yet. Android remains the primary daily-driver workflow.

## Current readiness status

Overall status: partially prepared, not validated on real iPhone hardware.

What is now in place:

- `app.json` includes an iOS bundle identifier plus development-safe camera, photo library, photo-library-add, and local-network usage descriptions
- permission handling is centralized in `src/services/permissions/permissionService.ts`
- notification channel setup stays Android-only inside `src/services/notifications/reminderService.ts`
- date and time pickers already live behind shared components with Android and iOS-specific behavior contained there
- Developer Diagnostics now include an `iOS Readiness` section with bundle id, permission states, photo mode, Photo API URL, and iOS-specific NAS warnings
- Photo API base URL remains centralized through `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL`

What is still not done:

- no generated `ios/` native project exists in the repo yet
- no real iPhone validation has been run for camera, photo library, reminders, or NAS reachability
- no TestFlight or release-signing work has started
- no Apple Developer account is required yet for this phase
- no managed icon/splash source assets are committed yet for future iOS sync

## Cross-platform pieces already in good shape

- Expo Router structure and navigation
- Supabase auth and memory persistence
- service-layer routing for memories, photos, reminders, diagnostics, and permissions
- `expo-image-picker` usage for camera and library flows
- `@react-native-community/datetimepicker` behind shared `DatePickerField` and `TimePickerField`
- local reminder scheduling architecture
- centralized Photo API URL switching for LAN, future Tailscale, or future cloud access

## App config audit

Current config findings:

- `ios.bundleIdentifier`
  Set to `com.anonymous.tinychapters`
- `ios.infoPlist`
  Now includes `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`, and `NSLocalNetworkUsageDescription`
- `expo-image-picker` plugin
  Already configured with camera and photo-library wording
- `expo-notifications` plugin
  Present with Android default channel configuration; iOS behavior still needs real-device validation later
- icon and splash source config
  Not fully prepared yet because the repo does not currently include managed source assets for a future iOS prebuild sync

## Permission strings and behavior

Current iOS permission wording in config is intentionally development-safe:

- Camera
  Attach a fresh family moment to a memory during development testing
- Photo library
  Attach a phone photo as a temporary reference while the original stays outside Supabase
- Photo library add
  Save a captured photo to the library before referencing it from a memory during development testing
- Local network
  Reach a local Photo API on the home network for NAS photo references during development testing

Notes:

- local notification permission on iOS still needs real-device prompt validation
- photo-library limited access is now tolerated in code for attach flow, but still needs iPhone testing

## Camera testing checklist

- Install or generate an iOS development build later
- Open Today and use `Take Photo`
- Confirm camera permission prompt appears once and can be re-checked in Diagnostics
- Confirm captured photo preview renders
- Confirm saved memory stores metadata-only reference behavior, not a Supabase upload
- Confirm captured photo can still relink later if NAS indexing catches up

## Media library testing checklist

- Open Today and use `Attach from Phone`
- Test both full access and limited-library access on iPhone
- Confirm selected photos preview correctly after selection
- Confirm saved refs keep `localUri` as temporary metadata only
- Confirm memories remain readable if the local asset later becomes unavailable
- Confirm the app does not require free-form date entry anywhere in the flow

## Notifications testing checklist

- Install a real iOS development build
- Request notification permission from Settings
- Save enabled reminder settings
- Confirm scheduled reminder count and next reminder look sensible in Diagnostics
- Send a test notification
- Tap the delivered notification and confirm Tiny Chapters opens cleanly
- Validate reminder scheduling again after app relaunch

Important:

- Android notification channels are correct and should remain Android-only
- iOS notification delivery and presentation remain unverified until tested on hardware

## NAS and Tailscale checklist

- Confirm the iPhone can reach the configured Photo API URL
- Do not use `localhost` for phone testing because it points to the phone itself
- If using LAN access, confirm the host IP is reachable from the phone
- If using future Tailscale access, switch only `EXPO_PUBLIC_NAS_PHOTO_API_BASE_URL`
- Re-test NAS picker, thumbnails, search, and folder browsing on iPhone
- Re-test memory detail previews and pending NAS relink behavior

## URI and local-photo risks

Known risks that still need real iPhone validation:

- iOS photo asset URIs may differ from Android in format and lifespan
- limited photo-library access can affect later preview behavior
- `file://` handling can differ from Android expectations
- background access to local assets can be more restrictive
- phone-local refs are device-specific and should never be treated as durable cross-device storage

Current stance:

- keep `localUri` temporary
- keep NAS refs durable when available
- do not upload original photos or thumbnails to Supabase

## NAS/local-network concerns for iPhone

Current concerns to validate later:

- the iPhone must be able to reach the LAN, Tailscale, or later cloud URL directly
- `localhost` means the phone itself, not the Windows host machine
- plain HTTP may work for personal testing but should be reviewed later for broader distribution expectations
- local network privacy prompts may matter depending on how access is performed
- Tailscale remains the preferred future remote-access direction

## Known blockers

- no real iPhone hardware validation yet
- no `ios/` project generated yet
- no Apple Developer account or TestFlight setup yet
- no managed icon/splash source assets committed yet
- NAS HTTP and reachability assumptions are documented, not validated on iPhone

## Apple Developer account requirement

An Apple Developer account is not needed for Phase 8.

It becomes needed later for:

- smooth real-device signing workflows
- TestFlight distribution
- eventual App Store release work

## Next steps before the first iOS build

1. Generate the iOS project from the current Expo config.
2. Decide whether `com.anonymous.tinychapters` should remain the long-term bundle identifier.
3. Add proper managed icon and splash source assets.
4. Run a real iPhone dev-build pass for camera, library, reminders, and NAS reachability.
5. Revisit NAS networking expectations for LAN and future Tailscale use.
6. Only after that, plan the first TestFlight-focused phase.
