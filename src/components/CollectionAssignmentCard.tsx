import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useMemoryService } from "@/services/memoryService";
import { theme } from "@/theme/theme";
import type { MemoryCollection, MemoryCollectionKind } from "@/types/memory";

function getCollectionKindLabel(kind: MemoryCollectionKind) {
  switch (kind) {
    case "vacation":
      return "Vacation";
    case "school_year":
      return "School Year";
    case "holiday":
      return "Holiday";
    case "kid_chapter":
      return "Kid Chapter";
    default:
      return "Custom";
  }
}

const COLLECTION_KIND_OPTIONS: MemoryCollectionKind[] = [
  "vacation",
  "school_year",
  "holiday",
  "kid_chapter",
  "custom",
];

type StarterTemplate = {
  title: string;
  kind: MemoryCollectionKind;
  suggestedName: string;
  blurb: string;
};

function getCurrentYear() {
  return new Date().getFullYear();
}

function getStarterTemplates(): StarterTemplate[] {
  const year = getCurrentYear();

  return [
    {
      title: "Vacation",
      kind: "vacation",
      suggestedName: `Summer ${year} Trip`,
      blurb: "A bigger stretch like a vacation, trip, or getaway.",
    },
    {
      title: "School Year",
      kind: "school_year",
      suggestedName: `${year}-${year + 1} School Year`,
      blurb: "One chapter for a full school year or semester.",
    },
    {
      title: "Holiday",
      kind: "holiday",
      suggestedName: `Christmas ${year}`,
      blurb: "A recurring holiday, tradition, or seasonal ritual.",
    },
    {
      title: "Kid Chapter",
      kind: "kid_chapter",
      suggestedName: "Theo Chapter",
      blurb: "A longer season centered on one child or milestone.",
    },
  ];
}

type CollectionAssignmentCardProps = {
  editable: boolean;
  emptyText: string;
  helperText: string;
  selectedCollectionIds: string[];
  title: string;
  onChange: (collectionIds: string[]) => void;
};

