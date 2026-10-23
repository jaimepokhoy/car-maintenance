import {
  authErrorKey,
  availableSignInProviders,
  isFlagOn,
  isValidEmail,
  isValidOtpCode,
  normalizeEmail,
  normalizeOtpCode,
  parseAuthRedirect,
} from '../auth';

describe('email', () => {
  it('trims and lower-cases', () => {
    expect(normalizeEmail('  Jaime@Example.CA ')).toBe('jaime@example.ca');
  });

  it('accepts ordinary addresses', () => {
    expect(isValidEmail('jaime@example.ca')).toBe(true);
    expect(isValidEmail(' Jaime.P+car@mail.example.co.uk ')).toBe(true);
  });

  it('rejects addresses that cannot be right', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('jaime')).toBe(false);
    expect(isValidEmail('jaime@example')).toBe(false);
    expect(isValidEmail('@example.ca')).toBe(false);
    expect(isValidEmail('jai me@example.ca')).toBe(false);
    expect(isValidEmail('a@b@example.ca')).toBe(false);
  });
});

describe('one-time code', () => {
  it('keeps only digits', () => {
    expect(normalizeOtpCode(' 123 456 ')).toBe('123456');
    expect(normalizeOtpCode('123-456')).toBe('123456');
  });

  it('accepts 6 to 10 digits', () => {
    expect(isValidOtpCode('123456')).toBe(true);
    expect(isValidOtpCode('123 456')).toBe(true);
    expect(isValidOtpCode('1234567890')).toBe(true);
  });

  it('rejects short, long or empty codes', () => {
    expect(isValidOtpCode('')).toBe(false);
    expect(isValidOtpCode('12345')).toBe(false);
    expect(isValidOtpCode('12345678901')).toBe(false);
    expect(isValidOtpCode('abcdef')).toBe(false);
  });
});

describe('availableSignInProviders', () => {
  const none = { platform: 'ios', appleConfigured: false, appleAvailable: false, googleConfigured: false };

  it('always offers email', () => {
    expect(availableSignInProviders(none)).toEqual(['email']);
    expect(availableSignInProviders({ ...none, platform: 'web' })).toEqual(['email']);
  });

  it('offers Apple only on iOS when configured and supported', () => {
    const apple = { ...none, appleConfigured: true, appleAvailable: true };
    expect(availableSignInProviders(apple)).toEqual(['apple', 'email']);
    expect(availableSignInProviders({ ...apple, platform: 'android' })).toEqual(['email']);
    expect(availableSignInProviders({ ...apple, appleAvailable: false })).toEqual(['email']);
    expect(availableSignInProviders({ ...apple, appleConfigured: false })).toEqual(['email']);
  });

  it('offers Google when configured, on any platform', () => {
    expect(availableSignInProviders({ ...none, platform: 'android', googleConfigured: true })).toEqual([
      'google',
      'email',
    ]);
    expect(
      availableSignInProviders({ platform: 'ios', appleConfigured: true, appleAvailable: true, googleConfigured: true }),
    ).toEqual(['apple', 'google', 'email']);
  });
});

describe('isFlagOn', () => {
  it('only turns on for true or 1', () => {
    expect(isFlagOn('true')).toBe(true);
    expect(isFlagOn('1')).toBe(true);
    expect(isFlagOn(undefined)).toBe(false);
    expect(isFlagOn('')).toBe(false);
    expect(isFlagOn('false')).toBe(false);
    expect(isFlagOn('yes')).toBe(false);
  });
});

describe('authErrorKey', () => {
  it('maps known Supabase codes', () => {
    expect(authErrorKey({ code: 'otp_expired', status: 403 })).toBe('invalidCode');
    expect(authErrorKey({ code: 'over_email_send_rate_limit', status: 429 })).toBe('tooManyRequests');
    expect(authErrorKey({ code: 'otp_disabled' })).toBe('unavailable');
  });

  it('falls back on status and error name', () => {
    expect(authErrorKey({ status: 429 })).toBe('tooManyRequests');
    expect(authErrorKey({ name: 'AuthRetryableFetchError' })).toBe('network');
    expect(authErrorKey({ status: 500 })).toBe('generic');
    expect(authErrorKey(null)).toBe('generic');
  });
});

describe('parseAuthRedirect', () => {
  it('reads the PKCE code from the query', () => {
    expect(parseAuthRedirect('carmaintenance://auth-callback?code=abc123')).toEqual({ code: 'abc123', error: undefined });
  });

  it('reads an error from the query or fragment', () => {
    expect(parseAuthRedirect('carmaintenance://auth-callback?error=access_denied&error_description=Denied')).toEqual({
      code: undefined,
      error: 'Denied',
    });
    expect(parseAuthRedirect('carmaintenance://auth-callback#error=server_error')).toEqual({
      code: undefined,
      error: 'server_error',
    });
  });

  it('returns nothing for a bare URL', () => {
    expect(parseAuthRedirect('carmaintenance://auth-callback')).toEqual({ code: undefined, error: undefined });
  });
});
