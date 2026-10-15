import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Control, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatDate, toIsoDate, type IsoDate } from '@/domain';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';

function toLocalDate(date: IsoDate): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** A calendar date picker: the system compact picker on iOS, a dialog on Android. */
export function DateField({
  label,
  value,
  maximum,
  onChange,
  error,
}: {
  label: string;
  value: IsoDate;
  maximum?: IsoDate;
  onChange: (date: IsoDate) => void;
  error?: string;
}) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const locale = useLocale();
  const maximumDate = maximum ? toLocalDate(maximum) : undefined;

  return (
    <View style={styles.field}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      {Platform.OS === 'ios' ? (
        <View
          style={[
            styles.frame,
            { backgroundColor: theme.surface, borderColor: error ? theme.danger : theme.borderStrong },
          ]}>
          <DateTimePicker
            value={toLocalDate(value)}
            mode="date"
            display="compact"
            locale={locale}
            themeVariant={scheme}
            accentColor={theme.accent}
            maximumDate={maximumDate}
            onChange={(_, date) => date && onChange(toIsoDate(date))}
            style={styles.ios}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityValue={{ text: formatDate(value, locale) }}
          onPress={() =>
            DateTimePickerAndroid.open({
              value: toLocalDate(value),
              mode: 'date',
              maximumDate,
              onChange: (event, date) => {
                if (event.type === 'set' && date) onChange(toIsoDate(date));
              },
            })
          }
          style={({ pressed }) => [
            styles.frame,
            styles.android,
            {
              backgroundColor: theme.surface,
              borderColor: error ? theme.danger : theme.borderStrong,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <ThemedText style={{ fontFamily: Fonts.bodyMedium, fontSize: 17 }}>{formatDate(value, locale)}</ThemedText>
        </Pressable>
      )}
      {error ? (
        <ThemedText type="caption" themeColor="dangerText" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.two - Spacing.half,
  },
  frame: {
    minHeight: Control.height,
    borderRadius: Radius.field,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  ios: {
    alignSelf: 'flex-start',
  },
  android: {
    paddingHorizontal: Spacing.three - Spacing.half,
  },
});
