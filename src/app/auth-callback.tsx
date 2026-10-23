import { Redirect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Platform } from 'react-native';

/**
 * Where Google sign-in redirects. The browser session in `src/lib/auth.ts` normally
 * catches the redirect first; this route handles the deep link if it reaches the router
 * anyway (Android), and on web hands the URL back to the opener and closes the popup.
 */
export default function AuthCallback() {
  // Must run before any navigation changes the URL. On success the opener closes this window.
  const [handedBack] = useState(
    () => Platform.OS === 'web' && WebBrowser.maybeCompleteAuthSession().type === 'success',
  );
  return handedBack ? null : <Redirect href="/settings" />;
}
