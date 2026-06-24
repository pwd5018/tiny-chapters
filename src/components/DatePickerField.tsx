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

import { theme } from "@/theme/theme";

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(dateKey: string) {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
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
  const [draftDate, setDraftDate] = useState(() => parseDateKey(value));
  const selectedDate = useMemo(() => parseDateKey(value), [value]);

  const openPicker = () => {
    setDraftDate(parseDateKey(value));
    setIsOpen(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, nextDate?: Date) => {
    if (event.type === "dismissed") {
      setIsOpen(false);
      return;
    }

    if (nextDate) {
      onChange(toDateKey(nextDate));
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
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={styles.fieldValue}>{formatDateLabel(value)}</Text>
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
                <Pressable style={styles.secondaryButton} onPress={() => setIsOpen(false)}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    onChange(toDateKey(draftDate));
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
    backgroundColor: theme.colors.input,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  fieldValue: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.body,
    fontWeight: "600",
  },
  fieldAction: {
    color: theme.colors.accent,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.caption,
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
  primaryButtonText: {
    color: theme.colors.buttonText,
    fontSize: theme.typography.caption,
    fontWeight: "700",
  },
});
