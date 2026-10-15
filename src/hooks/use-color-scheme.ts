import { useColorScheme as useSystemColorScheme } from 'react-native';

import type { ColorScheme } from '@/constants/theme';
import { usePreferences } from '@/hooks/use-preferences';

/** The appearance the owner chose in Settings, or the phone's when set to "System". */
export function useColorScheme(): ColorScheme {
  const system = useSystemColorScheme();
  const { appearance } = usePreferences().preferences;
  if (appearance !== 'system') return appearance;
  return system === 'dark' ? 'dark' : 'light';
}
