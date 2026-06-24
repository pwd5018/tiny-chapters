import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";

import { DatePickerField } from "@/components/DatePickerField";
import { getAttachedPhotoSyncStatusLabel } from "@/services/photo/photoDurability";
import { usePhotoAttachments } from "@/services/photo/photoAttachmentContext";
import {
  getActivePhotoSourceMode,
  getFolders,
  getFolderPhotos,
  getPhotoImageSource,
  loadPhotosForDate,
  searchPhotos,
} from "@/services/photo/photoService";
import { theme } from "@/theme/theme";
import type { AttachedPhotoRef } from "@/types/memory";
import type { FolderEntry, PhotoAsset } from "@/types/photo";

const PAGE_SIZE = 50;

type PickerMode = "date" | "search" | "folders";

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDateLabel(date: string) {
  return new Date(`${date}T12:00:00.000Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTakenTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
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

type ThumbnailCellProps = {
  photo: PhotoAsset;
  isSelected: boolean;
  onToggle: () => void;
  onPreview: () => void;
};

function ThumbnailCell({ photo, isSelected, onToggle, onPreview }: ThumbnailCellProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const [viewFailed, setViewFailed] = useState(false);
  const imageUri = thumbnailFailed ? photo.viewUrl : photo.thumbnailUrl;

  return (
    <View style={styles.photoCell}>
      <Pressable
        style={[styles.photoCard, isSelected && styles.photoCardSelected]}
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
        <Text style={styles.photoFilename} numberOfLines={1}>
          {photo.filename}
        </Text>
        <Text style={styles.photoTime}>{formatTakenTime(photo.takenAt)}</Text>
        {isSelected ? <Text style={styles.selectedBadge}>Selected</Text> : null}
      </Pressable>
    </View>
  );
}

export default function PhotoPickerScreen() {
  const router = useRouter();
  const activePhotoSourceMode = getActivePhotoSourceMode();
  const [mode, setMode] = useState<PickerMode>("date");
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [datePhotos, setDatePhotos] = useState<PhotoAsset[]>([]);
  const [dateMessage, setDateMessage] = useState("");
  const [isDateLoading, setIsDateLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsesDate, setSearchUsesDate] = useState(false);
  const [searchItems, setSearchItems] = useState<PhotoAsset[]>([]);
  const [searchMessage, setSearchMessage] = useState("Search the indexed library by filename or path.");
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchLoadingMore, setIsSearchLoadingMore] = useState(false);

  const [folderPath, setFolderPath] = useState("");
  const [folderParentPath, setFolderParentPath] = useState<string | null>(null);
  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>([]);
  const [folderItems, setFolderItems] = useState<PhotoAsset[]>([]);
  const [folderMessage, setFolderMessage] = useState("");
  const [folderTotal, setFolderTotal] = useState(0);
  const [folderHasMore, setFolderHasMore] = useState(false);
  const [isFolderLoading, setIsFolderLoading] = useState(false);
  const [isFolderLoadingMore, setIsFolderLoadingMore] = useState(false);

  const [previewPhoto, setPreviewPhoto] = useState<PhotoAsset | null>(null);
  const { selectedAttachments, toggleAttachment } = usePhotoAttachments();

  useEffect(() => {
    let isActive = true;

    async function loadDateModePhotos() {
      setIsDateLoading(true);
      setDateMessage("");

      try {
        const result = await loadPhotosForDate(selectedDate);

        if (!isActive) {
          return;
        }

        setDatePhotos(result.photos);

        if (!result.ok && activePhotoSourceMode === "nas") {
          setDateMessage("Unable to reach Photo API.");
        } else if (!result.photos.length) {
          setDateMessage("No photos found for this day.");
        } else {
          setDateMessage("");
        }
      } finally {
        if (isActive) {
          setIsDateLoading(false);
        }
      }
    }

    void loadDateModePhotos();

    return () => {
      isActive = false;
    };
  }, [activePhotoSourceMode, selectedDate]);

  useEffect(() => {
    if (mode !== "folders") {
      return;
    }

    let isActive = true;

    async function loadRootFolders() {
      setIsFolderLoading(true);
      setFolderMessage("");

      try {
        const [folderResult, photoResult] = await Promise.all([
          getFolders(folderPath),
          folderPath
            ? getFolderPhotos(folderPath, { limit: PAGE_SIZE, offset: 0 })
            : Promise.resolve({
                path: "",
                items: [],
                limit: PAGE_SIZE,
                offset: 0,
                total: 0,
                hasMore: false,
              }),
        ]);

        if (!isActive) {
          return;
        }

        setFolderEntries(folderResult.folders);
        setFolderParentPath(folderResult.parentPath);
        setFolderItems(photoResult.items);
        setFolderTotal(photoResult.total);
        setFolderHasMore(photoResult.hasMore);

        if (!folderResult.folders.length && !photoResult.items.length) {
          setFolderMessage("No folders or indexed photos were found here yet.");
        } else {
          setFolderMessage("");
        }
      } finally {
        if (isActive) {
          setIsFolderLoading(false);
        }
      }
    }

    void loadRootFolders();

    return () => {
      isActive = false;
    };
  }, [folderPath, mode]);

  const activePhotos = useMemo(() => {
    if (mode === "search") {
      return searchItems;
    }

    if (mode === "folders") {
      return folderItems;
    }

    return datePhotos;
  }, [datePhotos, folderItems, mode, searchItems]);

  const isLoading = mode === "date" ? isDateLoading : mode === "search" ? isSearchLoading : isFolderLoading;
  const isLoadingMore =
    mode === "search" ? isSearchLoadingMore : mode === "folders" ? isFolderLoadingMore : false;
  const message = mode === "date" ? dateMessage : mode === "search" ? searchMessage : folderMessage;
  const hasMore = mode === "search" ? searchHasMore : mode === "folders" ? folderHasMore : false;
  const totalCount = mode === "search" ? searchTotal : mode === "folders" ? folderTotal : activePhotos.length;
  const selectedCountForLoadedPhotos = useMemo(
    () =>
      activePhotos.filter((photo) =>
        selectedAttachments.some((attachment) => attachment.photoId === photo.id)
      ).length,
    [activePhotos, selectedAttachments]
  );

  const runSearch = async (append: boolean) => {
    if (!append) {
      setIsSearchLoading(true);
    } else {
      setIsSearchLoadingMore(true);
    }
    setSearchMessage("");

    try {
      const result = await searchPhotos({
        q: searchQuery.trim() || undefined,
        date: searchUsesDate ? selectedDate : undefined,
        limit: PAGE_SIZE,
        offset: append ? searchItems.length : 0,
      });

      setSearchItems((current) => (append ? [...current, ...result.items] : result.items));
      setSearchTotal(result.total);
      setSearchHasMore(result.hasMore);

      if (!result.items.length && !append) {
        setSearchMessage("No indexed photos matched that search.");
      }
    } finally {
      setIsSearchLoading(false);
      setIsSearchLoadingMore(false);
    }
  };

  const runFolderLoadMore = async () => {
    if (!folderPath) {
      return;
    }

    setIsFolderLoadingMore(true);
    setFolderMessage("");

    try {
      const result = await getFolderPhotos(folderPath, {
        limit: PAGE_SIZE,
        offset: folderItems.length,
      });

      setFolderItems((current) => [...current, ...result.items]);
      setFolderTotal(result.total);
      setFolderHasMore(result.hasMore);
    } finally {
      setIsFolderLoadingMore(false);
    }
  };

  const breadcrumbParts = useMemo(() => folderPath.split("/").filter(Boolean), [folderPath]);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <FlatList
        data={activePhotos}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <View style={styles.header}>
              <Text style={styles.title}>Attach from NAS</Text>
              <Text style={styles.subtitle}>
                Browse by day, search the index, or drill through folders without copying any photos into the app.
              </Text>
            </View>

            <View style={styles.modeTabs}>
              {([
                ["date", "By Date"],
                ["search", "Search"],
                ["folders", "Folders"],
              ] as const).map(([nextMode, label]) => (
                <Pressable
                  key={nextMode}
                  style={[styles.modeTab, mode === nextMode && styles.modeTabActive]}
                  onPress={() => setMode(nextMode)}
                >
                  <Text
                    style={[styles.modeTabText, mode === nextMode && styles.modeTabTextActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.toolbar}>
              {mode === "date" ? (
                <>
                  <DatePickerField
                    value={selectedDate}
                    onChange={setSelectedDate}
                    helperText="Pick a day and Tiny Chapters will load that day's indexed photos."
                  />
                  <Text style={styles.dateLabel}>Showing {formatDateLabel(selectedDate)}</Text>
                </>
              ) : null}

              {mode === "search" ? (
                <>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="Search filename or path"
                    placeholderTextColor={theme.colors.textSoft}
                    style={styles.searchInput}
                  />
                  <DatePickerField
                    value={selectedDate}
                    onChange={setSelectedDate}
                    helperText="Optional day filter for narrowing search results."
                  />
                  <Pressable
                    style={styles.toggleRow}
                    onPress={() => setSearchUsesDate((current) => !current)}
                  >
                    <View
                      style={[
                        styles.togglePill,
                        searchUsesDate && styles.togglePillActive,
                      ]}
                    />
                    <Text style={styles.toggleText}>
                      Limit search to {formatDateLabel(selectedDate)}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.primaryInlineButton}
                    onPress={() => void runSearch(false)}
                  >
                    <Text style={styles.primaryInlineButtonText}>Search Library</Text>
                  </Pressable>
                </>
              ) : null}

              {mode === "folders" ? (
                <>
                  <Text style={styles.sectionCaption}>Browse indexed folders</Text>
                  <View style={styles.breadcrumbRow}>
                    <Pressable
                      style={styles.breadcrumbChip}
                      onPress={() => setFolderPath("")}
                    >
                      <Text style={styles.breadcrumbChipText}>Root</Text>
                    </Pressable>
                    {breadcrumbParts.map((part, index) => {
                      const nextPath = breadcrumbParts.slice(0, index + 1).join("/");
                      return (
                        <Pressable
                          key={nextPath}
                          style={styles.breadcrumbChip}
                          onPress={() => setFolderPath(nextPath)}
                        >
                          <Text style={styles.breadcrumbChipText}>{part}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {folderParentPath !== null ? (
                    <Pressable
                      style={styles.secondaryInlineButton}
                      onPress={() => setFolderPath(folderParentPath ?? "")}
                    >
                      <Text style={styles.secondaryInlineButtonText}>Back Up One Folder</Text>
                    </Pressable>
                  ) : null}
                  {folderEntries.length ? (
                    <View style={styles.folderList}>
                      {folderEntries.map((entry) => (
                        <Pressable
                          key={entry.path}
                          style={styles.folderRow}
                          onPress={() => setFolderPath(entry.path)}
                        >
                          <Text style={styles.folderName}>{entry.name}</Text>
                          <Text style={styles.folderPath}>{entry.path}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}

              <Text style={styles.selectedCount}>
                {selectedCountForLoadedPhotos} selected on this screen
              </Text>
              <Text style={styles.totalCount}>Showing {activePhotos.length} of {totalCount}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.stateText}>Loading photos...</Text>
            </View>
          ) : mode === "folders" && folderEntries.length && !message ? null : (
            <View style={styles.stateCard}>
              <Text style={styles.stateText}>{message || "No photos found."}</Text>
            </View>
          )
        }
        ListFooterComponent={
          <View style={styles.footerBlock}>
            {hasMore ? (
              <Pressable
                style={styles.loadMoreButton}
                onPress={() => {
                  if (mode === "search") {
                    void runSearch(true);
                    return;
                  }

                  if (mode === "folders") {
                    void runFolderLoadMore();
                  }
                }}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  <ActivityIndicator color={theme.colors.buttonText} />
                ) : (
                  <Text style={styles.loadMoreButtonText}>Load More</Text>
                )}
              </Pressable>
            ) : null}

            <View style={styles.footer}>
              <Text style={styles.footerSummary}>
                {selectedAttachments.length} total attached photo
                {selectedAttachments.length === 1 ? "" : "s"}
              </Text>

              <View style={styles.footerActions}>
                <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.primaryButton} onPress={() => router.back()}>
                  <Text style={styles.primaryButtonText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isSelected = selectedAttachments.some(
            (attachment) => attachment.photoId === item.id
          );

          return (
            <ThumbnailCell
              photo={item}
              isSelected={isSelected}
              onPreview={() => setPreviewPhoto(item)}
              onToggle={() => toggleAttachment(mapProviderPhotoToAttachedRef(item))}
            />
          );
        }}
      />

      <Modal visible={previewPhoto !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{previewPhoto?.filename}</Text>
            {previewPhoto ? (
              <Image source={getPhotoImageSource(previewPhoto.viewUrl)} style={styles.modalImage} />
            ) : null}
            <Text style={styles.modalStatus}>
              {previewPhoto ? getAttachedPhotoSyncStatusLabel("linked_to_nas") : ""}
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => setPreviewPhoto(null)}>
              <Text style={styles.primaryButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  listContent: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  headerBlock: {
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.lg,
  },
  header: {
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.hero,
    fontWeight: "700",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  modeTabs: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    flexDirection: "row",
    padding: 4,
  },
  modeTab: {
    alignItems: "center",
    borderRadius: theme.radii.pill,
    flex: 1,
    paddingVertical: theme.spacing.sm,
  },
  modeTabActive: {
    backgroundColor: theme.colors.accent,
  },
  modeTabText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  modeTabTextActive: {
    color: theme.colors.buttonText,
  },
  toolbar: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  searchInput: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  sectionCaption: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  dateLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  togglePill: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    height: 20,
    width: 20,
  },
  togglePillActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  toggleText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
  },
  primaryInlineButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    justifyContent: "center",
    minHeight: 44,
  },
  primaryInlineButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  secondaryInlineButton: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
  },
  secondaryInlineButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  breadcrumbRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.xs,
  },
  breadcrumbChip: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  breadcrumbChipText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
  },
  folderList: {
    gap: theme.spacing.sm,
  },
  folderRow: {
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: 2,
    padding: theme.spacing.md,
  },
  folderName: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  folderPath: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  selectedCount: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  totalCount: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  stateCard: {
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    justifyContent: "center",
    padding: theme.spacing.xl,
  },
  stateText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    textAlign: "center",
  },
  gridRow: {
    gap: theme.spacing.md,
  },
  photoCell: {
    flex: 1,
  },
  photoCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.sm,
  },
  photoCardSelected: {
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
  thumbnailFallback: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
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
  photoFilename: {
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
  footerBlock: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  loadMoreButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    justifyContent: "center",
    minHeight: 46,
  },
  loadMoreButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  footer: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  footerSummary: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
  },
  footerActions: {
    flexDirection: "row",
    gap: theme.spacing.sm,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  primaryButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.body,
    fontWeight: "700",
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
  modalStatus: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
});
