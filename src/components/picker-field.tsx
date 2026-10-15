import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Control, Fonts, Radius, Spacing } from '@/constants/theme';
import { filterOptions, hasExactOption } from '@/domain';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

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
  const scheme = useColorScheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const matches = useMemo(() => filterOptions(options, query), [options, query]);
  const typed = query.trim();
  const showTyped = typed !== '' && !hasExactOption(options, typed);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: value || placeholder }}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.input,
          {
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.borderStrong,
            borderWidth: error ? 2 : 1,
            opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
          },
        ]}>
        <ThemedText
          style={[styles.value, { fontFamily: Fonts.bodyMedium }]}
          themeColor={value ? 'text' : 'textSecondary'}
          numberOfLines={1}>
          {value || placeholder}
        </ThemedText>
        <Icon name="down" size={16} color={theme.textSecondary} />
      </Pressable>
      {error ? (
        <ThemedText type="caption" themeColor="dangerText" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}>
        <ThemedView style={styles.flex}>
          <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
            <View style={styles.header}>
              <ThemedText type="headline" accessibilityRole="header">
                {label}
              </ThemedText>
              <Button title={t('picker.cancel')} variant="secondary" size="small" onPress={() => setOpen(false)} />
            </View>
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={t('picker.search')}
              placeholderTextColor={theme.textSecondary}
              selectionColor={theme.accent}
              cursorColor={theme.accent}
              keyboardAppearance={scheme}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (matches.length > 0 && !showTyped) choose(matches[0]);
                else if (typed) choose(typed);
              }}
              accessibilityLabel={t('picker.search')}
              style={[
                styles.search,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.borderStrong },
              ]}
            />
            {hint ? (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.hint}>
                {hint}
              </ThemedText>
            ) : null}
            {loading ? <ActivityIndicator color={theme.accent} style={styles.hint} /> : null}
            <FlatList
              data={matches}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.list}
              ListHeaderComponent={
                showTyped ? <Row label={t('picker.useTyped', { value: typed })} onPress={() => choose(typed)} bold /> : null
              }
              renderItem={({ item }) => <Row label={item} onPress={() => choose(item)} selected={item === value} />}
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
        (pressed || selected) && { backgroundColor: theme.surfaceRaised },
      ]}>
      <ThemedText type={bold || selected ? 'bodyStrong' : 'body'} style={styles.flex}>
        {label}
      </ThemedText>
      {selected ? <Icon name="check" size={18} color={theme.text} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  field: {
    gap: Spacing.two - Spacing.half,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: Control.height,
    paddingHorizontal: Spacing.three - Spacing.half,
    borderRadius: Radius.field,
  },
  value: {
    flex: 1,
    fontSize: 17,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.three,
  },
  search: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 17,
    marginHorizontal: Spacing.gutter,
    minHeight: Control.height,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.field,
    borderWidth: 1,
  },
  hint: {
    marginHorizontal: Spacing.gutter,
    marginTop: Spacing.three,
  },
  list: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: Control.height,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.gutter,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
