import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";

import { DatePickerField } from "@/components/DatePickerField";
import { DailyPromptCard } from "@/components/DailyPromptCard";
import { useMemoryService } from "@/services/memoryService";
import {
  getNotificationPermissionStatus,
  getReminderDescription,
  getReminderSettings,
  isReminderNotificationsSupported,
} from "@/services/notifications/reminderService";
import {
  requestCameraPermission,
  requestMediaLibraryPermission,
} from "@/services/permissions/permissionService";
import {
  getAttachedPhotoDisplayName,
  getAttachedPhotoPreviewUri,
  getAttachedPhotoSyncStatusLabel,
} from "@/services/photo/photoDurability";
import { usePhotoAttachments } from "@/services/photo/photoAttachmentContext";
import { attemptNasRelinkForRef } from "@/services/photo/photoRelinkService";
import {
  getActivePhotoSourceMode,
  getPhotoImageSource,
  loadPhotosForDate,
} from "@/services/photo/photoService";
import { theme } from "@/theme/theme";
import type { AttachedPhotoRef } from "@/types/memory";
import type { PhotoAsset } from "@/types/photo";
import type { ReminderSettings } from "@/types/reminder";

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function createLocalPhotoId() {
  return `local:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function parseExifDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const normalized = value
    .trim()
    .replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3")
    .replace(" ", "T");
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function getAssetTakenAt(asset: ImagePicker.ImagePickerAsset) {
  const exif = asset.exif as Record<string, unknown> | null | undefined;

  return (
    parseExifDate(exif?.DateTimeOriginal) ??
    parseExifDate(exif?.DateTimeDigitized) ??
    parseExifDate(exif?.DateTime) ??
    undefined
  );
}

function formatAttachmentDebugInfo(photoRef: AttachedPhotoRef) {
  const parts = [
    `source=${photoRef.source}`,
    `status=${photoRef.syncStatus}`,
    `filename=${photoRef.filename ?? "missing"}`,
    `takenAt=${photoRef.takenAt ?? "missing"}`,
    `fileSize=${typeof photoRef.fileSize === "number" ? photoRef.fileSize : "missing"}`,
    `width=${typeof photoRef.width === "number" ? photoRef.width : "missing"}`,
    `height=${typeof photoRef.height === "number" ? photoRef.height : "missing"}`,
  ];

  return parts.join(" | ");
}

function mapProviderPhotoToAttachedRef(photo: PhotoAsset): AttachedPhotoRef {
  return {
    photoId: photo.id,
    source: photo.source,
    path: photo.path,
    attachedAt: new Date().toISOString(),
    contentHash: photo.contentHash,
    filename: photo.filename,
    takenAt: photo.takenAt,
    fileSize: photo.fileSize,
    width: photo.width,
    height: photo.height,
    syncStatus: "linked_to_nas",
  };
}

function mapPickerAssetToAttachedRef(
  asset: ImagePicker.ImagePickerAsset,
  fallbackTakenAt?: string
): AttachedPhotoRef {
  return {
    photoId: createLocalPhotoId(),
    source: "local",
    path: asset.uri,
    attachedAt: new Date().toISOString(),
    filename: asset.fileName ?? undefined,
    takenAt: getAssetTakenAt(asset) ?? fallbackTakenAt,
    fileSize: asset.fileSize ?? undefined,
    width: asset.width,
    height: asset.height,
    localUri: asset.uri,
    syncStatus: "pending_nas_match",
  };
}

function formatDateLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00.000Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTakenTime(isoString?: string) {
  if (!isoString) {
    return null;
  }

  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

type TodayThumbnailProps = {
  photo: PhotoAsset;
  isSelected: boolean;
  onToggle: () => void;
  onPreview: () => void;
};

function TodayThumbnailCard({ photo, isSelected, onToggle, onPreview }: TodayThumbnailProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [viewFailed, setViewFailed] = useState(false);
  const imageUri = thumbnailFailed ? photo.viewUrl : photo.thumbnailUrl;

  return (
    <View style={styles.photoCell}>
      <Pressable
        style={[styles.photoOption, isSelected && styles.photoOptionSelected]}
        onPress={onToggle}
      >
        <Pressable onPress={onPreview}>
          {thumbnailFailed && viewFailed ? (
            <View style={styles.thumbnailFallback}>
              <Text style={styles.thumbnailFallbackText}>Thumbnail unavailable</Text>
            </View>
          ) : (
            <Image
              source={getPhotoImageSource(imageUri)}
              style={styles.photoThumbnail}
              onError={() => {
                if (!thumbnailFailed) {
                  setThumbnailFailed(true);
                  return;
                }

                setViewFailed(true);
              }}
            />
          )}
        </Pressable>
        <Text style={styles.photoName} numberOfLines={1}>
          {photo.filename}
        </Text>
        {formatTakenTime(photo.takenAt) ? (
          <Text style={styles.photoTime}>{formatTakenTime(photo.takenAt)}</Text>
        ) : null}
        {isSelected ? <Text style={styles.selectedBadge}>Selected</Text> : null}
      </Pressable>
    </View>
  );
}

export default function TodayScreen() {
  const attachmentScope = "today";
  const router = useRouter();
  const { createMemory, getDailyPrompt } = useMemoryService();
  const {
    getAttachments,
    addAttachmentForScope,
    removeAttachmentForScope,
    clearAttachmentsForScope,
    setPickerScope,
  } =
    usePhotoAttachments();
  const selectedAttachments = getAttachments(attachmentScope);
  const [memoryText, setMemoryText] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [availablePhotos, setAvailablePhotos] = useState<PhotoAsset[]>([]);
  const [photoStatusMessage, setPhotoStatusMessage] = useState("");
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isLaunchingCamera, setIsLaunchingCamera] = useState(false);
  const [isLaunchingLibrary, setIsLaunchingLibrary] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<PhotoAsset | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState(toDateKey(new Date()));
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings | null>(null);
  const [reminderPermission, setReminderPermission] = useState<"granted" | "denied" | "undetermined">("undetermined");

  const today = useMemo(() => new Date(), []);
  const todayDateKey = useMemo(() => toDateKey(today), [today]);
  const dailyPrompt = useMemo(() => getDailyPrompt(today), [getDailyPrompt, today]);
  const activePhotoSourceMode = useMemo(() => getActivePhotoSourceMode(), []);
  const availablePhotosById = useMemo(
    () => new Map(availablePhotos.map((photo) => [photo.id, photo])),
    [availablePhotos]
  );

  useEffect(() => {
    let isActive = true;

    async function loadPhotos() {
      setIsLoadingPhotos(true);
      setPhotoStatusMessage("");

      try {
        const result = await loadPhotosForDate(selectedDateKey);
        if (isActive) {
          setAvailablePhotos(result.photos);
          if (!result.ok && activePhotoSourceMode === "nas") {
            setPhotoStatusMessage("Unable to reach Photo API.");
          } else if (!result.photos.length) {
            setPhotoStatusMessage("No photos found for this day.");
          } else {
            setPhotoStatusMessage(result.message);
          }
        }
      } finally {
        if (isActive) {
          setIsLoadingPhotos(false);
        }
      }
    }

    void loadPhotos();

    return () => {
      isActive = false;
    };
  }, [activePhotoSourceMode, selectedDateKey]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadReminderState() {
        try {
          const [settings, permission] = await Promise.all([
            getReminderSettings(),
            getNotificationPermissionStatus(),
          ]);

          if (!isActive) {
            return;
          }

          setReminderSettings(settings);
          setReminderPermission(permission);
        } catch {
          if (isActive) {
            setReminderSettings(null);
          }
        }
      }

      void loadReminderState();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const formattedDate = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const togglePhoto = (photo: PhotoAsset) => {
    const existing = selectedAttachments.some((item) => item.photoId === photo.id);

    if (existing) {
      removeAttachmentForScope(attachmentScope, photo.id);
      return;
    }

    addAttachmentForScope(attachmentScope, mapProviderPhotoToAttachedRef(photo));
  };

  const removeSelectedAttachment = (photoId: string) => {
    removeAttachmentForScope(attachmentScope, photoId);
  };

  const handleTakePhoto = async () => {
    setIsLaunchingCamera(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const permission = await requestCameraPermission();

      if (permission !== "granted") {
        setErrorMessage("Camera permission is needed before Tiny Chapters can take a photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        exif: true,
        mediaTypes: ["images"],
        quality: 1,
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const nextAttachment = await attemptNasRelinkForRef(
        mapPickerAssetToAttachedRef(result.assets[0], new Date().toISOString())
      );
      addAttachmentForScope(attachmentScope, nextAttachment);
      setPhotoStatusMessage(
        nextAttachment.syncStatus === "linked_to_nas"
          ? "Captured photo matched your NAS archive right away."
          : "Captured photo added as a temporary local reference until the NAS backup can be matched."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not launch the camera."
      );
    } finally {
      setIsLaunchingCamera(false);
    }
  };

  const handleAttachFromPhone = async () => {
    setIsLaunchingLibrary(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const permission = await requestMediaLibraryPermission();

      if (permission !== "granted" && permission !== "limited") {
        setErrorMessage(
          "Photo library permission is needed before Tiny Chapters can attach a phone photo."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        allowsMultipleSelection: true,
        exif: true,
        mediaTypes: ["images"],
        quality: 1,
        selectionLimit: 5,
      });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const nextAttachments = await Promise.all(
        result.assets.map(async (asset) =>
          attemptNasRelinkForRef(mapPickerAssetToAttachedRef(asset))
        )
      );
      nextAttachments.forEach((attachment) =>
        addAttachmentForScope(attachmentScope, attachment)
      );
      const matchedCount = nextAttachments.filter(
        (attachment) => attachment.syncStatus === "linked_to_nas"
      ).length;
      setPhotoStatusMessage(
        matchedCount
          ? `${matchedCount} phone photo${matchedCount === 1 ? "" : "s"} matched the NAS archive right away.`
          : "Phone photos were attached as temporary local references until the NAS backup can be matched."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not open the photo library."
      );
    } finally {
      setIsLaunchingLibrary(false);
    }
  };

  const handleSave = async () => {
    const trimmed = memoryText.trim();
    if (!trimmed) {
      setSaveMessage("");
      setErrorMessage("Write a little moment first.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      await createMemory({
        date: today.toISOString(),
        prompt: dailyPrompt,
        text: trimmed,
        tags: [],
        attachedPhotos: selectedAttachments,
      });

      setMemoryText("");
      clearAttachmentsForScope(attachmentScope);
      setSaveMessage("Memory saved to Supabase.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save the memory.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Tiny Chapters</Text>
          <Text style={styles.title}>Capture one small thing from today.</Text>
          <Text style={styles.date}>{formattedDate}</Text>
        </View>

        {isReminderNotificationsSupported() &&
        reminderSettings?.enabled &&
        reminderPermission === "granted" ? (
          <View style={styles.reminderHintCard}>
            <Text style={styles.reminderHintTitle}>Memory reminders are on</Text>
            <Text style={styles.reminderHintText}>
              {getReminderDescription(reminderSettings)}
            </Text>
          </View>
        ) : null}

        <DailyPromptCard prompt={dailyPrompt} />

        <View style={styles.editorCard}>
          <Text style={styles.label}>Today's memory</Text>
          <TextInput
            value={memoryText}
            onChangeText={(value) => {
              setMemoryText(value);
              if (saveMessage || errorMessage) {
                setSaveMessage("");
                setErrorMessage("");
              }
            }}
            placeholder="Something tiny, funny, tender, or worth keeping..."
            placeholderTextColor={theme.colors.textSoft}
            multiline
            textAlignVertical="top"
            style={styles.input}
          />
        </View>

        <View style={styles.photoCard}>
          <View style={styles.photoHeader}>
            <Text style={styles.label}>Photos from this day</Text>
            <Text style={styles.photoHint}>
              The app stores only references, not copies, so your NAS can remain the source of truth.
            </Text>
          </View>

          <View style={styles.dateBar}>
            <DatePickerField
              value={selectedDateKey}
              onChange={setSelectedDateKey}
              helperText="Pick the day you want Tiny Chapters to load from the active photo source."
            />
          </View>

          <Text style={styles.dateSummary}>
            Viewing photos for {formatDateLabel(selectedDateKey)}
          </Text>

          <View style={styles.photoActions}>
            <Pressable
              style={styles.secondaryAction}
              onPress={() => void handleTakePhoto()}
              disabled={isLaunchingCamera}
            >
              {isLaunchingCamera ? (
                <ActivityIndicator color={theme.colors.accent} />
              ) : (
                <Text style={styles.secondaryActionText}>Take Photo</Text>
              )}
            </Pressable>

            <Pressable
              style={styles.secondaryAction}
              onPress={() => {
                setPickerScope(attachmentScope, selectedAttachments);
                router.push("/photo-picker");
              }}
            >
              <Text style={styles.secondaryActionText}>Attach from NAS</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryAction}
              onPress={() => void handleAttachFromPhone()}
              disabled={isLaunchingLibrary}
            >
              {isLaunchingLibrary ? (
                <ActivityIndicator color={theme.colors.accent} />
              ) : (
                <Text style={styles.secondaryActionText}>Attach from Phone</Text>
              )}
            </Pressable>
          </View>

          {selectedAttachments.length ? (
            <View style={styles.selectedSection}>
              <Text style={styles.selectedTitle}>Selected photos</Text>
              <View style={styles.selectedList}>
                {selectedAttachments.map((photoRef) => {
                  const providerPhoto = availablePhotosById.get(photoRef.photoId);
                  const previewUri =
                    photoRef.localUri ??
                    providerPhoto?.thumbnailUrl ??
                    getAttachedPhotoPreviewUri(photoRef);
                  const displayName = getAttachedPhotoDisplayName(photoRef);

                  return (
                    <View key={photoRef.photoId} style={styles.selectedCard}>
                      {previewUri ? (
                        <Image
                          source={getPhotoImageSource(previewUri)}
                          style={styles.selectedPreview}
                        />
                      ) : (
                        <View style={styles.selectedPreviewFallback}>
                          <Text style={styles.selectedPreviewFallbackText}>No preview</Text>
                        </View>
                      )}

                      <View style={styles.selectedCopy}>
                        <Text style={styles.selectedName} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <Text style={styles.selectedStatus}>
                          {getAttachedPhotoSyncStatusLabel(photoRef.syncStatus)}
                        </Text>
                        {__DEV__ ? (
                          <Text style={styles.selectedDebug}>
                            {formatAttachmentDebugInfo(photoRef)}
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        style={styles.removeButton}
                        onPress={() => removeSelectedAttachment(photoRef.photoId)}
                      >
                        <Text style={styles.removeButtonText}>Remove</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {isLoadingPhotos ? (
            <View style={styles.photoState}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.photoStateText}>Loading photos...</Text>
            </View>
          ) : availablePhotos.length ? (
            <FlatList
              data={availablePhotos}
              keyExtractor={(item) => item.id}
              numColumns={2}
              scrollEnabled={false}
              columnWrapperStyle={styles.photoGridRow}
              contentContainerStyle={styles.photoGrid}
              renderItem={({ item }) => {
                const isSelected = selectedAttachments.some(
                  (attachment) => attachment.photoId === item.id
                );

                return (
                  <TodayThumbnailCard
                    photo={item}
                    isSelected={isSelected}
                    onPreview={() => setPreviewPhoto(item)}
                    onToggle={() => togglePhoto(item)}
                  />
                );
              }}
            />
          ) : photoStatusMessage ? (
            <Text style={styles.photoEmpty}>{photoStatusMessage}</Text>
          ) : (
            <Text style={styles.photoEmpty}>
              {activePhotoSourceMode === "nas"
                ? "No NAS photos were found for today."
                : "No mock photos available for today yet."}
            </Text>
          )}
        </View>

        <View style={styles.actionsCard}>
          <Pressable style={styles.button} onPress={handleSave} disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color={theme.colors.buttonText} />
            ) : (
              <Text style={styles.buttonText}>Save Memory</Text>
            )}
          </Pressable>
          {saveMessage ? <Text style={styles.message}>{saveMessage}</Text> : null}
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
        </View>
      </ScrollView>

      <Modal visible={previewPhoto !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{previewPhoto?.filename}</Text>
            {previewPhoto ? (
              <Image
                source={getPhotoImageSource(previewPhoto.viewUrl)}
                style={styles.modalImage}
              />
            ) : null}
            <Pressable style={styles.button} onPress={() => setPreviewPhoto(null)}>
              <Text style={styles.buttonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.hero,
    fontWeight: "700",
    lineHeight: 38,
  },
  date: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
  },
  editorCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  reminderHintCard: {
    backgroundColor: theme.colors.cardWarm,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  reminderHintTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  reminderHintText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  photoCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  actionsCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  label: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "600",
  },
  input: {
    minHeight: 180,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.input,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  photoHeader: {
    gap: theme.spacing.xs,
  },
  photoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  dateBar: {
    gap: theme.spacing.sm,
  },
  dateSummary: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
  },
  secondaryActionText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  photoHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  selectedSection: {
    gap: theme.spacing.sm,
  },
  selectedTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  selectedList: {
    gap: theme.spacing.sm,
  },
  selectedCard: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  selectedPreview: {
    borderRadius: theme.radii.md,
    height: 52,
    width: 52,
  },
  selectedPreviewFallback: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  selectedPreviewFallbackText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  selectedCopy: {
    flex: 1,
    gap: 2,
  },
  selectedName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  selectedStatus: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  selectedDebug: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
  },
  removeButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  removeButtonText: {
    color: "#B44D47",
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  photoGrid: {
    gap: theme.spacing.md,
  },
  photoGridRow: {
    gap: theme.spacing.md,
  },
  photoCell: {
    flex: 1,
  },
  photoOption: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
  },
  photoOptionSelected: {
    borderColor: theme.colors.accent,
    borderWidth: 2,
  },
  photoThumbnail: {
    borderRadius: theme.radii.md,
    aspectRatio: 1,
    height: undefined,
    overflow: "hidden",
    resizeMode: "cover",
    width: "100%",
  },
  photoName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  photoTime: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  selectedBadge: {
    color: theme.colors.success,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  photoEmpty: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  photoState: {
    alignItems: "center",
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
  },
  photoStateText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
  },
  thumbnailFallback: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    aspectRatio: 1,
    height: undefined,
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
  },
  thumbnailFallbackText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    textAlign: "center",
  },
  button: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    minHeight: 48,
    justifyContent: "center",
    paddingVertical: theme.spacing.md,
  },
  buttonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  message: {
    color: theme.colors.success,
    fontSize: theme.typography.body,
    fontWeight: "600",
  },
  error: {
    color: "#B44D47",
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(58, 42, 34, 0.45)",
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    gap: theme.spacing.md,
    maxWidth: 420,
    padding: theme.spacing.lg,
    width: "100%",
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  modalImage: {
    borderRadius: theme.radii.md,
    height: 320,
    width: "100%",
  },
});
