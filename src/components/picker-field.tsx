import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { filterOptions, hasExactOption } from "@/domain";
import { useTheme } from "@/hooks/use-theme";

/**
 * A field that opens a searchable list, like the make and model pickers on
 * car sites. Owners can always use exactly what they typed, so an unlisted
 * make or a failed model lookup never blocks them.
 */
export function PickerField({
  label,
  placeholder,
  value,
  onChange,
  options,
  loading,
  hint,
  error,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  loading?: boolean;
  /** Shown above the list, e.g. why there are no suggestions. */
  hint?: string;
  error?: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useMemo(
    () => filterOptions(options, query),
    [options, query],
  );
  const typed = query.trim();
  const showTyped = typed !== "" && !hasExactOption(options, typed);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      <ThemedText type="small">{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || placeholder }}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.border,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <ThemedText
          style={styles.value}
          themeColor={value ? "text" : "textSecondary"}
          numberOfLines={1}
        >
          {value || placeholder}
        </ThemedText>
        <ThemedText themeColor="textSecondary">▾</ThemedText>
      </Pressable>
      {error ? (
        <ThemedText
          type="small"
          style={{ color: theme.danger }}
          accessibilityLiveRegion="polite"
        >
          {error}
        </ThemedText>
      ) : null}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <ThemedView style={styles.flex}>
          <SafeAreaView style={styles.flex} edges={["top", "bottom"]}>
            <View style={styles.header}>
              <ThemedText type="smallBold" accessibilityRole="header">
                {label}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                hitSlop={Spacing.two}
                onPress={() => setOpen(false)}
              >
                <ThemedText type="smallBold" style={{ color: theme.tint }}>
                  {t("picker.cancel")}
                </ThemedText>
              </Pressable>
            </View>
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={t("picker.search")}
              placeholderTextColor={theme.textSecondary}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (matches.length > 0 && !showTyped) choose(matches[0]);
                else if (typed) choose(typed);
              }}
              accessibilityLabel={t("picker.search")}
              style={[
                styles.search,
                {
                  color: theme.text,
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                },
              ]}
            />
            {hint ? (
              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.hint}
              >
                {hint}
              </ThemedText>
            ) : null}
            {loading ? <ActivityIndicator style={styles.hint} /> : null}
            <FlatList
              data={matches}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                showTyped ? (
                  <Row
                    label={t("picker.useTyped", { value: typed })}
                    onPress={() => choose(typed)}
                    bold
                  />
                ) : null
              }
              renderItem={({ item }) => (
                <Row
                  label={item}
                  onPress={() => choose(item)}
                  selected={item === value}
                />
              )}
            />
          </SafeAreaView>
        </ThemedView>
      </Modal>
    </View>
  );
}

function Row({
  label,
  onPress,
  selected,
  bold,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  bold?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: theme.border },
        (pressed || selected) && { backgroundColor: theme.backgroundSelected },
      ]}
    >
      <ThemedText
        type={bold || selected ? "smallBold" : "default"}
        style={bold ? { color: theme.tint } : undefined}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  field: {
    gap: Spacing.one,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  value: {
    flex: 1,
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.four,
  },
  search: {
    fontSize: 16,
    marginHorizontal: Spacing.four,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
  hint: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
  },
  row: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
