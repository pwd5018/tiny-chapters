import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FadeInView } from "@/components/FadeInView";
import { DatePickerField } from "@/components/DatePickerField";
import { ScreenHero } from "@/components/ScreenHero";
import {
  composeGuidedMemoryText,
  generateLocalGuidedFollowUpQuestions,
} from "@/features/write/guidedFollowUps";
import { createMemoryGuidanceContext } from "@/features/write/guidedMemoryDraft";
import { polishGuidedMemoryDraftLocally } from "@/features/write/polishMemoryDraft";
import { useWriteDraft } from "@/features/write/writeDraftContext";
import {
  generateGuidedFollowUpsWithAi,
  isAiGatewayConfigured,
  polishGuidedMemoryWithAi,
} from "@/services/ai/aiService";
import {
  addDiagnosticsEvent,
  isDeveloperModeEnabled,
} from "@/services/diagnostics/diagnosticsService";
import { useMemoryService } from "@/services/memoryService";
import { requestCameraPermission } from "@/services/permissions/permissionService";
import {
  getAttachedPhotoDisplayName,
  getAttachedPhotoPreviewUri,
  getAttachedPhotoSyncStatusLabel,
} from "@/services/photo/photoDurability";
import { usePhotoAttachments } from "@/services/photo/photoAttachmentContext";
import { attemptNasRelinkForRef } from "@/services/photo/photoRelinkService";
import { getPhotoImageSource, isNasPhotoMatchingAvailable } from "@/services/photo/photoService";
import { theme } from "@/theme/theme";
import type { AttachedPhotoRef } from "@/types/memory";
import { parseDateKeyAsLocalDate } from "@/lib/dates";

type AiDebugStatus = {
  source: "ai" | "fallback" | "local";
  summary: string;
};

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
    syncStatus: isNasPhotoMatchingAvailable() ? "pending_nas_match" : "local_only",
  };
}

