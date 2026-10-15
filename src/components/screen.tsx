import type { PropsWithChildren, ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing, TabBar } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Space a tab screen leaves under its content so the floating tab bar never covers it. */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + TabBar.margin + TabBar.height + Spacing.three;
}

/** A top-level tab screen: safe area, a display title with an optional action, and scrolling content. */
export function Screen({ title, action, children }: PropsWithChildren<{ title: string; action?: ReactNode }>) {
  const bottom = useTabBarInset();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="display" accessibilityRole="header" style={styles.title}>
              {title}
            </ThemedText>
            {action}
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * A pushed or modal screen with a native header: scrolling content, keyboard
 * avoidance, and an optional footer pinned above the home indicator for the
 * screen's one primary action.
 */
export function FormScreen({ footer, children }: PropsWithChildren<{ footer?: ReactNode }>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedView style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, styles.formContent]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          {children}
        </ScrollView>
        {footer ? (
          <View
            style={[
              styles.footer,
              {
                paddingBottom: Math.max(insets.bottom, Spacing.three),
                borderTopColor: theme.border,
                backgroundColor: theme.background,
              },
            ]}>
            {footer}
          </View>
        ) : null}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

/** A label above a group of cards. */
export function SectionLabel({ children, trailing }: PropsWithChildren<{ trailing?: ReactNode }>) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textSecondary" accessibilityRole="header">
        {children}
      </ThemedText>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.gutter,
  },
  formContent: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
    minHeight: 44,
  },
  title: {
    flexShrink: 1,
  },
  footer: {
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.three - Spacing.half,
    borderTopWidth: 1,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: -Spacing.two + Spacing.half,
  },
});
