import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { DailyPromptCard } from "@/components/DailyPromptCard";
import { useMemoryService } from "@/services/memoryService";
import {
  getActivePhotoSourceMode,
  loadPhotosForDate,
} from "@/services/photo/photoService";
import { theme } from "@/theme/theme";
import type { AttachedPhotoRef } from "@/types/memory";
import type { PhotoAsset } from "@/types/photo";

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default function TodayScreen() {
  const { createMemory, getDailyPrompt } = useMemoryService();
  const [memoryText, setMemoryText] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [availablePhotos, setAvailablePhotos] = useState<PhotoAsset[]>([]);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [photoStatusMessage, setPhotoStatusMessage] = useState("");
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const today = useMemo(() => new Date(), []);
  const todayDateKey = useMemo(() => toDateKey(today), [today]);
  const dailyPrompt = useMemo(() => getDailyPrompt(today), [getDailyPrompt, today]);
  const activePhotoSourceMode = useMemo(() => getActivePhotoSourceMode(), []);

  useEffect(() => {
    let isActive = true;

    async function loadPhotos() {
      setIsLoadingPhotos(true);
      setPhotoStatusMessage("");

      try {
        const result = await loadPhotosForDate(todayDateKey);
        if (isActive) {
          setAvailablePhotos(result.photos);
          if (result.message) {
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
  }, [activePhotoSourceMode, todayDateKey]);

  const formattedDate = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const togglePhoto = (photoId: string) => {
    setSelectedPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((id) => id !== photoId)
        : [...current, photoId]
    );
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
      const selectedPhotos = availablePhotos.filter((photo) => selectedPhotoIds.includes(photo.id));
      const attachedPhotos: AttachedPhotoRef[] = selectedPhotos.map((photo) => ({
        photoId: photo.id,
        source: photo.source,
        path: photo.path,
        attachedAt: new Date().toISOString(),
        contentHash: photo.contentHash,
      }));

      await createMemory({
        date: today.toISOString(),
        prompt: dailyPrompt,
        text: trimmed,
        tags: [],
        attachedPhotos,
      });

      setMemoryText("");
      setSelectedPhotoIds([]);
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

          {isLoadingPhotos ? (
            <View style={styles.photoState}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.photoStateText}>Loading photos...</Text>
            </View>
          ) : availablePhotos.length ? (
            <View style={styles.photoGrid}>
              {availablePhotos.map((photo) => {
                const isSelected = selectedPhotoIds.includes(photo.id);

                return (
                  <Pressable
                    key={photo.id}
                    style={[styles.photoOption, isSelected && styles.photoOptionSelected]}
                    onPress={() => togglePhoto(photo.id)}
                  >
                    <Image source={{ uri: photo.thumbnailUrl }} style={styles.photoThumbnail} />
                    <Text style={styles.photoName} numberOfLines={1}>
                      {photo.filename}
                    </Text>
                    <Text style={styles.photoPath} numberOfLines={1}>
                      {photo.path}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
  photoHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.md,
  },
  photoOption: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
    width: "47%",
  },
  photoOptionSelected: {
    borderColor: theme.colors.accent,
    borderWidth: 2,
  },
  photoThumbnail: {
    borderRadius: theme.radii.md,
    height: 120,
    width: "100%",
  },
  photoName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  photoPath: {
    color: theme.colors.textMuted,
    fontSize: 11,
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
});
