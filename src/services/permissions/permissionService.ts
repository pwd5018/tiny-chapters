import * as ImagePicker from "expo-image-picker";
import type { NotificationPermissionsStatus } from "expo-notifications";

import { isExpoGoRuntime } from "@/config/appConfig";
import type { ReminderPermissionStatus } from "@/types/reminder";

export type AppPermissionStatus = "granted" | "limited" | "denied" | "undetermined";

type ExpoNotificationsModule = typeof import("expo-notifications");

let notificationsModulePromise: Promise<ExpoNotificationsModule | null> | null = null;

function mapNotificationPermissionStatus(
  status: NotificationPermissionsStatus
): ReminderPermissionStatus {
  const granted = "granted" in status ? Boolean(status.granted) : false;
  const canAskAgain = "canAskAgain" in status ? Boolean(status.canAskAgain) : false;

  if (granted) {
    return "granted";
  }

  return canAskAgain ? "undetermined" : "denied";
}

function mapImagePickerPermissionStatus(
  permission:
    | ImagePicker.CameraPermissionResponse
    | ImagePicker.MediaLibraryPermissionResponse
): AppPermissionStatus {
  if (
    "accessPrivileges" in permission &&
    typeof permission.accessPrivileges === "string" &&
    permission.accessPrivileges.toLowerCase() === "limited"
  ) {
    return "limited";
  }

  if (permission.granted) {
    return "granted";
  }

  return permission.canAskAgain ? "undetermined" : "denied";
}

async function getNotificationsModule(): Promise<ExpoNotificationsModule | null> {
  if (isExpoGoRuntime()) {
    return null;
  }

  if (!notificationsModulePromise) {
    notificationsModulePromise = import("expo-notifications").catch(() => null);
  }

  return notificationsModulePromise;
}

export function isNotificationPermissionSupported() {
  return !isExpoGoRuntime();
}

export async function getNotificationPermissionStatus(): Promise<ReminderPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return "denied";
  }

  const status = await Notifications.getPermissionsAsync();
  return mapNotificationPermissionStatus(status);
}

export async function requestNotificationPermission(): Promise<ReminderPermissionStatus> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return "denied";
  }

  const status = await Notifications.requestPermissionsAsync();
  return mapNotificationPermissionStatus(status);
}

export async function getCameraPermissionStatus(): Promise<AppPermissionStatus> {
  const status = await ImagePicker.getCameraPermissionsAsync();
  return mapImagePickerPermissionStatus(status);
}

export async function requestCameraPermission(): Promise<AppPermissionStatus> {
  const status = await ImagePicker.requestCameraPermissionsAsync();
  return mapImagePickerPermissionStatus(status);
}

export async function getMediaLibraryPermissionStatus(): Promise<AppPermissionStatus> {
  const status = await ImagePicker.getMediaLibraryPermissionsAsync();
  return mapImagePickerPermissionStatus(status);
}

export async function requestMediaLibraryPermission(): Promise<AppPermissionStatus> {
  const status = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return mapImagePickerPermissionStatus(status);
}