export function CollectionAssignmentCard({
  editable,
  emptyText,
  helperText,
  selectedCollectionIds,
  title,
  onChange,
}: CollectionAssignmentCardProps) {
  const { getCollections, createCollection } = useMemoryService();
  const [collections, setCollections] = useState<MemoryCollection[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [newCollectionKind, setNewCollectionKind] =
    useState<MemoryCollectionKind>("custom");
  const [errorMessage, setErrorMessage] = useState("");
  const starterTemplates = useMemo(() => getStarterTemplates(), []);

  const selectedCollections = useMemo(
    () => collections.filter((collection) => selectedCollectionIds.includes(collection.id)),
    [collections, selectedCollectionIds]
  );

  useEffect(() => {
    let isActive = true;

    async function loadCollections() {
      setIsLoading(true);

      try {
        const nextCollections = await getCollections();
        if (isActive) {
          setCollections(nextCollections);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not load collections."
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadCollections();

    return () => {
      isActive = false;
    };
  }, [getCollections]);

  const toggleCollection = (collectionId: string) => {
    onChange(
      selectedCollectionIds.includes(collectionId)
        ? selectedCollectionIds.filter((id) => id !== collectionId)
        : [...selectedCollectionIds, collectionId]
    );
  };

  const handleCreateCollection = async () => {
    const trimmedTitle = newCollectionTitle.trim();

    if (!trimmedTitle) {
      setErrorMessage("Give the new collection a title first.");
      return;
    }

    setIsCreating(true);
    setErrorMessage("");

    try {
      const created = await createCollection({
        title: trimmedTitle,
        kind: newCollectionKind,
      });
      const refreshedCollections = await getCollections();
      setCollections(refreshedCollections);
      onChange([...selectedCollectionIds, created.id]);
      setNewCollectionTitle("");
      setNewCollectionKind("custom");
      setShowCreateForm(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create the collection."
      );
    } finally {
      setIsCreating(false);
    }
  };

  const applyStarterTemplate = (template: StarterTemplate) => {
    setNewCollectionKind(template.kind);
    setNewCollectionTitle(template.suggestedName);
    setShowCreateForm(true);
    setErrorMessage("");
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.helper}>{helperText}</Text>
        </View>
        {editable ? (
          <Pressable
            style={({ pressed }) => [
              styles.manageButton,
              pressed ? styles.manageButtonPressed : null,
            ]}
            onPress={() => {
              setErrorMessage("");
              setIsModalVisible(true);
            }}
          >
            <Text style={styles.manageButtonText}>
              {selectedCollectionIds.length ? "Manage" : "Choose"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {selectedCollections.length ? (
        <View style={styles.selectedList}>
          {selectedCollections.map((collection) => (
            <View key={collection.id} style={styles.selectedPill}>
              <Text style={styles.selectedPillText}>
                {collection.title}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalEyebrow}>Collections</Text>
                <Text style={styles.modalTitle}>Choose larger chapters</Text>
              </View>
              <Pressable onPress={() => setIsModalVisible(false)}>
                <Text style={styles.closeText}>Done</Text>
              </Pressable>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <ScrollView contentContainerStyle={styles.modalContent}>
              {isLoading ? (
                <View style={styles.stateCard}>
                  <ActivityIndicator color={theme.colors.accent} />
                  <Text style={styles.stateText}>Loading collections...</Text>
                </View>
              ) : collections.length ? (
                <View style={styles.optionList}>
                  {collections.map((collection) => {
                    const selected = selectedCollectionIds.includes(collection.id);
                    return (
                      <Pressable
                        key={collection.id}
                        style={({ pressed }) => [
                          styles.optionCard,
                          selected ? styles.optionCardSelected : null,
                          pressed ? styles.optionCardPressed : null,
                        ]}
                        onPress={() => toggleCollection(collection.id)}
                      >
                        <View style={styles.optionCopy}>
                          <Text style={styles.optionKind}>
                            {getCollectionKindLabel(collection.kind)}
                          </Text>
                          <Text style={styles.optionTitle}>{collection.title}</Text>
                          <Text style={styles.optionMeta}>
                            {collection.memoryCount}{" "}
                            {collection.memoryCount === 1 ? "entry" : "entries"}
                          </Text>
                        </View>
                        <Text style={styles.optionCheck}>{selected ? "Selected" : "Select"}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.stateCard}>
                  <Text style={styles.stateText}>
                    No collections yet. Create one here when an entry belongs to a bigger chapter.
                  </Text>
                </View>
              )}

              <View style={styles.createSection}>
                <View style={styles.templateSection}>
                  <View style={styles.templateHeader}>
                    <Text style={styles.templateTitle}>Starter templates</Text>
                    <Text style={styles.templateHint}>
                      Start with a familiar chapter shape, then rename it to fit your life.
                    </Text>
                  </View>
                  <View style={styles.templateList}>
                    {starterTemplates.map((template) => (
                      <Pressable
                        key={`${template.kind}:${template.title}`}
                        style={({ pressed }) => [
                          styles.templateCard,
                          pressed ? styles.templateCardPressed : null,
                        ]}
                        onPress={() => applyStarterTemplate(template)}
                      >
                        <Text style={styles.templateCardTitle}>{template.title}</Text>
                        <Text style={styles.templateCardName}>{template.suggestedName}</Text>
                        <Text style={styles.templateCardBlurb}>{template.blurb}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [
                    styles.createToggle,
                    pressed ? styles.createTogglePressed : null,
                  ]}
                  onPress={() => setShowCreateForm((current) => !current)}
                >
                  <Text style={styles.createToggleText}>
                    {showCreateForm ? "Hide new collection" : "Create new collection"}
                  </Text>
                </Pressable>

                {showCreateForm ? (
                  <View style={styles.createForm}>
                    <TextInput
                      value={newCollectionTitle}
                      onChangeText={setNewCollectionTitle}
                      placeholder="Summer at the lake"
                      placeholderTextColor={theme.colors.textSoft}
                      style={styles.input}
                    />
                    <Text style={styles.createHint}>
                      You can keep the starter name or rewrite it before creating the collection.
                    </Text>
                    <View style={styles.kindRow}>
                      {COLLECTION_KIND_OPTIONS.map((kind) => {
                        const selected = newCollectionKind === kind;
                        return (
                          <Pressable
                            key={kind}
                            style={[
                              styles.kindPill,
                              selected ? styles.kindPillSelected : null,
                            ]}
                            onPress={() => setNewCollectionKind(kind)}
                          >
                            <Text
                              style={[
                                styles.kindPillText,
                                selected ? styles.kindPillTextSelected : null,
                              ]}
                            >
                              {getCollectionKindLabel(kind)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.createButton,
                        pressed ? styles.createButtonPressed : null,
                      ]}
                      onPress={() => void handleCreateCollection()}
                      disabled={isCreating}
                    >
                      {isCreating ? (
                        <ActivityIndicator color={theme.colors.buttonText} />
                      ) : (
                        <Text style={styles.createButtonText}>Create and assign</Text>
                      )}
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  headerCopy: {
    flex: 1,
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
  manageButton: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: theme.spacing.md,
  },
  manageButtonPressed: {
    backgroundColor: "#FFF7EE",
  },
  manageButtonText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  selectedList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  selectedPill: {
    backgroundColor: "#F3E6D9",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  selectedPillText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  modalBackdrop: {
    backgroundColor: "rgba(58, 42, 34, 0.28)",
    flex: 1,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radii.lg,
    borderTopRightRadius: theme.radii.lg,
    maxHeight: "88%",
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
    marginBottom: theme.spacing.md,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 2,
  },
  modalEyebrow: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  closeText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  modalContent: {
    gap: theme.spacing.md,
  },
  optionList: {
    gap: theme.spacing.sm,
  },
  optionCard: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
    padding: theme.spacing.md,
  },
  optionCardSelected: {
    backgroundColor: "#F7E5D7",
    borderColor: "#D9A680",
  },
  optionCardPressed: {
    opacity: 0.95,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionKind: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  optionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  optionMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
  },
  optionCheck: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  createSection: {
    gap: theme.spacing.sm,
  },
  templateSection: {
    gap: theme.spacing.sm,
  },
  templateHeader: {
    gap: theme.spacing.xs,
  },
  templateTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  templateHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  templateList: {
    gap: theme.spacing.sm,
  },
  templateCard: {
    backgroundColor: "#FFF7EE",
    borderColor: "#E7D3BD",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: 4,
    padding: theme.spacing.md,
  },
  templateCardPressed: {
    opacity: 0.95,
  },
  templateCardTitle: {
    color: theme.colors.accent,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  templateCardName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  templateCardBlurb: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  createToggle: {
    alignItems: "center",
    backgroundColor: "#FFF4E8",
    borderColor: "#E6D2BC",
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
  },
  createTogglePressed: {
    backgroundColor: "#FFF0E0",
  },
  createToggleText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  createForm: {
    gap: theme.spacing.sm,
  },
  createHint: {
    color: theme.colors.textMuted,
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
  kindRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  kindPill: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  kindPillSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  kindPillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  kindPillTextSelected: {
    color: theme.colors.buttonText,
  },
  createButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    justifyContent: "center",
    minHeight: 46,
  },
  createButtonPressed: {
    opacity: 0.92,
  },
  createButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  stateCard: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  stateText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    textAlign: "center",
  },
  errorText: {
    color: "#B44D47",
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
});
