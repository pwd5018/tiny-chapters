import { createContext, ReactNode, useContext, useMemo, useState } from "react";

import type { AttachedPhotoRef } from "@/types/memory";

type AttachmentScope = string;

type PhotoAttachmentContextValue = {
  pickerScope: AttachmentScope;
  getAttachments: (scope: AttachmentScope) => AttachedPhotoRef[];
  setAttachments: (
    scope: AttachmentScope,
    valueOrUpdater: React.SetStateAction<AttachedPhotoRef[]>
  ) => void;
  addAttachment: (scope: AttachmentScope, attachment: AttachedPhotoRef) => void;
  removeAttachment: (
    scope: AttachmentScope,
    photoId: string,
    source?: AttachedPhotoRef["source"]
  ) => void;
  toggleAttachment: (scope: AttachmentScope, attachment: AttachedPhotoRef) => void;
  clearAttachments: (scope: AttachmentScope) => void;
  setPickerScope: (scope: AttachmentScope, initialAttachments?: AttachedPhotoRef[]) => void;
};

const PhotoAttachmentContext = createContext<PhotoAttachmentContextValue | null>(null);

function getAttachmentKey(attachment: AttachedPhotoRef) {
  return `${attachment.source}:${attachment.photoId}`;
}

export function PhotoAttachmentProvider({ children }: { children: ReactNode }) {
  const [pickerScope, setPickerScopeState] = useState<AttachmentScope>("today");
  const [attachmentsByScope, setAttachmentsByScope] = useState<Record<AttachmentScope, AttachedPhotoRef[]>>({
    today: [],
  });

  const value = useMemo<PhotoAttachmentContextValue>(
    () => ({
      pickerScope,
      getAttachments: (scope) => attachmentsByScope[scope] ?? [],
      setAttachments: (scope, valueOrUpdater) => {
        setAttachmentsByScope((current) => {
          const previous = current[scope] ?? [];
          const nextValue =
            typeof valueOrUpdater === "function"
              ? valueOrUpdater(previous)
              : valueOrUpdater;

          return {
            ...current,
            [scope]: nextValue,
          };
        });
      },
      addAttachment: (scope, attachment) => {
        setAttachmentsByScope((current) => {
          const scopeAttachments = current[scope] ?? [];
          if (
            scopeAttachments.some((item) => getAttachmentKey(item) === getAttachmentKey(attachment))
          ) {
            return current;
          }

          return {
            ...current,
            [scope]: [...scopeAttachments, attachment],
          };
        });
      },
      removeAttachment: (scope, photoId, source) => {
        setAttachmentsByScope((current) => ({
          ...current,
          [scope]: (current[scope] ?? []).filter(
            (item) => item.photoId !== photoId || (source ? item.source !== source : false)
          ),
        }));
      },
      toggleAttachment: (scope, attachment) => {
        setAttachmentsByScope((current) => {
          const scopeAttachments = current[scope] ?? [];
          if (
            scopeAttachments.some((item) => getAttachmentKey(item) === getAttachmentKey(attachment))
          ) {
            return {
              ...current,
              [scope]: scopeAttachments.filter(
                (item) => getAttachmentKey(item) !== getAttachmentKey(attachment)
              ),
            };
          }

          return {
            ...current,
            [scope]: [...scopeAttachments, attachment],
          };
        });
      },
      clearAttachments: (scope) => {
        setAttachmentsByScope((current) => ({
          ...current,
          [scope]: [],
        }));
      },
      setPickerScope: (scope, initialAttachments) => {
        setAttachmentsByScope((current) => {
          if (!initialAttachments) {
            return current;
          }

          return {
            ...current,
            [scope]: initialAttachments,
          };
        });
        setPickerScopeState(scope);
      },
    }),
    [attachmentsByScope, pickerScope]
  );

  return (
    <PhotoAttachmentContext.Provider value={value}>
      {children}
    </PhotoAttachmentContext.Provider>
  );
}

export function usePhotoAttachments() {
  const context = useContext(PhotoAttachmentContext);

  if (!context) {
    throw new Error("usePhotoAttachments must be used inside PhotoAttachmentProvider");
  }

  const selectedAttachments = context.getAttachments(context.pickerScope);

  return {
    pickerScope: context.pickerScope,
    selectedAttachments,
    setSelectedAttachments: (valueOrUpdater: React.SetStateAction<AttachedPhotoRef[]>) =>
      context.setAttachments(context.pickerScope, valueOrUpdater),
    addAttachment: (attachment: AttachedPhotoRef) =>
      context.addAttachment(context.pickerScope, attachment),
    removeAttachment: (photoId: string, source?: AttachedPhotoRef["source"]) =>
      context.removeAttachment(context.pickerScope, photoId, source),
    toggleAttachment: (attachment: AttachedPhotoRef) =>
      context.toggleAttachment(context.pickerScope, attachment),
    clearAttachments: () => context.clearAttachments(context.pickerScope),
    setPickerScope: context.setPickerScope,
    getAttachments: context.getAttachments,
    setAttachments: context.setAttachments,
    addAttachmentForScope: context.addAttachment,
    removeAttachmentForScope: context.removeAttachment,
    toggleAttachmentForScope: context.toggleAttachment,
    clearAttachmentsForScope: context.clearAttachments,
  };
}
