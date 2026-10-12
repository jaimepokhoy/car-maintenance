import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { formatDate, toIsoDate, type IsoDate } from '@/domain';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';

function toLocalDate(date: IsoDate): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** A calendar date picker: inline on iOS, a dialog on Android. */
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
  const locale = useLocale();
  const maximumDate = maximum ? toLocalDate(maximum) : undefined;

  return (
    <View style={styles.field}>
      <ThemedText type="small">{label}</ThemedText>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={toLocalDate(value)}
          mode="date"
          display="compact"
          locale={locale}
          maximumDate={maximumDate}
          onChange={(_, date) => date && onChange(toIsoDate(date))}
          style={styles.ios}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
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
          style={[styles.android, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText>{formatDate(value, locale)}</ThemedText>
        </Pressable>
      )}
      {error ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
    alignItems: 'flex-start',
  },
  ios: {
    marginLeft: -Spacing.two,
  },
  android: {
    alignSelf: 'stretch',
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
  },
});