function formatDateLabel(dateKey: string) {
  return parseDateKeyAsLocalDate(dateKey).toLocaleDateString(undefined, {
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

type PhotoOptionProps = {
  photo: never;
};

export function WriteMemoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ section?: string }>();
  const scrollViewRef = useRef<ScrollView | null>(null);
  const attachmentScope = "write";
  const { createMemory, getDailyPrompt, getMemoryCountForDate } = useMemoryService();
  const {
    memoryText,
    setMemoryText,
    selectedDateKey,
    setSelectedDateKey,
    guidedMemoryDraft,
    ensureGuidedMemoryDraft,
    setGuidedFollowUpQuestions,
    setGuidedFollowUpAnswer,
    skipGuidedFollowUp,
    setGuidedPolishedSuggestion,
    clearDraft,
  } = useWriteDraft();
  const {
    getAttachments,
    addAttachmentForScope,
    removeAttachmentForScope,
    clearAttachmentsForScope,
    setPickerScope,
  } = usePhotoAttachments();

  const selectedAttachments = getAttachments(attachmentScope);
  const [saveMessage, setSaveMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [photoStatusMessage, setPhotoStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLaunchingCamera, setIsLaunchingCamera] = useState(false);
  const [photoSectionOffset, setPhotoSectionOffset] = useState(0);
  const [isPhotoPanelOpen, setIsPhotoPanelOpen] = useState(false);
  const [isGeneratingGuidance, setIsGeneratingGuidance] = useState(false);
  const [isPolishingDraft, setIsPolishingDraft] = useState(false);
  const [developerModeEnabled, setDeveloperModeEnabled] = useState(false);
  const [followUpDebugStatus, setFollowUpDebugStatus] = useState<AiDebugStatus | null>(null);
  const [polishDebugStatus, setPolishDebugStatus] = useState<AiDebugStatus | null>(null);
  const [dailyPrompt, setDailyPrompt] = useState("What made today worth remembering?");
  const [sameDayMemoryCount, setSameDayMemoryCount] = useState(0);

  const followUps = guidedMemoryDraft?.followUps ?? [];
  const answeredFollowUps = followUps.filter((followUp) => followUp.status === "answered");
  const skippedFollowUps = followUps.filter((followUp) => followUp.status === "skipped");
  const hasGeneratedFollowUps = followUps.length > 0;
  const polishedSuggestion = guidedMemoryDraft?.polishedSuggestion?.trim() ?? "";

  useEffect(() => {
    let isActive = true;

    async function loadDailyPrompt() {
      try {
        const selectedDate = parseDateKeyAsLocalDate(selectedDateKey);
        const [prompt, count] = await Promise.all([
          getDailyPrompt(selectedDate),
          getMemoryCountForDate(selectedDate),
        ]);
        if (isActive) {
          setDailyPrompt(prompt);
          setSameDayMemoryCount(count);
        }
      } catch {
        if (isActive) {
          setDailyPrompt("What made today worth remembering?");
          setSameDayMemoryCount(0);
        }
      }
    }

    void loadDailyPrompt();

    return () => {
      isActive = false;
    };
  }, [getDailyPrompt, getMemoryCountForDate, selectedDateKey]);

  useEffect(() => {
    ensureGuidedMemoryDraft(dailyPrompt);
  }, [dailyPrompt, ensureGuidedMemoryDraft]);

  useEffect(() => {
    let isActive = true;

    void isDeveloperModeEnabled().then((enabled) => {
      if (isActive) {
        setDeveloperModeEnabled(enabled);
      }
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (params.section !== "photos") {
      return;
    }

    setIsPhotoPanelOpen(true);

    const timeout = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: 0,
        y: Math.max(photoSectionOffset - theme.spacing.lg, 0),
        animated: true,
      });
    }, 50);

    return () => clearTimeout(timeout);
  }, [params.section, photoSectionOffset]);

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
      setErrorMessage(error instanceof Error ? error.message : "Could not launch the camera.");
    } finally {
      setIsLaunchingCamera(false);
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
        date: parseDateKeyAsLocalDate(selectedDateKey).toISOString(),
        prompt: dailyPrompt,
        text: trimmed,
        tags: [],
        guidedContext: createMemoryGuidanceContext(guidedMemoryDraft),
        attachedPhotos: selectedAttachments,
      });

      clearDraft();
      clearAttachmentsForScope(attachmentScope);
      router.replace("/(tabs)" as never);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save the memory.");
    } finally {
      setIsSaving(false);
    }
  };

  const recordAiDebugStatus = async (
    kind: "followUps" | "polish",
    status: AiDebugStatus,
    detail: string
  ) => {
    if (kind === "followUps") {
      setFollowUpDebugStatus(status);
    } else {
      setPolishDebugStatus(status);
    }

    if (!developerModeEnabled) {
      return;
    }

    await addDiagnosticsEvent({
      category: "developer",
      level: status.source === "ai" ? "success" : "info",
      title: kind === "followUps" ? "AI follow-up source" : "AI polish source",
      detail,
    });
  };

  const handleGenerateFollowUps = async () => {
    const trimmed = memoryText.trim();
    const answeredFollowUpAnswers =
      guidedMemoryDraft?.followUps
        .filter((followUp) => followUp.status === "answered" && followUp.answer.trim())
        .map((followUp) => followUp.answer.trim()) ?? [];
    const originalAnswer = guidedMemoryDraft?.originalAnswer.trim() || trimmed;
    const composedText = guidedMemoryDraft?.composedText.trim() || trimmed;

    if (!trimmed) {
      setSaveMessage("");
      setErrorMessage("Write your first answer before asking Tiny Chapters to guide you further.");
      return;
    }

    setIsGeneratingGuidance(true);

    try {
      if (isAiGatewayConfigured()) {
        const result = await generateGuidedFollowUpsWithAi(
          dailyPrompt,
          originalAnswer,
          composedText,
          answeredFollowUpAnswers
        );
        setGuidedFollowUpQuestions(result.questions);
        setSaveMessage(
          `AI follow-up questions are ready using ${result.provider}${result.model ? ` (${result.model})` : ""}.`
        );
        setErrorMessage("");
        await recordAiDebugStatus(
          "followUps",
          {
            source: "ai",
            summary: `AI via ${result.provider}${result.model ? ` (${result.model})` : ""}`,
          },
          `Follow-up questions came from AI via ${result.provider}${result.model ? ` model=${result.model}` : ""}.`
        );
        return;
      }

      const nextQuestions = generateLocalGuidedFollowUpQuestions(dailyPrompt, trimmed);

      if (!nextQuestions.length) {
        setSaveMessage("");
        setErrorMessage(
          "Tiny Chapters could not shape gentle follow-up questions from that answer yet."
        );
        return;
      }

      setGuidedFollowUpQuestions(nextQuestions);
      setSaveMessage("A few gentle local follow-up questions are ready below.");
      setErrorMessage("");
      await recordAiDebugStatus(
        "followUps",
        {
          source: "local",
          summary: "Local helper",
        },
        "Follow-up questions came from the local helper because the AI gateway is not configured."
      );
    } catch (error) {
      const nextQuestions = generateLocalGuidedFollowUpQuestions(dailyPrompt, trimmed);

      if (!nextQuestions.length) {
        setSaveMessage("");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Tiny Chapters could not shape follow-up questions right now."
        );
        return;
      }

      setGuidedFollowUpQuestions(nextQuestions);
      setSaveMessage(
        "AI guidance was unavailable, so Tiny Chapters fell back to the local follow-up helper."
      );
      setErrorMessage("");
      await recordAiDebugStatus(
        "followUps",
        {
          source: "fallback",
          summary: "Fallback to local helper",
        },
        `Follow-up questions fell back to the local helper after AI guidance failed${error instanceof Error ? `: ${error.message}` : "."}`
      );
    } finally {
      setIsGeneratingGuidance(false);
    }
  };

  const handlePolishDraft = async () => {
    if (!guidedMemoryDraft) {
      return;
    }

    const nextDraft = {
      ...guidedMemoryDraft,
      composedText: composeGuidedMemoryText(guidedMemoryDraft),
    };

    setIsPolishingDraft(true);

    try {
      if (isAiGatewayConfigured()) {
        const result = await polishGuidedMemoryWithAi(nextDraft);
        setGuidedPolishedSuggestion(result.polishedText);
        setSaveMessage(
          `A polished version is ready using ${result.provider}${result.model ? ` (${result.model})` : ""}.`
        );
        setErrorMessage("");
        await recordAiDebugStatus(
          "polish",
          {
            source: "ai",
            summary: `AI via ${result.provider}${result.model ? ` (${result.model})` : ""}`,
          },
          `Polished memory came from AI via ${result.provider}${result.model ? ` model=${result.model}` : ""}.`
        );
        return;
      }

      const polished = polishGuidedMemoryDraftLocally(nextDraft);

      if (!polished) {
        setSaveMessage("");
        setErrorMessage("Tiny Chapters needs a real memory before it can polish anything.");
        return;
      }

      setGuidedPolishedSuggestion(polished);
      setSaveMessage("A local polished version is ready below.");
      setErrorMessage("");
      await recordAiDebugStatus(
        "polish",
        {
          source: "local",
          summary: "Local cleanup helper",
        },
        "Polished memory came from the local cleanup helper because the AI gateway is not configured."
      );
    } catch (error) {
      const polished = polishGuidedMemoryDraftLocally(nextDraft);

      if (!polished) {
        setSaveMessage("");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Tiny Chapters could not polish this memory right now."
        );
        return;
      }

      setGuidedPolishedSuggestion(polished);
      setSaveMessage(
        "The AI polish step was unavailable, so Tiny Chapters used the local cleanup helper instead."
      );
      setErrorMessage("");
      await recordAiDebugStatus(
        "polish",
        {
          source: "fallback",
          summary: "Fallback to local cleanup helper",
        },
        `Polished memory fell back to the local cleanup helper after AI polish failed${error instanceof Error ? `: ${error.message}` : "."}`
      );
    } finally {
      setIsPolishingDraft(false);
    }
  };

  const handleUsePolishedDraft = () => {
    if (!polishedSuggestion) {
      return;
    }

    setMemoryText(polishedSuggestion);
    setSaveMessage("The polished version is now in the editor. You can still edit it before saving.");
    setErrorMessage("");
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <FadeInView>
            <ScreenHero
              eyebrow="Write"
              title="Capture today's memory."
              subtitle="A focused place for the words first, with photos there when they help the story."
              orbLargeColor="#EFD4B8"
              orbSmallColor="#E7BA9D"
            >
              <View style={styles.header}>
                <Pressable
                  style={({ pressed }) => [
                    styles.backButton,
                    pressed ? styles.backButtonPressed : null,
                  ]}
                  onPress={() => router.back()}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </Pressable>
              </View>

              <View style={styles.promptCard}>
                <Text style={styles.promptLabel}>
                  {sameDayMemoryCount > 0 ? "Another question for this day" : "Today's question"}
                </Text>
                <Text style={styles.promptText}>{dailyPrompt}</Text>
                <Text style={styles.promptHelper}>
                  {sameDayMemoryCount > 0
                    ? `You already saved ${sameDayMemoryCount} ${sameDayMemoryCount === 1 ? "memory" : "memories"} for this date. This prompt is here to help you catch a different part of the day.`
                    : "A tiny answer is enough. You can always come back and add more later."}
                </Text>
              </View>
            </ScreenHero>
          </FadeInView>

          <FadeInView delay={80}>
            <View style={styles.editorCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>
                  {hasGeneratedFollowUps ? "Final Draft" : "Start Here"}
                </Text>
                <Text style={styles.sectionLabel}>
                  {hasGeneratedFollowUps ? "Shape the memory" : "Your first answer"}
                </Text>
                <Text style={styles.sectionHint}>
                  {hasGeneratedFollowUps
                    ? "Your original answer stays preserved below. This editor is still the memory you will save."
                    : sameDayMemoryCount > 0
                      ? "This can be a second angle, a later scene, or one tiny detail that deserves its own memory."
                      : "Keep it small. Keep it real. A few honest lines are enough to begin."}
                </Text>
              </View>
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
              {!hasGeneratedFollowUps ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.guidedActionButton,
                    pressed ? styles.guidedActionButtonPressed : null,
                  ]}
                  onPress={() => void handleGenerateFollowUps()}
                  disabled={isGeneratingGuidance}
                >
                  {isGeneratingGuidance ? (
                    <ActivityIndicator color={theme.colors.buttonText} />
                  ) : (
                    <Text style={styles.guidedActionButtonText}>Help Me Remember More</Text>
                  )}
                </Pressable>
              ) : null}
              <Text style={styles.guidedDraftHint}>
                {hasGeneratedFollowUps
                  ? "Follow-up answers do not overwrite your first answer. You can keep editing above, or let cleanup turn everything into a tighter sentence."
                  : isAiGatewayConfigured()
                    ? "This write flow can now call the local AI gateway when it is configured, and still falls back gracefully if the gateway is unavailable."
                    : "Tiny Chapters will use local guidance until the AI gateway is configured in photo-api/.env."}
              </Text>
            </View>
          </FadeInView>

          <FadeInView delay={110}>
            <View style={styles.guidedCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionEyebrow}>Guided Questions</Text>
                <Text style={styles.sectionLabel}>A little more, only if it helps</Text>
                <Text style={styles.sectionHint}>
                  Tiny Chapters should feel supportive here, not nosy. You can skip anything.
                </Text>
              </View>

              <View style={styles.originalAnswerCard}>
                <Text style={styles.originalAnswerLabel}>Original answer</Text>
                <Text style={styles.originalAnswerText}>
                  {guidedMemoryDraft?.originalAnswer.trim() || "Start with the base question above, then ask for help remembering more."}
                </Text>
              </View>

              {!hasGeneratedFollowUps ? (
                <View style={styles.guidedEmptyState}>
                  <Text style={styles.guidedEmptyStateText}>
                    Once you answer today's question, Tiny Chapters can offer up to three gentle follow-up prompts here.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.guidedMeta}>
                    {answeredFollowUps.length} answered
                    {" · "}
                    {skippedFollowUps.length} skipped
                    {" · "}
                    {followUps.length} total
                  </Text>

                  <View style={styles.followUpList}>
                    {followUps.map((followUp, index) => (
                      <View key={followUp.id} style={styles.followUpCard}>
                        <View style={styles.followUpHeader}>
                          <Text style={styles.followUpIndex}>Follow-up {index + 1}</Text>
                          <Pressable
                            style={({ pressed }) => [
                              styles.skipButton,
                              pressed ? styles.skipButtonPressed : null,
                            ]}
                            onPress={() => skipGuidedFollowUp(followUp.id)}
                          >
                            <Text style={styles.skipButtonText}>
                              {followUp.status === "skipped" ? "Skipped" : "Skip"}
                            </Text>
                          </Pressable>
                        </View>
                        <Text style={styles.followUpQuestion}>{followUp.question}</Text>
                        <TextInput
                          value={followUp.answer}
                          onChangeText={(value) => {
                            setGuidedFollowUpAnswer(followUp.id, value);
                            if (saveMessage || errorMessage) {
                              setSaveMessage("");
                              setErrorMessage("");
                            }
                          }}
                          placeholder="Add a little more if it helps..."
                          placeholderTextColor={theme.colors.textSoft}
                          multiline
                          textAlignVertical="top"
                          style={styles.followUpInput}
                        />
                      </View>
                    ))}
                  </View>

                  <View style={styles.guidedButtonRow}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryGuidedButton,
                        pressed ? styles.secondaryGuidedButtonPressed : null,
                      ]}
                      onPress={() => void handleGenerateFollowUps()}
                      disabled={isGeneratingGuidance}
                    >
                      {isGeneratingGuidance ? (
                        <ActivityIndicator color={theme.colors.accent} />
                      ) : (
                        <Text style={styles.secondaryGuidedButtonText}>Refresh Prompts</Text>
                      )}
                    </Pressable>
                  </View>

                  <View style={styles.polishCard}>
                    <View style={styles.polishHeader}>
                      <View style={styles.polishHeaderCopy}>
                        <Text style={styles.sectionEyebrow}>Optional Cleanup</Text>
                        <Text style={styles.sectionLabel}>Polish this memory</Text>
                        <Text style={styles.sectionHint}>
                          Helpful when your answers are sparse and you want Tiny Chapters to turn them into a short, more natural thought.
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        styles.secondaryGuidedButton,
                        pressed ? styles.secondaryGuidedButtonPressed : null,
                      ]}
                      onPress={() => void handlePolishDraft()}
                      disabled={isPolishingDraft}
                    >
                      {isPolishingDraft ? (
                        <ActivityIndicator color={theme.colors.accent} />
                      ) : (
                        <Text style={styles.secondaryGuidedButtonText}>Polish With AI</Text>
                      )}
                    </Pressable>

                    <View style={styles.polishPreviewCard}>
                      <Text style={styles.originalAnswerLabel}>Polished suggestion</Text>
                      <Text style={styles.originalAnswerText}>
                        {polishedSuggestion ||
                          "No polished version yet. Add a little detail, then generate a cleaner short version here."}
                      </Text>
                    </View>

                    <View style={styles.guidedButtonRow}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.guidedActionButton,
                          pressed ? styles.guidedActionButtonPressed : null,
                          !polishedSuggestion ? styles.disabledButton : null,
                        ]}
                        onPress={handleUsePolishedDraft}
                        disabled={!polishedSuggestion}
                      >
                        <Text style={styles.guidedActionButtonText}>Use Polished Version</Text>
                      </Pressable>
                    </View>
                  </View>

                  {developerModeEnabled ? (
                    <View style={styles.debugCard}>
                      <Text style={styles.debugTitle}>Developer AI Status</Text>
                      <Text style={styles.debugText}>
                        Follow-ups: {followUpDebugStatus?.summary ?? "No follow-up request yet"}
                      </Text>
                      <Text style={styles.debugText}>
                        Cleanup: {polishDebugStatus?.summary ?? "No cleanup request yet"}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}
            </View>
          </FadeInView>

          <FadeInView delay={140}>
            <View
              style={styles.photoCard}
              onLayout={(event) => setPhotoSectionOffset(event.nativeEvent.layout.y)}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.photoSummaryCard,
                  pressed ? styles.photoSummaryCardPressed : null,
                ]}
                onPress={() => setIsPhotoPanelOpen((current) => !current)}
              >
                <View style={styles.photoSummaryCopy}>
                  <Text style={styles.sectionLabel}>Photos</Text>
                  <Text style={styles.photoHint}>
                    Helpful when they add context, optional when words are enough.
                  </Text>
                </View>
                <View style={styles.photoSummaryMeta}>
                  <Text style={styles.photoSummaryMetaText}>
                    {selectedAttachments.length
                      ? `${selectedAttachments.length} selected`
                      : "None selected"}
                  </Text>
                  <Text style={styles.photoSummaryAction}>
                    {isPhotoPanelOpen ? "Hide" : "Show"}
                  </Text>
                </View>
              </Pressable>

              {selectedAttachments.length ? (
                <View style={styles.selectedSection}>
                  <Text style={styles.selectedTitle}>
                    {selectedAttachments.length} selected
                  </Text>
                  <View style={styles.selectedList}>
                    {selectedAttachments.map((photoRef) => {
                      const previewUri = getAttachedPhotoPreviewUri(photoRef);
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
                          </View>

                          <Pressable
                            style={({ pressed }) => [
                              styles.removeButton,
                              pressed ? styles.removeButtonPressed : null,
                            ]}
                            onPress={() =>
                              removeAttachmentForScope(attachmentScope, photoRef.photoId)
                            }
                          >
                            <Text style={styles.removeButtonText}>Remove</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {isPhotoPanelOpen ? (
                <FadeInView delay={20} distance={8}>
                  <View style={styles.photoPanel}>
                    <View style={styles.photoHeader}>
                      <View style={styles.photoHeaderCopy}>
                        <Text style={styles.photoSectionTitle}>Browse photo sources</Text>
                        <Text style={styles.photoHint}>
                          Keep Write focused on the memory, then open the shared picker when you
                          want phone or NAS photos.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.photoActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.secondaryAction,
                          pressed ? styles.secondaryActionPressed : null,
                        ]}
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
                        style={({ pressed }) => [
                          styles.secondaryAction,
                          pressed ? styles.secondaryActionPressed : null,
                        ]}
                        onPress={() => {
                          setPickerScope(attachmentScope, selectedAttachments);
                          router.push("/photo-picker?source=device");
                        }}
                      >
                        <Text style={styles.secondaryActionText}>Open Photo Picker</Text>
                      </Pressable>
                    </View>

                    <Text style={styles.photoEmpty}>
                      {photoStatusMessage ||
                        "The shared picker now holds both Device and NAS choices, so browsing stays in one place."}
                    </Text>
                  </View>
                </FadeInView>
              ) : (
                <Text style={styles.photoClosedNote}>
                  Keep the photo tools tucked away unless they add something important to the
                  memory.
                </Text>
              )}
            </View>
          </FadeInView>

          {saveMessage ? <Text style={styles.message}>{saveMessage}</Text> : null}
          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
          {guidedMemoryDraft ? (
            <Text style={styles.guidedDraftMeta}>
              Base question preserved separately for future guided follow-ups:
              {" "}
              {guidedMemoryDraft.baseQuestion}
            </Text>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, theme.spacing.lg),
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              pressed && !isSaving ? styles.saveButtonPressed : null,
            ]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={theme.colors.buttonText} />
            ) : (
              <Text style={styles.saveButtonText}>Save Memory</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: {
    gap: theme.spacing.sm,
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
  backButtonPressed: {
    backgroundColor: "#FFF7EF",
  },
  backButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  promptCard: {
    backgroundColor: "#FFF8F1",
    borderColor: "#E7D7C8",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.lg,
  },
  promptLabel: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  promptText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
    lineHeight: 28,
  },
  promptHelper: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
    paddingTop: theme.spacing.xs,
  },
  editorCard: {
    backgroundColor: "#FFF9F4",
    borderColor: "#E6D9CB",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  photoCard: {
    backgroundColor: "#F8EFE4",
    borderColor: "#E4D0BB",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  photoSummaryCard: {
    alignItems: "center",
    backgroundColor: "rgba(255, 250, 244, 0.84)",
    borderColor: "#E5D4C2",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between",
    padding: theme.spacing.md,
  },
  photoSummaryCardPressed: {
    backgroundColor: "rgba(255, 247, 238, 0.98)",
  },
  photoSummaryCopy: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  photoSummaryMeta: {
    alignItems: "flex-end",
    gap: 2,
  },
  photoSummaryMetaText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  photoSummaryAction: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  photoPanel: {
    gap: theme.spacing.md,
  },
  sectionHeader: {
    gap: theme.spacing.xs,
  },
  sectionEyebrow: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  sectionHint: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  input: {
    minHeight: 220,
    borderRadius: theme.radii.lg,
    backgroundColor: "#FFFDF9",
    borderColor: "#E8DCCD",
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    lineHeight: 24,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  guidedDraftHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 18,
  },
  guidedCard: {
    backgroundColor: "#FFF7EF",
    borderColor: "#E8D7C6",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  originalAnswerCard: {
    backgroundColor: "#FFFDF9",
    borderColor: "#E8DCCD",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  originalAnswerLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  originalAnswerText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    lineHeight: 24,
  },
  guidedEmptyState: {
    backgroundColor: "#FFFDF9",
    borderColor: "#E8DCCD",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    padding: theme.spacing.md,
  },
  guidedEmptyStateText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  guidedMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  followUpList: {
    gap: theme.spacing.md,
  },
  followUpCard: {
    backgroundColor: "#FFFDF9",
    borderColor: "#E8DCCD",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
  },
  followUpHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  followUpIndex: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  followUpQuestion: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
    lineHeight: 24,
  },
  followUpInput: {
    minHeight: 88,
    borderRadius: theme.radii.md,
    backgroundColor: "#FFFFFF",
    borderColor: theme.colors.border,
    borderWidth: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    lineHeight: 22,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  guidedButtonRow: {
    gap: theme.spacing.sm,
  },
  guidedActionButton: {
    alignItems: "center",
    backgroundColor: "#A65940",
    borderRadius: theme.radii.pill,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  guidedActionButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  guidedActionButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  secondaryGuidedButton: {
    alignItems: "center",
    backgroundColor: "#FFF4E8",
    borderColor: "#E6D2BC",
    borderRadius: theme.radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  secondaryGuidedButtonPressed: {
    backgroundColor: "#FFF0E0",
  },
  secondaryGuidedButtonText: {
    color: theme.colors.accent,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  skipButton: {
    backgroundColor: "#F6ECE0",
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
  },
  skipButtonPressed: {
    opacity: 0.82,
  },
  skipButtonText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  polishCard: {
    backgroundColor: "#FFF3E8",
    borderColor: "#E6D2BC",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.md,
    padding: theme.spacing.md,
  },
  polishHeader: {
    gap: theme.spacing.sm,
  },
  polishHeaderCopy: {
    gap: theme.spacing.xs,
  },
  polishPreviewCard: {
    backgroundColor: "#FFFDF9",
    borderColor: "#E8DCCD",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  debugCard: {
    backgroundColor: "#F5ECDD",
    borderColor: "#DCC8AD",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
  debugTitle: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  debugText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  disabledButton: {
    opacity: 0.55,
  },
  photoHeader: {
    gap: theme.spacing.md,
  },
  photoSectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  photoHeaderCopy: {
    gap: theme.spacing.xs,
  },
  photoHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  datePickerWrap: {
    gap: theme.spacing.sm,
  },
  dateSummary: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  photoActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm,
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
  secondaryActionPressed: {
    backgroundColor: "#FFF7EE",
  },
  secondaryActionText: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  selectedSection: {
    gap: theme.spacing.sm,
  },
  selectedTitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  selectedList: {
    gap: theme.spacing.sm,
  },
  selectedCard: {
    alignItems: "center",
    backgroundColor: "rgba(255, 253, 249, 0.85)",
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
  removeButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  removeButtonPressed: {
    opacity: 0.72,
  },
  removeButtonText: {
    color: "#B44D47",
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  photoEmpty: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body,
    lineHeight: 22,
  },
  photoClosedNote: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 18,
  },
  footer: {
    backgroundColor: "rgba(247, 241, 232, 0.96)",
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    padding: theme.spacing.lg,
  },
  saveButton: {
    alignItems: "center",
    backgroundColor: "#A65940",
    borderRadius: theme.radii.pill,
    justifyContent: "center",
    minHeight: 52,
    paddingVertical: theme.spacing.md,
  },
  saveButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  saveButtonText: {
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
  guidedDraftMeta: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 18,
  },
});
