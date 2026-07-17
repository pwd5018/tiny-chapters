import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { CollectionAssignmentCard } from "@/components/CollectionAssignmentCard";
import { DatePickerField } from "@/components/DatePickerField";
import { MemoryMetadataCard } from "@/components/MemoryMetadataCard";
import { MemoryMetadataSuggestionsCard } from "@/components/MemoryMetadataSuggestionsCard";
import { parseMetadataList } from "@/lib/memoryMetadata";
import { useMemoryService } from "@/services/memoryService";
import {
  formatAttachedMediaDuration,
  getAttachedPhotoDisplayName,
  getAttachedPhotoMediaKindLabel,
  getAttachedPhotoPreviewUri,
  getAttachedPhotoSourceLabel,
  getAttachedPhotoStatusNote,
  getAttachedPhotoSyncStatusLabel,
} from "@/services/photo/photoDurability";
import { usePhotoAttachments } from "@/services/photo/photoAttachmentContext";
import { attemptNasRelinkForMemory } from "@/services/photo/photoRelinkService";
import { getPhotoById, getPhotoImageSource } from "@/services/photo/photoService";
import { theme } from "@/theme/theme";
import type {
  AttachedPhotoRef,
  Memory,
  MemoryMetadata,
  MemoryMetadataSuggestion,
} from "@/types/memory";
import type { PhotoAsset } from "@/types/photo";

function toDateKey(isoString: string) {
  return isoString.slice(0, 10);
}

