import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import {
  authErrorKey,
  availableSignInProviders,
  isFlagOn,
  normalizeEmail,
  normalizeOtpCode,
  parseAuthRedirect,
  type AuthErrorKey,
  type SignInProvider,
} from '@/domain';
import { supabase } from '@/lib/supabase';

/** `cancelled` means the owner backed out of a native or browser sheet; screens stay quiet about it. */
export type AuthResult = { ok: true } | { ok: false; error: AuthErrorKey | 'cancelled' };

const OK: AuthResult = { ok: true };

function failed(error: unknown): AuthResult {
  return { ok: false, error: authErrorKey(error as Parameters<typeof authErrorKey>[0]) };
}

/**
 * Build flags for the sign-in providers that need setup outside the app (see the PR
 * "Docs notes"). Email needs nothing beyond Supabase itself.
 */
const appleConfigured = isFlagOn(process.env.EXPO_PUBLIC_APPLE_SIGN_IN);
const googleConfigured = isFlagOn(process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN);

/** The redirect an OAuth provider sends the owner back to; `src/app/auth-callback.tsx` catches stray deep links. */
export const AUTH_REDIRECT_PATH = 'auth-callback';

/** The sign-in buttons this build and device can offer, in display order. */
export async function signInProviders(): Promise<SignInProvider[]> {
  const appleAvailable =
    Platform.OS === 'ios' && appleConfigured ? await AppleAuthentication.isAvailableAsync().catch(() => false) : false;
  return availableSignInProviders({ platform: Platform.OS, appleConfigured, appleAvailable, googleConfigured });
}

/** Emails a one-time code, creating the account on first use. */
export async function sendEmailCode(email: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'unavailable' };
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { shouldCreateUser: true },
  });
  return error ? failed(error) : OK;
}

/** Exchanges the emailed code for a session. */
export async function verifyEmailCode(email: string, code: string): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'unavailable' };
  const { error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: normalizeOtpCode(code),
    type: 'email',
  });
  return error ? failed(error) : OK;
}

/**
 * Native Sign in with Apple (iOS), handed to Supabase as an ID token. Apple gets the
 * SHA-256 of a fresh nonce and Supabase the raw nonce, so a stolen token can't be replayed.
 */
export async function signInWithApple(): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'unavailable' };
  try {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return { ok: false, error: 'generic' };
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    return error ? failed(error) : OK;
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { ok: false, error: 'cancelled' };
    return failed(error);
  }
}

/** Google through Supabase's OAuth page in an in-app browser session, finished with the PKCE code it returns. */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'unavailable' };
  try {
    const redirectTo = Linking.createURL(AUTH_REDIRECT_PATH);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) return failed(error);

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return { ok: false, error: 'cancelled' };

    const { code } = parseAuthRedirect(result.url);
    if (!code) return { ok: false, error: 'generic' };
    const exchange = await supabase.auth.exchangeCodeForSession(code);
    return exchange.error ? failed(exchange.error) : OK;
  } catch (error) {
    return failed(error);
  }
}

/** Signs out on this device only. The local session is cleared even when offline. */
export async function signOut(): Promise<void> {
  await supabase?.auth.signOut({ scope: 'local' });
}

/**
 * Deletes the account and everything stored with it in the cloud (`public.delete_account()`,
 * whose row deletes cascade to every user-owned table), then clears the session here.
 */
export async function deleteAccount(): Promise<AuthResult> {
  if (!supabase) return { ok: false, error: 'unavailable' };
  const { error } = await supabase.rpc('delete_account');
  if (error) return { ok: false, error: 'generic' };
  await supabase.auth.signOut({ scope: 'local' });
  return OK;
}
