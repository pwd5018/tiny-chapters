import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { DatePickerField } from "@/components/DatePickerField";
import { FadeInView } from "@/components/FadeInView";
import { MemoryCard } from "@/components/MemoryCard";
import { ScreenHero } from "@/components/ScreenHero";
import { toLocalDateKey } from "@/lib/dates";
import { useMemoryService } from "@/services/memoryService";
import { theme } from "@/theme/theme";
import type { Memory, AttachedPhotoSyncStatus, MemoryCollection } from "@/types/memory";

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

function parseTagFilters(value: string) {
  return [...new Set(value.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}

function buildFilterSummary(options: {
  query: string;
  tagFilters: string[];
  selectedCollections: MemoryCollection[];
  fromEnabled: boolean;
  fromDate: string;
  toEnabled: boolean;
  toDate: string;
  photosOnly: boolean;
  guidedOnly: boolean;
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
  const { getCollections, searchMemories } = useMemoryService();
  const [query, setQuery] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [collections, setCollections] = useState<MemoryCollection[]>([]);
  const [results, setResults] = useState<Memory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [fromEnabled, setFromEnabled] = useState(false);
  const [toEnabled, setToEnabled] = useState(false);
  const [fromDate, setFromDate] = useState(() => toLocalDateKey(new Date()));
  const [toDate, setToDate] = useState(() => toLocalDateKey(new Date()));
  const [photosOnly, setPhotosOnly] = useState(false);
  const [guidedOnly, setGuidedOnly] = useState(false);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [selectedPhotoStatuses, setSelectedPhotoStatuses] = useState<AttachedPhotoSyncStatus[]>(
    []
  );

  const tagFilters = useMemo(() => parseTagFilters(tagInput), [tagInput]);
  const selectedCollections = useMemo(
    () => collections.filter((collection) => selectedCollectionIds.includes(collection.id)),
    [collections, selectedCollectionIds]
  );
  const filterSummary = useMemo(
    () =>
      buildFilterSummary({
        query,
        tagFilters,
        selectedCollections,
        fromEnabled,
        fromDate,
        toEnabled,
        toDate,
        photosOnly,
        guidedOnly,
        photoStatuses: selectedPhotoStatuses,
      }),
    [
      fromDate,
      fromEnabled,
      guidedOnly,
      selectedCollections,
      photosOnly,
      query,
      selectedPhotoStatuses,
      tagFilters,
      toDate,
      toEnabled,
    ]
  );

  const runSearch = useCallback(() => {
    let isActive = true;

    async function loadResults() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [nextResults, nextCollections] = await Promise.all([
          searchMemories({
          query,
          from: fromEnabled ? fromDate : null,
          to: toEnabled ? toDate : null,
          tags: tagFilters,
          collectionIds: selectedCollectionIds,
          hasPhotos: photosOnly || selectedPhotoStatuses.length ? true : undefined,
          hasGuidedContext: guidedOnly ? true : undefined,
          photoStatuses: selectedPhotoStatuses,
          }),
          getCollections(),
        ]);

        if (isActive) {
          setResults(nextResults);
          setCollections(nextCollections);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(error instanceof Error ? error.message : "Could not search chapters.");
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadResults();

    return () => {
      isActive = false;
    };
  }, [
    fromDate,
    fromEnabled,
      guidedOnly,
      getCollections,
      photosOnly,
      query,
      selectedCollectionIds,
      searchMemories,
      selectedPhotoStatuses,
      tagFilters,
    toDate,
    toEnabled,
  ]);

  useFocusEffect(runSearch);

  const clearFilters = () => {
    setQuery("");
    setTagInput("");
    setFromEnabled(false);
    setToEnabled(false);
    setFromDate(toLocalDateKey(new Date()));
    setToDate(toLocalDateKey(new Date()));
    setPhotosOnly(false);
    setGuidedOnly(false);
    setSelectedCollectionIds([]);
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
          {results.map((memory, index) => (
            <FadeInView key={memory.id} delay={170 + index * 35} distance={10}>
              <MemoryCard memory={memory} />
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
