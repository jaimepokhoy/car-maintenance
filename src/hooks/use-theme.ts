import { useMemo } from 'react';

import { Colors, type Theme } from '@/constants/theme';
import { applyBrand } from '@/domain/brand';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTenant } from '@/hooks/use-tenant';

/** Night Drive in the current scheme, with the shop's accent laid over it. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const { brand } = useTenant();
  return useMemo(() => applyBrand(Colors[scheme], brand), [scheme, brand]);
}
