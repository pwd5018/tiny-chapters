# Tiny Chapters iOS Readiness

This file is the checklist for future iPhone and TestFlight work. Phase 7 does not implement full iOS support. It documents what already looks portable, what is still Android-first, and what should be tested on a real iPhone later.

## Current status

Current compatibility status: partial.

What is already in good shape:

- Expo Router app structure is platform-neutral
- Supabase client setup is cross-platform
- `expo-image-picker` plugin is configured with camera and photo-library copy
- `@react-native-community/datetimepicker` usage is already wrapped in shared components with iOS modal handling
- reminder scheduling logic is mostly service-level and avoids screen-level Android branching
- app scheme `tinychapters` exists in app config
- Photo API base URL is centralized for future LAN, Tailscale, or cloud switching

What is not implemented yet:

- no generated `ios/` native project in the repo right now
- no iPhone device validation has been run in this phase
- no APNs/TestFlight/release signing setup exists yet
- no iOS-specific notification entitlement validation has been done

## Dependency audit

Dependency status is based on the current Expo SDK 54 repo state.

| Package | Expo Go | Development Build | Android | Future iOS | Notes |
| --- | --- | --- | --- | --- | --- |
| `expo` / `react-native` / `expo-router` | Yes | Yes | Yes | Yes | Core app stack. |
| `expo-dev-client` | No | Required | Yes | Yes | Needed for installed development builds. |
| `expo-notifications` | Limited on Expo Go Android | Yes | Yes | Yes | Real testing should happen in dev build. iOS will need real-device prompt and APNs-path validation later. |
| `expo-image-picker` | Yes for basic use | Yes | Yes | Yes | Already configured through plugin permission text. Limited-library behavior still needs iPhone testing. |
| `@react-native-community/datetimepicker` | Yes | Yes | Yes | Yes | Already abstracted behind shared date/time field components. |
| `expo-secure-store` | Yes | Yes | Yes | Yes | Used for Supabase auth persistence. |
| `@react-native-async-storage/async-storage` | Yes | Yes | Yes | Yes | Used for reminder and developer-mode state. |
| `expo-constants` | Yes | Yes | Yes | Yes | Used for runtime/environment labeling. |
| `react-native-url-polyfill` | Yes | Yes | Yes | Yes | Supports Supabase networking assumptions. |
| `expo-linking` | Yes | Yes | Yes | Yes | Present, but only the app scheme is actively used today. |
| `expo-asset` / `expo-status-bar` / vector icons | Yes | Yes | Yes | Yes | No current platform blocker. |

Unused or not currently present:

- `expo-media-library` is not currently installed.
- `expo-file-system` is not currently installed.
- background task packages are not currently installed.
- share-sheet flows are not currently implemented.

## Android-specific assumptions found

These are acceptable today but should stay behind service or component boundaries:

- `src/services/notifications/reminderService.ts`
  Android notification channel creation is Android-only, which is correct and already isolated.
- `src/components/DatePickerField.tsx`
  Android uses inline picker events while iOS uses a modal spinner.
- `src/components/TimePickerField.tsx`
  Same pattern as date picker and already abstracted cleanly.
- `app/(tabs)/index.tsx` and `src/components/AuthScreen.tsx`
  `KeyboardAvoidingView` uses `Platform.OS === "ios"` behavior switching, which is fine.

No platform checks currently need to be pushed further down than they already are.

## Risk areas for future iPhone testing

- Notification permissions and delivery
  iOS prompt timing, reminder scheduling, and tapped-notification routing need real-device testing.
- Photo picker and camera permissions
  iOS may show limited-library access states that Android does not.
- Local photo reference URIs
  Captured or attached photo URI formats can differ from Android and should be verified against preview rendering and relink metadata storage.
- Installed development build behavior
  The new developer banner labels runtime correctly, but we have not yet confirmed the iOS dev-client path on a real device.
- Splash/icon parity
  Android native resources already exist, but the repo does not yet include managed source assets for a future iOS prebuild sync.

## Expected iOS permission prompts later

- Camera access for `Take Photo`
- Photo library access for `Attach from Phone`
- Notification permission for local memory reminders

If limited photo-library access is chosen, verify that the app still handles selected images gracefully.

## Future work before TestFlight

1. Install Xcode and generate the `ios/` project with the current Expo config.
2. Confirm `com.anonymous.tinychapters` is still the desired bundle identifier.
3. Add and verify iOS app icons and splash source assets, not just Android-generated native resources.
4. Validate camera, photo picker, Today save flow, memory edit flow, and NAS picker behavior on a real iPhone.
5. Validate local reminder permissions, scheduling, and tap-through behavior on a real iPhone.
6. Review whether the current NAS API auth model is acceptable for any distribution broader than personal use.
7. Prepare release signing, push-notification capability decisions, and TestFlight metadata.

## Apple Developer account requirement

You can do some simulator work without a paid Apple Developer account, but real TestFlight distribution requires an Apple Developer Program membership. Real-device install workflows are also much smoother with a properly configured Apple account.

## Known limitations

- Tiny Chapters is still daily-driver-ready on Android first.
- iOS readiness is documented, not completed.
- No real iPhone validation has happened in this phase.
- Notification behavior should be considered unverified on iOS until tested on hardware.
