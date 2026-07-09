import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Linking, Platform } from "react-native";

const EXPORT_DIRECTORY_NAME = "tiny-chapters-exports";
const EXPORT_DIRECTORY_LABEL = "Tiny Chapters Exports";
const EXPORT_DIRECTORY_URI_KEY = "tiny_chapters.export_directory_uri";

type ExportSaveResult = {
  uri: string;
  filename: string;
  directoryUri: string;
  directoryLabel: string;
  storageMode: "android-user-folder" | "app-documents";
};

type ExportDirectoryState = {
  directoryUri: string | null;
  directoryLabel: string;
  storageMode: "android-user-folder" | "app-documents";
};

function sanitizeFileSegment(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

function getMimeType(extension: "json" | "md") {
  switch (extension) {
    case "json":
      return "application/json";
    case "md":
      return "text/markdown";
  }
}

function getExportBaseDirectory() {
  if (!FileSystem.documentDirectory) {
    throw new Error("Tiny Chapters could not access the device document directory for export.");
  }

  return `${FileSystem.documentDirectory}${EXPORT_DIRECTORY_NAME}/`;
}

async function ensureAppExportDirectory() {
  const exportDirectory = getExportBaseDirectory();
  const info = await FileSystem.getInfoAsync(exportDirectory);

  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(exportDirectory, { intermediates: true });
  }

  return exportDirectory;
}

async function getStoredAndroidExportDirectoryUri() {
  if (Platform.OS !== "android") {
    return null;
  }

  return AsyncStorage.getItem(EXPORT_DIRECTORY_URI_KEY);
}

async function setStoredAndroidExportDirectoryUri(directoryUri: string) {
  await AsyncStorage.setItem(EXPORT_DIRECTORY_URI_KEY, directoryUri);
}

export async function getExportDirectoryState(): Promise<ExportDirectoryState> {
  if (Platform.OS === "android") {
    const directoryUri = await getStoredAndroidExportDirectoryUri();

    return {
      directoryUri,
      directoryLabel: directoryUri ? "Chosen Android export folder" : EXPORT_DIRECTORY_LABEL,
      storageMode: directoryUri ? "android-user-folder" : "app-documents",
    };
  }

  return {
    directoryUri: getExportBaseDirectory(),
    directoryLabel: EXPORT_DIRECTORY_LABEL,
    storageMode: "app-documents",
  };
}

export async function chooseAndroidExportDirectory() {
  if (Platform.OS !== "android") {
    throw new Error("Folder picking for exports is only needed on Android.");
  }

  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

  if (!permissions.granted || !permissions.directoryUri) {
    return null;
  }

  await setStoredAndroidExportDirectoryUri(permissions.directoryUri);

  return {
    directoryUri: permissions.directoryUri,
    directoryLabel: "Chosen Android export folder",
    storageMode: "android-user-folder" as const,
  };
}

export function createExportFilename(baseName: string, extension: "json" | "md") {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeBase = sanitizeFileSegment(baseName) || "tiny-chapters-archive";
  return `${safeBase}-${timestamp}.${extension}`;
}

export async function saveExportTextFile(options: {
  filename: string;
  extension: "json" | "md";
  content: string;
}): Promise<ExportSaveResult> {
  if (Platform.OS === "android") {
    const directoryUri = await getStoredAndroidExportDirectoryUri();

    if (!directoryUri) {
      throw new Error(
        "Choose an Android export folder first so Tiny Chapters can save files somewhere you can actually browse."
      );
    }

    const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
      directoryUri,
      options.filename,
      getMimeType(options.extension)
    );

    await FileSystem.StorageAccessFramework.writeAsStringAsync(fileUri, options.content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      uri: fileUri,
      filename: options.filename,
      directoryUri,
      directoryLabel: "Chosen Android export folder",
      storageMode: "android-user-folder",
    };
  }

  const exportDirectory = await ensureAppExportDirectory();
  const uri = `${exportDirectory}${options.filename}`;

  await FileSystem.writeAsStringAsync(uri, options.content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return {
    uri,
    filename: options.filename,
    directoryUri: exportDirectory,
    directoryLabel: EXPORT_DIRECTORY_LABEL,
    storageMode: "app-documents",
  };
}

export async function openExportFile(uri: string) {
  const openUri =
    Platform.OS === "android" && uri.startsWith("file:")
      ? await FileSystem.getContentUriAsync(uri)
      : uri;

  const supported = await Linking.canOpenURL(openUri);

  if (!supported) {
    throw new Error("This device could not open the saved export file directly.");
  }

  await Linking.openURL(openUri);
}

export function getExportDirectoryLabel() {
  return EXPORT_DIRECTORY_LABEL;
}
