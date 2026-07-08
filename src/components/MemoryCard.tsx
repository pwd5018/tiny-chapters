import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import {
  getAttachedPhotoPreviewUri,
  summarizeAttachedPhotoStatuses,
} from "@/services/photo/photoDurability";
import { getPhotoById, getPhotoImageSource } from "@/services/photo/photoService";
import { theme } from "@/theme/theme";
import type { Memory } from "@/types/memory";
import type { PhotoAsset } from "@/types/photo";

function formatDisplayDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getMemoryExcerpt(text: string) {
  const trimmed = text.trim();

  if (trimmed.length <= 180) {
    return trimmed;
  }

  return `${trimmed.slice(0, 177).trimEnd()}...`;
}

export function MemoryCard({ memory }: { memory: Memory }) {
  const router = useRouter();
  const [photoAssets, setPhotoAssets] = useState<
    Array<PhotoAsset | { id: string; thumbnailUrl: string }>
  >([]);
  const [failedPreviewIds, setFailedPreviewIds] = useState<string[]>([]);

  useEffect(() => {
    let isActive = true;

    async function loadAttachedPhotos() {
      const previews = await Promise.all(
        memory.attachedPhotos.slice(0, 3).map(async (photoRef) => {
          const localPreviewUri = getAttachedPhotoPreviewUri(photoRef);

          if (localPreviewUri) {
            return {
              id: photoRef.photoId,
              thumbnailUrl: localPreviewUri,
            };
          }

          return getPhotoById(photoRef.photoId);
        })
      );

      if (isActive) {
        setPhotoAssets(
          previews.filter(
            (photo): photo is PhotoAsset | { id: string; thumbnailUrl: string } => photo !== null
          )
        );
      }
    }

    void loadAttachedPhotos();

    return () => {
      isActive = false;
    };
  }, [memory.attachedPhotos]);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
      onPress={() => router.push(`/memory/${memory.id}` as never)}
    >
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.dateBadge}>
            <Text style={styles.date}>{formatDisplayDate(memory.date)}</Text>
          </View>
          {memory.attachedPhotos.length ? (
            <View style={styles.miniMetaPill}>
              <Text style={styles.miniMetaText}>
                {memory.attachedPhotos.length} {memory.attachedPhotos.length === 1 ? "photo" : "photos"}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.prompt}>{memory.prompt}</Text>
      </View>

      <Text style={styles.text}>{getMemoryExcerpt(memory.text)}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaEyebrow}>Saved moment</Text>
        {memory.attachedPhotos.length ? (
        <Text style={styles.photoStatusSummary}>
          {summarizeAttachedPhotoStatuses(memory.attachedPhotos)}
        </Text>
        ) : null}
      </View>

      {photoAssets.length ? (
        <View style={styles.previewRow}>
          {photoAssets.map((photo) => (
            <Image
              key={photo.id}
              source={getPhotoImageSource(
                "viewUrl" in photo && failedPreviewIds.includes(photo.id)
                  ? photo.viewUrl
                  : photo.thumbnailUrl
              )}
              style={styles.previewImage}
              onError={() => {
                if ("viewUrl" in photo && !failedPreviewIds.includes(photo.id)) {
                  setFailedPreviewIds((current) => [...current, photo.id]);
                }
              }}
            />
          ))}
        </View>
      ) : memory.attachedPhotos.length ? (
        <View style={styles.previewFallback}>
          <Text style={styles.previewFallbackText}>Photo previews unavailable</Text>
        </View>
      ) : null}

      {memory.tags.length ? (
        <View style={styles.tags}>
          {memory.tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.footerRule} />
        <Text style={styles.footerText}>Open memory</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF7EF",
    borderColor: "#E9D8C7",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
    shadowColor: "#7C5C4D",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.992 }],
  },
  header: {
    gap: theme.spacing.sm,
  },
  headerTopRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
    justifyContent: "space-between",
  },
  dateBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1DFCD",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  miniMetaPill: {
    backgroundColor: "#FFFDF9",
    borderColor: "#E9D8C7",
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  miniMetaText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  date: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  prompt: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
    lineHeight: 28,
  },
  text: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  metaRow: {
    gap: 2,
  },
  metaEyebrow: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  photoStatusSummary: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  previewRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  previewImage: {
    borderRadius: theme.radii.md,
    height: 78,
    width: 78,
  },
  previewFallback: {
    backgroundColor: "#FFFCF8",
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignSelf: "flex-start",
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  previewFallbackText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "600",
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  tag: {
    backgroundColor: "#F3E6D9",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  tagText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: theme.spacing.xs,
  },
  footerRule: {
    backgroundColor: "#E7D9CB",
    flex: 1,
    height: 1,
    marginRight: theme.spacing.sm,
  },
  footerText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
