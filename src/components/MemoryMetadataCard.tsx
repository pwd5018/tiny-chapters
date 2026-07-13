import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  formatMetadataList,
  getMemoryImportanceLabel,
  getMemoryLifecycleLabel,
  hasConfirmedMetadata,
  MEMORY_IMPORTANCE_OPTIONS,
  MEMORY_LIFECYCLE_OPTIONS,
  parseMetadataList,
} from "@/lib/memoryMetadata";
import { theme } from "@/theme/theme";
import type { MemoryImportance, MemoryLifecycleStatus, MemoryMetadata } from "@/types/memory";

type MemoryMetadataCardProps = {
  editable: boolean;
  helperText: string;
  metadata: MemoryMetadata;
  selectedTagsInput: string;
  title: string;
  onMetadataChange: (metadata: MemoryMetadata) => void;
  onTagsInputChange: (value: string) => void;
};

function MetadataPill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pill,
        active ? styles.pillActive : null,
        pressed ? styles.pillPressed : null,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.pillText, active ? styles.pillTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function MetadataSummaryRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function MetadataField({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textSoft}
        style={styles.input}
      />
    </View>
  );
}

export function MemoryMetadataCard({
  editable,
  helperText,
  metadata,
  selectedTagsInput,
  title,
  onMetadataChange,
  onTagsInputChange,
}: MemoryMetadataCardProps) {
  const updateLifecycle = (lifecycleStatus: MemoryLifecycleStatus) =>
    onMetadataChange({
      ...metadata,
      lifecycleStatus,
    });

  const updateImportance = (importance: MemoryImportance | null) =>
    onMetadataChange({
      ...metadata,
      importance,
    });

  const updateListField = (
    field: "people" | "places" | "projects" | "topics",
    value: string
  ) =>
    onMetadataChange({
      ...metadata,
      [field]: parseMetadataList(value),
    });

  const hasMetadata = hasConfirmedMetadata(metadata, parseMetadataList(selectedTagsInput));

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.helper}>{helperText}</Text>
      </View>

      {editable ? (
        <>
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Entry state</Text>
            <View style={styles.pillRow}>
              {MEMORY_LIFECYCLE_OPTIONS.map((status) => (
                <MetadataPill
                  key={status}
                  active={metadata.lifecycleStatus === status}
                  label={getMemoryLifecycleLabel(status)}
                  onPress={() => updateLifecycle(status)}
                />
              ))}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Importance</Text>
            <View style={styles.pillRow}>
              <MetadataPill
                active={metadata.importance === null}
                label="Not set"
                onPress={() => updateImportance(null)}
              />
              {MEMORY_IMPORTANCE_OPTIONS.map((importance) => (
                <MetadataPill
                  key={importance}
                  active={metadata.importance === importance}
                  label={getMemoryImportanceLabel(importance)}
                  onPress={() => updateImportance(importance)}
                />
              ))}
            </View>
          </View>

          <View style={styles.favoriteRow}>
            <View style={styles.favoriteCopy}>
              <Text style={styles.favoriteTitle}>Favorite</Text>
              <Text style={styles.favoriteHelper}>
                Mark chapters that feel especially worth resurfacing later.
              </Text>
            </View>
            <MetadataPill
              active={metadata.isFavorite}
              label={metadata.isFavorite ? "Favorited" : "Mark favorite"}
              onPress={() =>
                onMetadataChange({
                  ...metadata,
                  isFavorite: !metadata.isFavorite,
                })
              }
            />
          </View>

          <MetadataField
            label="Tags"
            value={selectedTagsInput}
            onChangeText={onTagsInputChange}
            placeholder="travel, funny, project"
          />
          <MetadataField
            label="People"
            value={formatMetadataList(metadata.people)}
            onChangeText={(value) => updateListField("people", value)}
            placeholder="Maya, Theo"
          />
          <MetadataField
            label="Places"
            value={formatMetadataList(metadata.places)}
            onChangeText={(value) => updateListField("places", value)}
            placeholder="Paris, backyard, office"
          />
          <MetadataField
            label="Projects"
            value={formatMetadataList(metadata.projects)}
            onChangeText={(value) => updateListField("projects", value)}
            placeholder="Tiny Chapters, garden redo"
          />
          <MetadataField
            label="Topics"
            value={formatMetadataList(metadata.topics)}
            onChangeText={(value) => updateListField("topics", value)}
            placeholder="parenting, burnout, travel plans"
          />
        </>
      ) : hasMetadata ? (
        <View style={styles.summaryList}>
          <MetadataSummaryRow
            label="State"
            value={getMemoryLifecycleLabel(metadata.lifecycleStatus)}
          />
          <MetadataSummaryRow
            label="Importance"
            value={getMemoryImportanceLabel(metadata.importance)}
          />
          <MetadataSummaryRow
            label="Favorite"
            value={metadata.isFavorite ? "Yes" : "No"}
          />
          {selectedTagsInput.trim() ? <MetadataSummaryRow label="Tags" value={selectedTagsInput} /> : null}
          {metadata.people.length ? (
            <MetadataSummaryRow label="People" value={metadata.people.join(", ")} />
          ) : null}
          {metadata.places.length ? (
            <MetadataSummaryRow label="Places" value={metadata.places.join(", ")} />
          ) : null}
          {metadata.projects.length ? (
            <MetadataSummaryRow label="Projects" value={metadata.projects.join(", ")} />
          ) : null}
          {metadata.topics.length ? (
            <MetadataSummaryRow label="Topics" value={metadata.topics.join(", ")} />
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptyText}>
          No structured metadata yet. The chapter still stands on its own.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF8F1",
    borderColor: "#E8D7C6",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  helper: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  fieldBlock: {
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  pill: {
    backgroundColor: "#FFFDF9",
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  pillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  pillPressed: {
    opacity: 0.92,
  },
  pillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  pillTextActive: {
    color: theme.colors.buttonText,
  },
  favoriteRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  favoriteCopy: {
    flex: 1,
    gap: 2,
  },
  favoriteTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  favoriteHelper: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  input: {
    backgroundColor: "#FFFDF9",
    borderColor: "#E8DCCD",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  summaryList: {
    gap: theme.spacing.sm,
  },
  summaryRow: {
    gap: 2,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
});
