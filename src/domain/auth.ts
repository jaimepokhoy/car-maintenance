/** Rules for the sign-in screens. Supabase and native SDK calls live in `src/lib/auth.ts`. */

export type SignInProvider = 'apple' | 'google' | 'email';

/** Emails are compared and sent lower-case with no surrounding spaces. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

/** A deliberately loose check: one @, something on each side, a dot in the domain, no spaces. The server has the final say. */
export function isValidEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(input));
}

/** Keeps only the digits, so a pasted "123 456" or "123-456" still works. */
export function normalizeOtpCode(input: string): string {
  return input.replace(/\D/g, '');
}

/** Supabase sends 6 digits by default; projects can raise it to 10. */
export const OTP_MIN_LENGTH = 6;
export const OTP_MAX_LENGTH = 10;

export function isValidOtpCode(input: string): boolean {
  const code = normalizeOtpCode(input);
  return code.length >= OTP_MIN_LENGTH && code.length <= OTP_MAX_LENGTH;
}

export interface SignInAvailability {
  platform: string;
  /** Sign in with Apple is turned on for this build (capability and Supabase provider set up). */
  appleConfigured: boolean;
  /** The device supports Sign in with Apple (`isAvailableAsync`). */
  appleAvailable: boolean;
  /** The Google provider is set up in Supabase for this build. */
  googleConfigured: boolean;
}

/**
 * Which sign-in buttons to show, in order. Email needs no native setup so it is
 * always offered; Apple only on iOS when configured and supported; Google when configured.
 */
export function availableSignInProviders(availability: SignInAvailability): SignInProvider[] {
  const providers: SignInProvider[] = [];
  if (availability.platform === 'ios' && availability.appleConfigured && availability.appleAvailable) {
    providers.push('apple');
  }
  if (availability.googleConfigured) providers.push('google');
  providers.push('email');
  return providers;
}

/** Reads a build flag such as `EXPO_PUBLIC_GOOGLE_SIGN_IN`. Only "true" or "1" turn it on. */
export function isFlagOn(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

export type AuthErrorKey = 'invalidCode' | 'tooManyRequests' | 'network' | 'unavailable' | 'generic';

/** Maps an error from Supabase Auth to the message shown to the owner. */
export function authErrorKey(error: { code?: string; status?: number; name?: string } | null | undefined): AuthErrorKey {
  if (!error) return 'generic';
  switch (error.code) {
    case 'otp_expired':
    case 'invalid_credentials':
      return 'invalidCode';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'tooManyRequests';
    case 'otp_disabled':
    case 'email_provider_disabled':
    case 'provider_disabled':
    case 'signup_disabled':
      return 'unavailable';
  }
  if (error.status === 429) return 'tooManyRequests';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'network';
  return 'generic';
}

/** Pulls the PKCE `code` (or an error description) out of the URL an OAuth provider redirects back to. */
export function parseAuthRedirect(url: string): { code?: string; error?: string } {
  const query = url.split('#')[0].split('?')[1] ?? '';
  const fragment = url.split('#')[1] ?? '';
  const params = new URLSearchParams(`${query}&${fragment}`);
  const code = params.get('code') ?? undefined;
  const error = params.get('error_description') ?? params.get('error') ?? undefined;
  return { code, error };
}
