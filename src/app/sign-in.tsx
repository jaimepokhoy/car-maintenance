import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppleSignInButton } from '@/components/apple-sign-in-button';
import { Button } from '@/components/button';
import { FormScreen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { isValidEmail, isValidOtpCode, normalizeEmail, OTP_MAX_LENGTH, type SignInProvider } from '@/domain';
import { useSession } from '@/hooks/use-session';
import {
  sendEmailCode,
  signInProviders,
  signInWithApple,
  signInWithGoogle,
  verifyEmailCode,
  type AuthResult,
} from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type ErrorKey = 'invalidEmail' | 'invalidCode' | 'tooManyRequests' | 'network' | 'unavailable' | 'generic';

export default function SignInScreen() {
  // Settings never links here without Supabase; a stray deep link just goes back there.
  if (!supabase) return <Redirect href="/settings" />;
  return <SignInForm />;
}

function SignInForm() {
  const { t } = useTranslation();
  const { session } = useSession();
  const [providers, setProviders] = useState<SignInProvider[]>(['email']);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<ErrorKey>();
  const [busy, setBusy] = useState<'apple' | 'google' | 'send' | 'resend' | 'verify'>();

  useEffect(() => {
    signInProviders().then(setProviders);
  }, []);

  // Every provider ends the same way: the session appears and this screen closes.
  useEffect(() => {
    if (!session) return;
    if (router.canGoBack()) router.back();
    else router.replace('/settings');
  }, [session]);

  async function run(action: NonNullable<typeof busy>, attempt: () => Promise<AuthResult>): Promise<boolean> {
    setBusy(action);
    setError(undefined);
    try {
      const result = await attempt();
      if (!result.ok && result.error !== 'cancelled') setError(result.error);
      return result.ok;
    } finally {
      setBusy(undefined);
    }
  }

  async function sendCode(action: 'send' | 'resend') {
    if (!isValidEmail(email)) return setError('invalidEmail');
    const sent = await run(action, () => sendEmailCode(email));
    if (sent) {
      setStep('code');
      setCode('');
    }
  }

  async function verify() {
    if (!isValidOtpCode(code)) return setError('invalidCode');
    await run('verify', () => verifyEmailCode(email, code));
  }

  const errorText = error ? t(`auth.errors.${error}`) : undefined;
  const social = providers.filter((provider) => provider !== 'email');

  if (step === 'code') {
    return (
      <FormScreen
        footer={<Button title={t('auth.verify')} size="large" onPress={verify} loading={busy === 'verify'} />}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('auth.codeSent', { email: normalizeEmail(email) })}
        </ThemedText>
        <TextField
          label={t('auth.code')}
          value={code}
          onChangeText={(next) => {
            setCode(next);
            setError(undefined);
          }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={OTP_MAX_LENGTH + 2}
          size="large"
          autoFocus
          error={errorText}
        />
        <View style={styles.row}>
          <Button
            title={t('auth.resend')}
            variant="secondary"
            size="small"
            onPress={() => sendCode('resend')}
            loading={busy === 'resend'}
          />
          <Button
            title={t('auth.changeEmail')}
            variant="secondary"
            size="small"
            onPress={() => {
              setStep('email');
              setError(undefined);
            }}
          />
        </View>
      </FormScreen>
    );
  }

  return (
    <FormScreen
      footer={
        <Button title={t('auth.sendCode')} size="large" onPress={() => sendCode('send')} loading={busy === 'send'} />
      }>
      <ThemedText type="small" themeColor="textSecondary">
        {t('auth.intro')}
      </ThemedText>
      {social.length > 0 ? (
        <View style={styles.social}>
          {social.includes('apple') ? (
            <AppleSignInButton onPress={() => run('apple', signInWithApple)} />
          ) : null}
          {social.includes('google') ? (
            <Button
              title={t('auth.google')}
              variant="secondary"
              size="large"
              onPress={() => run('google', signInWithGoogle)}
              loading={busy === 'google'}
            />
          ) : null}
          <ThemedText type="caption" themeColor="textSecondary" style={styles.or}>
            {t('auth.or')}
          </ThemedText>
        </View>
      ) : null}
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={(next) => {
          setEmail(next);
          setError(undefined);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={() => sendCode('send')}
        hint={t('auth.emailHint')}
        error={errorText}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  social: {
    gap: Spacing.three,
  },
  or: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