function formatLongDate(isoString: string) {
  return new Date(isoString).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function parseTagsInput(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function AttachmentCard({
  attachment,
  isEditing,
  onRemove,
}: {
  attachment: AttachedPhotoRef;
  isEditing: boolean;
  onRemove: () => void;
}) {
  const [photoAsset, setPhotoAsset] = useState<PhotoAsset | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [viewFailed, setViewFailed] = useState(false);

  useEffect(() => {
    let isActive = true;
    const localPreviewUri = getAttachedPhotoPreviewUri(attachment);

    if (localPreviewUri) {
      setPhotoAsset(null);
      return () => {
        isActive = false;
      };
    }

    async function loadPhoto() {
      try {
        const result = await getPhotoById(attachment.photoId);
        if (isActive) {
          setPhotoAsset(result);
        }
      } catch {
        if (isActive) {
          setPhotoAsset(null);
        }
      }
    }

    void loadPhoto();

    return () => {
      isActive = false;
    };
  }, [attachment]);

  const fallbackPreviewUri = getAttachedPhotoPreviewUri(attachment);
  const previewUri = fallbackPreviewUri ?? (thumbnailFailed ? photoAsset?.viewUrl : photoAsset?.thumbnailUrl);
  const showPlaceholder = !previewUri || (thumbnailFailed && viewFailed);
  const mediaKindLabel = getAttachedPhotoMediaKindLabel(attachment);
  const formattedDuration = formatAttachedMediaDuration(attachment.durationMs);

  return (
    <View style={styles.attachmentCard}>
      {showPlaceholder ? (
        <View style={styles.attachmentPlaceholder}>
          <Text style={styles.attachmentPlaceholderText}>
            {attachment.mediaKind === "video" ? "Video saved" : "No preview"}
          </Text>
          {formattedDuration ? (
            <Text style={styles.attachmentPlaceholderMeta}>{formattedDuration}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.attachmentPreviewFrame}>
          <Image
            source={getPhotoImageSource(previewUri)}
            style={styles.attachmentPreview}
            onError={() => {
              if (photoAsset && !thumbnailFailed) {
                setThumbnailFailed(true);
                return;
              }

              setViewFailed(true);
            }}
          />
          {attachment.mediaKind === "video" ? (
            <View style={styles.attachmentBadge}>
              <Text style={styles.attachmentBadgeText}>
                Video{formattedDuration ? ` ${formattedDuration}` : ""}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.attachmentCopy}>
        <Text style={styles.attachmentName} numberOfLines={1}>
          {getAttachedPhotoDisplayName(attachment)}
        </Text>
        <Text style={styles.attachmentMeta}>Kind: {mediaKindLabel}</Text>
        <Text style={styles.attachmentMeta}>Source: {getAttachedPhotoSourceLabel(attachment)}</Text>
        <Text style={styles.attachmentMeta}>
          {getAttachedPhotoSyncStatusLabel(attachment.syncStatus)}
        </Text>
        {formattedDuration ? (
          <Text style={styles.attachmentMeta}>Duration: {formattedDuration}</Text>
        ) : null}
        {attachment.mimeType ? (
          <Text style={styles.attachmentMeta}>Type: {attachment.mimeType}</Text>
        ) : null}
        <Text style={styles.attachmentNote}>{getAttachedPhotoStatusNote(attachment)}</Text>
        <Text style={styles.attachmentPath} numberOfLines={2}>
          {attachment.path}
        </Text>
      </View>

      {isEditing ? (
        <Pressable style={styles.inlineRemoveButton} onPress={onRemove}>
          <Text style={styles.inlineRemoveButtonText}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export default function MemoryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const memoryId = typeof params.id === "string" ? params.id : "";
  const attachmentScope = `memory:${memoryId}`;
  const {
    approveMemoryMetadataSuggestion,
    deleteMemory,
    generateMemoryMetadataSuggestions,
    getMemoryById,
    getMemoryMetadataSuggestions,
    rejectMemoryMetadataSuggestion,
    updateMemory,
    updateMemoryPhotoRefs,
  } = useMemoryService();
  const {
    getAttachments,
    setAttachments,
    removeAttachmentForScope,
    clearAttachmentsForScope,
    setPickerScope,
  } = usePhotoAttachments();

  const selectedAttachments = getAttachments(attachmentScope);
  const [memory, setMemory] = useState<Memory | null>(null);
  const [dateKey, setDateKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [text, setText] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [metadata, setMetadata] = useState<MemoryMetadata | null>(null);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [metadataSuggestions, setMetadataSuggestions] = useState<MemoryMetadataSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isReviewingSuggestionId, setIsReviewingSuggestionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const isEditingRef = useRef(false);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  const hydrateDraft = (nextMemory: Memory) => {
    setMemory(nextMemory);
    setDateKey(toDateKey(nextMemory.date));
    setPrompt(nextMemory.prompt);
    setText(nextMemory.text);
    setTagsInput(nextMemory.tags.join(", "));
    setMetadata(nextMemory.metadata);
    setSelectedCollectionIds(nextMemory.collections.map((collection) => collection.id));
    setAttachments(attachmentScope, nextMemory.attachedPhotos);
  };

  useEffect(() => {
    let isActive = true;

    async function loadMemory() {
      if (!memoryId) {
        setErrorMessage("Missing chapter id.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const nextMemory = await getMemoryById(memoryId);
        if (!isActive) {
          return;
        }

        if (!nextMemory) {
          setErrorMessage("That chapter could not be found.");
          setMemory(null);
          return;
        }

        hydrateDraft(nextMemory);
        try {
          setMetadataSuggestions(await getMemoryMetadataSuggestions(memoryId));
        } catch {
          // Suggestions are additive; the saved chapter stays usable if they cannot load.
        }

        void (async () => {
          try {
            const relinkResult = await attemptNasRelinkForMemory(memoryId);

            if (!isActive || !relinkResult.changed || isEditingRef.current) {
              return;
            }

            const refreshedMemory = await getMemoryById(memoryId);
            if (isActive && refreshedMemory) {
              hydrateDraft(refreshedMemory);
            }
          } catch {
            // Keep the detail screen usable even if background relink fails.
          }
        })();
      } catch (error) {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : "Could not load the chapter.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadMemory();

    return () => {
      isActive = false;
    };
  }, [attachmentScope, getMemoryById, getMemoryMetadataSuggestions, memoryId]);

  const handleCancel = () => {
    if (!memory) {
      return;
    }

    hydrateDraft(memory);
    setIsEditing(false);
    setSaveMessage("");
    setErrorMessage("");
  };

  const handleSave = async () => {
    if (!memory) {
      return;
    }

    const trimmedPrompt = prompt.trim();
    const trimmedText = text.trim();

    if (!trimmedPrompt || !trimmedText || !dateKey) {
      setErrorMessage("Date, prompt, and chapter text are all required.");
      setSaveMessage("");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const updatedMemory = await updateMemory(memory.id, {
        date: new Date(`${dateKey}T12:00:00.000Z`).toISOString(),
        prompt: trimmedPrompt,
        text: trimmedText,
        tags: parseTagsInput(tagsInput),
        guidedContext: memory.guidedContext ?? null,
        metadata: metadata ?? memory.metadata,
        collectionIds: selectedCollectionIds,
      });
      await updateMemoryPhotoRefs(memory.id, selectedAttachments);
      const reloadedMemory = await getMemoryById(memory.id);
      hydrateDraft(reloadedMemory ?? updatedMemory);
      setMetadataSuggestions([]);
      setIsEditing(false);
      setSaveMessage("Changes saved.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateMetadataSuggestions = async () => {
    if (!memory) {
      return;
    }

    setIsGeneratingSuggestions(true);
    setErrorMessage("");
    setSaveMessage("");

    try {
      const suggestions = await generateMemoryMetadataSuggestions(memory.id);
      setMetadataSuggestions(suggestions);
      setSaveMessage(
        suggestions.length
          ? "Suggestions are ready for your review."
          : "No durable details were suggested from this chapter."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not generate metadata suggestions."
      );
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleApproveMetadataSuggestion = async (suggestion: MemoryMetadataSuggestion) => {
    setIsReviewingSuggestionId(suggestion.id);
    setErrorMessage("");

    try {
      const updatedMemory = await approveMemoryMetadataSuggestion(suggestion.id);
      hydrateDraft(updatedMemory);
      setMetadataSuggestions(await getMemoryMetadataSuggestions(updatedMemory.id));
      setSaveMessage(`${suggestion.value} added to confirmed details.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not approve that suggestion.");
    } finally {
      setIsReviewingSuggestionId(null);
    }
  };

  const handleRejectMetadataSuggestion = async (suggestion: MemoryMetadataSuggestion) => {
    setIsReviewingSuggestionId(suggestion.id);
    setErrorMessage("");

    try {
      await rejectMemoryMetadataSuggestion(suggestion.id);
      setMetadataSuggestions(await getMemoryMetadataSuggestions(suggestion.memoryId));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not dismiss that suggestion.");
    } finally {
      setIsReviewingSuggestionId(null);
    }
  };

  const handleDelete = () => {
    if (!memory) {
      return;
    }

    Alert.alert(
      "Delete this chapter?",
      "This removes the memory and its photo links, but it will not delete original photos from your NAS or phone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setIsDeleting(true);
              setErrorMessage("");

              try {
                await deleteMemory(memory.id);
                clearAttachmentsForScope(attachmentScope);
                router.replace("/(tabs)/timeline");
              } catch (error) {
                setErrorMessage(
                  error instanceof Error ? error.message : "Could not delete the chapter."
                );
              } finally {
                setIsDeleting(false);
              }
            })();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.stateText}>Loading chapter...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
          <Text style={styles.eyebrow}>Memory Detail</Text>
          <Text style={styles.title}>
            {memory ? formatLongDate(memory.date) : "Chapter not found"}
          </Text>
          <Text style={styles.subtitle}>
            Edit the words, keep the references tidy, and leave the original photos where they belong.
          </Text>
        </View>

        {errorMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}
        {saveMessage ? (
          <View style={styles.messageCard}>
            <Text style={styles.successText}>{saveMessage}</Text>
          </View>
        ) : null}

        {!memory ? (
          <View style={styles.sectionCard}>
            <Text style={styles.stateText}>That chapter is no longer available.</Text>
          </View>
        ) : (
          <>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Memory</Text>

              {isEditing ? (
                <View style={styles.editorFields}>
                  <DatePickerField
                    value={dateKey}
                    onChange={setDateKey}
                    helperText="Update the day this chapter belongs to."
                  />
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Prompt</Text>
                    <TextInput
                      value={prompt}
                      onChangeText={setPrompt}
                      placeholder="What prompted this chapter?"
                      placeholderTextColor={theme.colors.textSoft}
                      style={styles.singleLineInput}
                    />
                  </View>
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Chapter text</Text>
                    <TextInput
                      value={text}
                      onChangeText={setText}
                      placeholder="Write the chapter itself..."
                      placeholderTextColor={theme.colors.textSoft}
                      multiline
                      textAlignVertical="top"
                      style={styles.textArea}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.detailCopy}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{formatLongDate(memory.date)}</Text>
                  <Text style={styles.detailLabel}>Prompt</Text>
                  <Text style={styles.detailValue}>{memory.prompt}</Text>
                  <Text style={styles.detailLabel}>Memory text</Text>
                  <Text style={styles.detailBody}>{memory.text}</Text>
                </View>
              )}
            </View>

            {metadata ? (
              <MemoryMetadataCard
                editable={isEditing}
                title="Entry details"
                helperText="Keep structure honest: confirmed details belong here, while unfinished or uncertain thoughts can stay as a draft."
                metadata={metadata}
                selectedTagsInput={tagsInput}
                onMetadataChange={setMetadata}
                onTagsInputChange={setTagsInput}
                onRequestEdit={() => {
                  setIsEditing(true);
                  setSaveMessage("");
                  setErrorMessage("");
                }}
              />
            ) : null}

            {!isEditing ? (
              <MemoryMetadataSuggestionsCard
                isGenerating={isGeneratingSuggestions}
                isReviewingSuggestionId={isReviewingSuggestionId}
                suggestions={metadataSuggestions}
                onGenerate={() => void handleGenerateMetadataSuggestions()}
                onApprove={(suggestion) => void handleApproveMetadataSuggestion(suggestion)}
                onReject={(suggestion) => void handleRejectMetadataSuggestion(suggestion)}
              />
            ) : null}

            <CollectionAssignmentCard
              editable={isEditing}
              title="Collections"
              helperText="Use collections for bigger chapters without turning every memory into a heavy form."
              emptyText="This chapter is not part of a larger collection yet."
              selectedCollectionIds={selectedCollectionIds}
              onChange={setSelectedCollectionIds}
            />

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionHeaderCopy}>
                  <Text style={styles.sectionTitle}>Attachments</Text>
                  <Text style={styles.sectionHint}>
                    Removing a photo here only removes the reference from this chapter.
                  </Text>
                </View>
                {isEditing ? (
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => {
                      setPickerScope(attachmentScope, selectedAttachments);
                      router.push("/photo-picker");
                    }}
                  >
                    <Text style={styles.secondaryButtonText}>Add Media</Text>
                  </Pressable>
                ) : null}
              </View>

              {selectedAttachments.length ? (
                <View style={styles.attachmentList}>
                  {selectedAttachments.map((attachment) => (
                    <AttachmentCard
                      key={`${attachment.source}:${attachment.photoId}`}
                      attachment={attachment}
                      isEditing={isEditing}
                      onRemove={() =>
                        removeAttachmentForScope(
                          attachmentScope,
                          attachment.photoId,
                          attachment.source
                        )
                      }
                    />
                  ))}
                </View>
              ) : (
                <Text style={styles.emptyText}>No media references attached to this chapter.</Text>
              )}
            </View>

            <View style={styles.sectionCard}>
              {isEditing ? (
                <View style={styles.actionRow}>
                  <Pressable
                    style={styles.secondaryAction}
                    onPress={handleCancel}
                    disabled={isSaving || isDeleting}
                  >
                    <Text style={styles.secondaryActionText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.primaryAction}
                    onPress={() => void handleSave()}
                    disabled={isSaving || isDeleting}
                  >
                    {isSaving ? (
                      <ActivityIndicator color={theme.colors.buttonText} />
                    ) : (
                      <Text style={styles.primaryActionText}>Save Changes</Text>
                    )}
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={styles.primaryAction}
                  onPress={() => {
                    setIsEditing(true);
                    setSaveMessage("");
                    setErrorMessage("");
                  }}
                  disabled={isDeleting}
                >
                  <Text style={styles.primaryActionText}>Edit Chapter</Text>
                </Pressable>
              )}

              <Pressable
                style={styles.deleteAction}
                onPress={handleDelete}
                disabled={isSaving || isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#B44D47" />
                ) : (
                  <Text style={styles.deleteActionText}>Delete Chapter</Text>
                )}
              </Pressable>
              <Text style={styles.deleteHint}>
                This deletes the chapter text, tags, and photo references only. Original NAS or phone photos stay untouched.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  centered: {
    alignItems: "center",
    backgroundColor: theme.colors.background,
    flex: 1,
    gap: theme.spacing.sm,
    justifyContent: "center",
    padding: theme.spacing.lg,
  },
  content: {
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
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
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  messageCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
  },
  sectionHeaderCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  sectionHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  editorFields: {
    gap: theme.spacing.md,
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
  singleLineInput: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  textArea: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    lineHeight: 24,
    minHeight: 180,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  detailCopy: {
    gap: theme.spacing.sm,
  },
  detailLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  detailBody: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    lineHeight: 26,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
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
  attachmentList: {
    gap: theme.spacing.sm,
  },
  attachmentCard: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
  },
  attachmentPreview: {
    borderRadius: theme.radii.md,
    height: 60,
    width: 60,
  },
  attachmentPreviewFrame: {
    position: "relative",
  },
  attachmentBadge: {
    backgroundColor: "rgba(50, 34, 24, 0.82)",
    borderRadius: theme.radii.pill,
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    position: "absolute",
  },
  attachmentBadgeText: {
    color: "#FFF8F1",
    fontSize: 9,
    fontWeight: "700",
  },
  attachmentPlaceholder: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.md,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  attachmentPlaceholderText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  attachmentPlaceholderMeta: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 4,
  },
  attachmentCopy: {
    flex: 1,
    gap: 2,
  },
  attachmentName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  attachmentMeta: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  attachmentPath: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  attachmentNote: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  inlineRemoveButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  inlineRemoveButtonText: {
    color: "#B44D47",
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  actionRow: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: theme.spacing.md,
  },
  secondaryButtonText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  secondaryAction: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryActionText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  primaryAction: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
  },
  primaryActionText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  deleteAction: {
    alignItems: "center",
    borderColor: "#E2B7B2",
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  deleteActionText: {
    color: "#B44D47",
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  deleteHint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 18,
    textAlign: "center",
  },
  stateText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    textAlign: "center",
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  errorText: {
    color: "#B44D47",
    fontSize: theme.typography.body,
    textAlign: "center",
  },
  successText: {
    color: theme.colors.success,
    fontSize: theme.typography.body,
    textAlign: "center",
  },
});
