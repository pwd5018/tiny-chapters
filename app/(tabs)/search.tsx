import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";

import { DatePickerField } from "@/components/DatePickerField";
import { FadeInView } from "@/components/FadeInView";
import { MemoryCard } from "@/components/MemoryCard";
import { ScreenHero } from "@/components/ScreenHero";
import { getMemoryImportanceLabel, getMemoryLifecycleLabel } from "@/lib/memoryMetadata";
import { toLocalDateKey } from "@/lib/dates";
import { useMemoryService } from "@/services/memoryService";
import { theme } from "@/theme/theme";
import type {
  AttachedPhotoSyncStatus,
  MemoryCollection,
  MemoryEntity,
  MemoryEntityKind,
  MemoryImportance,
  MemoryLifecycleStatus,
  MemoryRetrievalResult,
} from "@/types/memory";

const PHOTO_STATUS_FILTERS: Array<{
  key: AttachedPhotoSyncStatus;
  label: string;
}> = [
  { key: "linked_to_nas", label: "NAS linked" },
  { key: "pending_nas_match", label: "Pending match" },
  { key: "local_only", label: "Local only" },
  { key: "missing", label: "Missing" },
  { key: "preserved_copy", label: "Preserved copy" },
];

const ENTITY_FILTER_GROUPS: Array<{ kind: MemoryEntityKind; label: string }> = [
  { kind: "person", label: "People" },
  { kind: "place", label: "Places" },
  { kind: "project", label: "Projects" },
  { kind: "topic", label: "Topics" },
  { kind: "tag", label: "Canonical tags" },
];

const MAX_VISIBLE_ENTITIES = 8;

