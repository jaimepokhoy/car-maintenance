import * as AppleAuthentication from 'expo-apple-authentication';
import { StyleSheet } from 'react-native';

import { Control, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Apple's own Sign in with Apple button (iOS only), which App Review expects instead
 * of a lookalike. White on the dark scheme, black on the light one, sized like `Button`.
 */
export function AppleSignInButton({ onPress }: { onPress: () => void }) {
  const scheme = useColorScheme();
  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={
        scheme === 'dark'
          ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
          : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
      }
      cornerRadius={Radius.pill}
      style={styles.button}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    height: Control.heightLarge,
  },
});
