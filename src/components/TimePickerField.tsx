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

function parseTimeString(time: string) {
  const [hour, minute] = time.split(":").map((value) => Number(value));
  return new Date(2000, 0, 1, hour || 0, minute || 0, 0, 0);
}

function toTimeString(date: Date) {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function formatTimeLabel(time: string) {
  return parseTimeString(time).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

type TimePickerFieldProps = {
  value: string;
  onChange: (nextTime: string) => void;
  helperText?: string;
};

export function TimePickerField({ value, onChange, helperText }: TimePickerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftTime, setDraftTime] = useState(() => parseTimeString(value));
  const selectedTime = useMemo(() => parseTimeString(value), [value]);

  const openPicker = () => {
    setDraftTime(parseTimeString(value));
    setIsOpen(true);
  };

  const handleAndroidChange = (event: DateTimePickerEvent, nextTime?: Date) => {
    if (event.type === "dismissed") {
      setIsOpen(false);
      return;
    }

    if (nextTime) {
      onChange(toTimeString(nextTime));
    }

    setIsOpen(false);
  };

  const handleIosChange = (_event: DateTimePickerEvent, nextTime?: Date) => {
    if (nextTime) {
      setDraftTime(nextTime);
    }
  };

  return (
    <View style={styles.wrapper}>
      <Pressable style={styles.field} onPress={openPicker}>
        <Text style={styles.fieldValue}>{formatTimeLabel(value)}</Text>
        <Text style={styles.fieldAction}>Change</Text>
      </Pressable>
      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      {Platform.OS === "android" && isOpen ? (
        <DateTimePicker
          mode="time"
          display="default"
          value={selectedTime}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={isOpen} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Choose a time</Text>
              <DateTimePicker
                mode="time"
                display="spinner"
                value={draftTime}
                onChange={handleIosChange}
              />
              <View style={styles.modalActions}>
                <Pressable style={styles.secondaryButton} onPress={() => setIsOpen(false)}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={styles.primaryButton}
                  onPress={() => {
                    onChange(toTimeString(draftTime));
                    setIsOpen(false);
                  }}
                >
                  <Text style={styles.primaryButtonText}>Use Time</Text>
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
