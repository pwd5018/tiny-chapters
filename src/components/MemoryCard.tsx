import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { getPhotoById } from "@/services/photo/photoService";
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

export function MemoryCard({ memory }: { memory: Memory }) {
  const [photoAssets, setPhotoAssets] = useState<PhotoAsset[]>([]);

  useEffect(() => {
    let isActive = true;

    async function loadAttachedPhotos() {
      const previews = await Promise.all(
        memory.attachedPhotos.slice(0, 3).map((photoRef) =>
          getPhotoById(photoRef.photoId)
        )
      );

      if (isActive) {
        setPhotoAssets(previews.filter((photo): photo is PhotoAsset => photo !== null));
      }
    }

    void loadAttachedPhotos();

    return () => {
      isActive = false;
    };
  }, [memory.attachedPhotos]);

  return (
    <View style={styles.card}>
      <Text style={styles.date}>{formatDisplayDate(memory.date)}</Text>
      <Text style={styles.prompt}>{memory.prompt}</Text>
      <Text style={styles.text}>{memory.text}</Text>

      <Text style={styles.photoCount}>
        {memory.attachedPhotos.length} attached{" "}
        {memory.attachedPhotos.length === 1 ? "photo" : "photos"}
      </Text>

      {photoAssets.length ? (
        <View style={styles.previewRow}>
          {photoAssets.map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: photo.thumbnailUrl }}
              style={styles.previewImage}
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
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  date: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  prompt: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  text: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  photoCount: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "600",
  },
  previewRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  previewImage: {
    borderRadius: theme.radii.md,
    height: 52,
    width: 52,
  },
  previewFallback: {
    backgroundColor: theme.colors.input,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    alignSelf: "flex-start",
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
    marginTop: theme.spacing.xs,
  },
  tag: {
    backgroundColor: theme.colors.tagBackground,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  tagText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
});
