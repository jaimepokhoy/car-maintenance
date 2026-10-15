import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TabBar as Size } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The floating pill tab bar. The current tab is a solid pill of the text colour. */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const theme = useTheme();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + Size.margin }]}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          { backgroundColor: theme.nav, borderColor: theme.borderStrong, shadowColor: theme.shadow },
        ]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? theme.onInverse : theme.textSecondary;
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [
                styles.tab,
                focused && { backgroundColor: theme.inverse },
                pressed && !focused && { opacity: 0.7 },
              ]}>
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <ThemedText type="caption" style={[styles.label, { color }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    height: Size.height,
    paddingHorizontal: Spacing.two - Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    shadowOpacity: 1,
    elevation: 12,
  },
  tab: {
    width: 76,
    height: Size.height - 12,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
});