function parseTagFilters(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function buildFilterSummary(options: {
  query: string;
  tagFilters: string[];
  selectedCollections: MemoryCollection[];
  selectedEntities: MemoryEntity[];
  fromEnabled: boolean;
  fromDate: string;
  toEnabled: boolean;
  toDate: string;
  photosOnly: boolean;
  guidedOnly: boolean;
  favoritesOnly: boolean;
  lifecycleStatuses: MemoryLifecycleStatus[];
  importance: MemoryImportance[];
  photoStatuses: AttachedPhotoSyncStatus[];
}) {
  const parts: string[] = [];

  if (options.query.trim()) {
    parts.push(`text "${options.query.trim()}"`);
  }

  if (options.tagFilters.length) {
    parts.push(`tags ${options.tagFilters.map((tag) => `#${tag}`).join(", ")}`);
  }

  if (options.selectedCollections.length) {
    parts.push(
      `collections ${options.selectedCollections.map((collection) => collection.title).join(", ")}`
    );
  }

  if (options.selectedEntities.length) {
    parts.push(
      `archive vocabulary ${options.selectedEntities.map((entity) => entity.canonicalName).join(", ")}`
    );
  }

  if (options.fromEnabled || options.toEnabled) {
    const fromLabel = options.fromEnabled ? options.fromDate : "any";
    const toLabel = options.toEnabled ? options.toDate : "any";
    parts.push(`dates ${fromLabel} to ${toLabel}`);
  }

  if (options.photosOnly) {
    parts.push("with photos");
  }

  if (options.guidedOnly) {
    parts.push("guided only");
  }

  if (options.favoritesOnly) {
    parts.push("favorites");
  }

  if (options.lifecycleStatuses.length) {
    parts.push(
      `state ${options.lifecycleStatuses.map((status) => getMemoryLifecycleLabel(status)).join(", ")}`
    );
  }

  if (options.importance.length) {
    parts.push(
      `importance ${options.importance.map((value) => getMemoryImportanceLabel(value)).join(", ")}`
    );
  }

  if (options.photoStatuses.length) {
    const labels = PHOTO_STATUS_FILTERS.filter((option) =>
      options.photoStatuses.includes(option.key)
    ).map((option) => option.label);
    parts.push(`photo states ${labels.join(", ")}`);
  }

  return parts.length ? parts.join(" | ") : "All chapters";
}

function FilterPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.filterPill,
        active ? styles.filterPillActive : null,
        pressed ? styles.filterPillPressed : null,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.filterPillText, active ? styles.filterPillTextActive : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SearchScreen() {
  const { getArchiveVocabulary, getCollections, retrieveMemories } = useMemoryService();
  const isFocused = useIsFocused();
  const searchRequestRef = useRef(0);
  const [query, setQuery] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [collections, setCollections] = useState<MemoryCollection[]>([]);
  const [vocabulary, setVocabulary] = useState<MemoryEntity[]>([]);
  const [results, setResults] = useState<MemoryRetrievalResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingReferences, setIsLoadingReferences] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [fromEnabled, setFromEnabled] = useState(false);
  const [toEnabled, setToEnabled] = useState(false);
  const [fromDate, setFromDate] = useState(() => toLocalDateKey(new Date()));
  const [toDate, setToDate] = useState(() => toLocalDateKey(new Date()));
  const [photosOnly, setPhotosOnly] = useState(false);
  const [guidedOnly, setGuidedOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [selectedLifecycleStatuses, setSelectedLifecycleStatuses] = useState<
    MemoryLifecycleStatus[]
  >([]);
  const [selectedImportance, setSelectedImportance] = useState<MemoryImportance[]>([]);
  const [selectedPhotoStatuses, setSelectedPhotoStatuses] = useState<AttachedPhotoSyncStatus[]>(
    []
  );
  const [expandedEntityGroups, setExpandedEntityGroups] = useState<MemoryEntityKind[]>([]);

  const tagFilters = useMemo(() => parseTagFilters(tagInput), [tagInput]);
  const selectedCollections = useMemo(
    () => collections.filter((collection) => selectedCollectionIds.includes(collection.id)),
    [collections, selectedCollectionIds]
  );
  const selectedEntities = useMemo(
    () => vocabulary.filter((entity) => selectedEntityIds.includes(entity.id)),
    [selectedEntityIds, vocabulary]
  );
  const filterSummary = useMemo(
    () =>
      buildFilterSummary({
        query,
        tagFilters,
        selectedCollections,
        selectedEntities,
        fromEnabled,
        fromDate,
        toEnabled,
        toDate,
        photosOnly,
        guidedOnly,
        favoritesOnly,
        lifecycleStatuses: selectedLifecycleStatuses,
        importance: selectedImportance,
        photoStatuses: selectedPhotoStatuses,
      }),
    [
      favoritesOnly,
      fromDate,
      fromEnabled,
      guidedOnly,
      selectedImportance,
      selectedLifecycleStatuses,
      selectedCollections,
      photosOnly,
      query,
      selectedPhotoStatuses,
      selectedEntities,
      tagFilters,
      toDate,
      toEnabled,
    ]
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadReferences() {
        setIsLoadingReferences(true);
        setErrorMessage("");

        try {
          const [nextCollections, nextVocabulary] = await Promise.all([
            getCollections(),
            getArchiveVocabulary(),
          ]);

          if (isActive) {
            setCollections(nextCollections);
            setVocabulary(nextVocabulary);
          }
        } catch (error) {
          if (isActive) {
            setErrorMessage(error instanceof Error ? error.message : "Could not load search filters.");
          }
        } finally {
          if (isActive) {
            setIsLoadingReferences(false);
          }
        }
      }

      void loadReferences();

      return () => {
        isActive = false;
      };
    }, [getArchiveVocabulary, getCollections])
  );

  const runSearch = useCallback(() => {
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;

    async function loadResults() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const nextResults = await retrieveMemories(
          {
            query,
            from: fromEnabled ? fromDate : null,
            to: toEnabled ? toDate : null,
            tags: tagFilters,
            collectionIds: selectedCollectionIds,
            hasPhotos: photosOnly || selectedPhotoStatuses.length ? true : undefined,
            hasGuidedContext: guidedOnly ? true : undefined,
            isFavorite: favoritesOnly ? true : undefined,
            lifecycleStatuses: selectedLifecycleStatuses,
            importance: selectedImportance,
            photoStatuses: selectedPhotoStatuses,
            entityIds: selectedEntityIds,
          },
          { vocabulary }
        );

        if (requestId === searchRequestRef.current) {
          setResults(nextResults);
        }
      } catch (error) {
        if (requestId === searchRequestRef.current) {
          setErrorMessage(error instanceof Error ? error.message : "Could not search chapters.");
        }
      } finally {
        if (requestId === searchRequestRef.current) {
          setIsLoading(false);
        }
      }
    }

    void loadResults();
  }, [
    fromDate,
    fromEnabled,
    favoritesOnly,
    guidedOnly,
    photosOnly,
    query,
    selectedCollectionIds,
    selectedEntityIds,
    selectedImportance,
    selectedLifecycleStatuses,
    retrieveMemories,
    selectedPhotoStatuses,
    tagFilters,
    toDate,
    toEnabled,
    vocabulary,
  ]);

  useEffect(() => {
    if (!isFocused || isLoadingReferences) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      void runSearch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [isFocused, isLoadingReferences, runSearch]);

  const clearFilters = () => {
    setQuery("");
    setTagInput("");
    setFromEnabled(false);
    setToEnabled(false);
    setFromDate(toLocalDateKey(new Date()));
    setToDate(toLocalDateKey(new Date()));
    setPhotosOnly(false);
    setGuidedOnly(false);
    setFavoritesOnly(false);
    setSelectedCollectionIds([]);
    setSelectedEntityIds([]);
    setSelectedLifecycleStatuses([]);
    setSelectedImportance([]);
    setSelectedPhotoStatuses([]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <FadeInView>
        <ScreenHero
          eyebrow="Search"
          title="Find the exact moment you meant."
          subtitle="Search chapter text, prompts, tags, guided answers, dates, and photo reference details with stronger filters."
          orbLargeColor="#E8D9C8"
          orbSmallColor="#DDBFA7"
        />
      </FadeInView>

      <FadeInView delay={80}>
        <View style={styles.searchShell}>
          <View style={styles.searchHeaderRow}>
            <Text style={styles.searchLabel}>Search your archive</Text>
            <Pressable onPress={clearFilters} style={({ pressed }) => [pressed ? styles.linkPressed : null]}>
              <Text style={styles.clearText}>Clear filters</Text>
            </Pressable>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by chapter text, prompt, tag, collection, date, or photo details"
            placeholderTextColor={theme.colors.textSoft}
            style={styles.searchInput}
          />

          <Text style={styles.helperText}>
            Use commas for exact tag filters, then narrow by date or attachment state below.
          </Text>

          <TextInput
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="Tags: birthday, beach, grandparents"
            placeholderTextColor={theme.colors.textSoft}
            style={styles.searchInput}
          />

          <View style={styles.filterGroup}>
            <Text style={styles.groupLabel}>Collections</Text>
            {collections.length ? (
              <View style={styles.filterWrapRow}>
                {collections.map((collection) => {
                  const active = selectedCollectionIds.includes(collection.id);
                  return (
                    <FilterPill
                      key={collection.id}
                      label={collection.title}
                      active={active}
                      onPress={() =>
                        setSelectedCollectionIds((current) =>
                          current.includes(collection.id)
                            ? current.filter((id) => id !== collection.id)
                            : [...current, collection.id]
                        )
                      }
                    />
                  );
                })}
              </View>
            ) : (
              <Text style={styles.helperText}>
                Create collections from Write or chapter detail and they will show up here.
              </Text>
            )}
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.groupLabel}>Archive vocabulary</Text>
            {vocabulary.some((entity) => entity.memoryCount > 0) ? (
              ENTITY_FILTER_GROUPS.map((group) => {
                const entities = vocabulary
                  .filter((entity) => entity.kind === group.kind && entity.memoryCount > 0)
                  .sort((left, right) => {
                    if (right.memoryCount !== left.memoryCount) {
                      return right.memoryCount - left.memoryCount;
                    }

                    return left.canonicalName.localeCompare(right.canonicalName);
                  });
                if (!entities.length) {
                  return null;
                }

                const isExpanded = expandedEntityGroups.includes(group.kind);
                const visibleEntities = isExpanded
                  ? entities
                  : entities.slice(0, MAX_VISIBLE_ENTITIES);

                return (
                  <View key={group.kind} style={styles.entityGroup}>
                    <Text style={styles.entityGroupLabel}>{group.label}</Text>
                    <View style={styles.filterWrapRow}>
                      {visibleEntities.map((entity) => {
                        const active = selectedEntityIds.includes(entity.id);
                        return (
                          <FilterPill
                            key={entity.id}
                            label={`${entity.canonicalName} (${entity.memoryCount})`}
                            active={active}
                            onPress={() =>
                              setSelectedEntityIds((current) =>
                                current.includes(entity.id)
                                  ? current.filter((id) => id !== entity.id)
                                  : [...current, entity.id]
                              )
                            }
                          />
                        );
                      })}
                    </View>
                    {entities.length > MAX_VISIBLE_ENTITIES ? (
                      <Pressable
                        onPress={() =>
                          setExpandedEntityGroups((current) =>
                            current.includes(group.kind)
                              ? current.filter((kind) => kind !== group.kind)
                              : [...current, group.kind]
                          )
                        }
                      >
                        <Text style={styles.clearText}>
                          {isExpanded ? "Show fewer" : `Show ${entities.length - MAX_VISIBLE_ENTITIES} more`}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={styles.helperText}>
                Confirmed people, places, projects, topics, and tags will appear here as your archive grows.
              </Text>
            )}
            <Text style={styles.helperText}>
              Search also recognizes saved aliases and returns the canonical archive value.
            </Text>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.groupLabel}>Date filters</Text>
            <View style={styles.filterRow}>
              <FilterPill
                label={fromEnabled ? "From date on" : "From date"}
                active={fromEnabled}
                onPress={() => setFromEnabled((current) => !current)}
              />
              <FilterPill
                label={toEnabled ? "To date on" : "To date"}
                active={toEnabled}
                onPress={() => setToEnabled((current) => !current)}
              />
            </View>
            {fromEnabled ? (
              <DatePickerField
                value={fromDate}
                onChange={setFromDate}
                label="From"
                actionLabel="Pick"
                modalTitle="Choose earliest day"
              />
            ) : null}
            {toEnabled ? (
              <DatePickerField
                value={toDate}
                onChange={setToDate}
                label="To"
                actionLabel="Pick"
                modalTitle="Choose latest day"
              />
            ) : null}
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.groupLabel}>Memory filters</Text>
            <View style={styles.filterRow}>
              <FilterPill
                label="With photos"
                active={photosOnly}
                onPress={() => setPhotosOnly((current) => !current)}
              />
              <FilterPill
                label="Guided only"
                active={guidedOnly}
                onPress={() => setGuidedOnly((current) => !current)}
              />
              <FilterPill
                label="Favorites"
                active={favoritesOnly}
                onPress={() => setFavoritesOnly((current) => !current)}
              />
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.groupLabel}>Lifecycle</Text>
            <View style={styles.filterWrapRow}>
              {(["draft", "finalized"] as MemoryLifecycleStatus[]).map((status) => {
                const active = selectedLifecycleStatuses.includes(status);
                return (
                  <FilterPill
                    key={status}
                    label={getMemoryLifecycleLabel(status)}
                    active={active}
                    onPress={() =>
                      setSelectedLifecycleStatuses((current) =>
                        current.includes(status)
                          ? current.filter((value) => value !== status)
                          : [...current, status]
                      )
                    }
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.groupLabel}>Importance</Text>
            <View style={styles.filterWrapRow}>
              {([1, 2, 3] as MemoryImportance[]).map((importance) => {
                const active = selectedImportance.includes(importance);
                return (
                  <FilterPill
                    key={importance}
                    label={getMemoryImportanceLabel(importance)}
                    active={active}
                    onPress={() =>
                      setSelectedImportance((current) =>
                        current.includes(importance)
                          ? current.filter((value) => value !== importance)
                          : [...current, importance]
                      )
                    }
                  />
                );
              })}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.groupLabel}>Photo durability</Text>
            <View style={styles.filterWrapRow}>
              {PHOTO_STATUS_FILTERS.map((option) => {
                const active = selectedPhotoStatuses.includes(option.key);
                return (
                  <FilterPill
                    key={option.key}
                    label={option.label}
                    active={active}
                    onPress={() =>
                      setSelectedPhotoStatuses((current) =>
                        current.includes(option.key)
                          ? current.filter((status) => status !== option.key)
                          : [...current, option.key]
                      )
                    }
                  />
                );
              })}
            </View>
          </View>
        </View>
      </FadeInView>

      <FadeInView delay={120}>
        <View style={styles.summaryCard}>
          <Text style={styles.resultCount}>
            {results.length} {results.length === 1 ? "chapter" : "chapters"}
          </Text>
          <Text style={styles.summaryText}>{filterSummary}</Text>
        </View>
      </FadeInView>

      {isLoading ? (
        <FadeInView delay={150}>
          <View style={styles.stateCard}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.stateText}>Searching chapters...</Text>
          </View>
        </FadeInView>
      ) : errorMessage ? (
        <FadeInView delay={150}>
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        </FadeInView>
      ) : (
        <View style={styles.list}>
          {results.map((result, index) => (
            <FadeInView key={result.memory.id} delay={170 + index * 35} distance={10}>
              <MemoryCard memory={result.memory} />
              {result.matches.length ? (
                <Text style={styles.matchEvidence}>
                  {result.matches.map((match) => match.label).join(" · ")}
                </Text>
              ) : null}
            </FadeInView>
          ))}
          {!results.length ? (
            <FadeInView delay={170}>
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>
                  No chapters matched these filters. Try widening the date range or removing a tag.
                </Text>
              </View>
            </FadeInView>
          ) : null}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  matchEvidence: {
    color: theme.colors.textSoft,
    fontSize: theme.typography.caption,
    lineHeight: 17,
    marginTop: -theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  searchShell: {
    backgroundColor: "#F6EBDD",
    borderColor: "#E5D2BE",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  searchHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md,
  },
  searchLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  clearText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  linkPressed: {
    opacity: 0.72,
  },
  searchInput: {
    backgroundColor: "#FFF9F3",
    borderColor: "#E7D8C8",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    lineHeight: 22,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  filterGroup: {
    gap: theme.spacing.sm,
  },
  entityGroup: {
    gap: theme.spacing.xs,
  },
  entityGroupLabel: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  groupLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  filterWrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
  },
  filterPill: {
    backgroundColor: "#FFF9F3",
    borderColor: "#E7D8C8",
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  filterPillActive: {
    backgroundColor: "#D97841",
    borderColor: "#D97841",
  },
  filterPillPressed: {
    opacity: 0.9,
  },
  filterPillText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  filterPillTextActive: {
    color: "#FFF8F1",
  },
  summaryCard: {
    backgroundColor: "#FFF8F1",
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  resultCount: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  summaryText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  list: {
    gap: theme.spacing.md,
  },
  stateCard: {
    alignItems: "center",
    backgroundColor: "#FFF8F1",
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
    fontSize: theme.typography.body,
    textAlign: "center",
  },
});
