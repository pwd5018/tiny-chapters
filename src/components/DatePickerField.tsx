import { useMemo, useState } from "react";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { parseDateKeyAsLocalDate, toLocalDateKey } from "@/lib/dates";
import { theme } from "@/theme/theme";

function formatDateLabel(dateKey: string) {
  return parseDateKeyAsLocalDate(dateKey).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type DatePickerFieldProps = {
  value: string;
  onChange: (nextDateKey: string) => void;
  helperText?: string;
};

export function DatePickerField({ value, onChange, helperText }: DatePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(() => parseDateKeyAsLocalDate(value));
  const selectedDate = useMemo(() => parseDateKeyAsLocalDate(value), [value]);

  const openPicker = () => {
    setDraftDate(parseDateKeyAsLocalDate(value));
    setIsOpen(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, nextDate?: Date) => {
    if (event.type === "dismissed") {
      setIsOpen(false);
      return;
    }

    if (nextDate) {
      onChange(toLocalDateKey(nextDate));
    }

    setIsOpen(false);
  };

  const handleIosChange = (_event: DateTimePickerEvent, nextDate?: Date) => {
    if (nextDate) {
      setDraftDate(nextDate);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }) => [styles.field, pressed ? styles.fieldPressed : null]}
        onPress={openPicker}
      >
        <View style={styles.fieldCopy}>
          <Text style={styles.fieldLabel}>Photo day</Text>
          <Text style={styles.fieldValue}>{formatDateLabel(value)}</Text>
        </View>
        <Text style={styles.fieldAction}>Change</Text>
      </Pressable>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      {Platform.OS === "android" && isOpen ? (
        <DateTimePicker
          mode="date"
          display="default"
          value={selectedDate}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={isOpen} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Choose a day</Text>
              <DateTimePicker
                mode="date"
                display="spinner"
                value={draftDate}
                onChange={handleIosChange}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed ? styles.secondaryButtonPressed : null,
                  ]}
                  onPress={() => setIsOpen(false)}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed ? styles.primaryButtonPressed : null,
                  ]}
                  onPress={() => {
                    onChange(toLocalDateKey(draftDate));
                    setIsOpen(false);
                  }}
                >
                  <Text style={styles.primaryButtonText}>Use Date</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: theme.spacing.xs,
  },
  field: {
    alignItems: "center",
    backgroundColor: "#FFF9F3",
    borderColor: "#E6D8CA",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  fieldPressed: {
    backgroundColor: "#FFF5EC",
  },
  fieldCopy: {
    gap: 2,
  },
  fieldLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.35,
    textTransform: "uppercase",
  },
  fieldValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "700",
  },
  fieldAction: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
    lineHeight: 18,
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
    padding: theme.spacing.lg,
    width: "100%",
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title,
    fontWeight: "700",
  },
  modalActions: {
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
    minHeight: 44,
  },
  secondaryButtonPressed: {
    backgroundColor: "#FFF6ED",
  },
  secondaryButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radii.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
});
