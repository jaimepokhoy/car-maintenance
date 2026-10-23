'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import { type Messages, format } from '@/lib/i18n/messages';
import { createClient } from '@/lib/supabase/browser';

type Props = { env: { url: string; anonKey: string }; t: Messages['signIn'] };

/** Email OTP: send a code to an existing staff account, then verify it. */
export function SignInForm({ env, t }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    // shouldCreateUser: false — staff accounts are created at onboarding, never from here.
    const { error } = await createClient(env).auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    setBusy(false);
    if (error) setError(t.sendFailed);
    else setStep('code');
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient(env).auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    if (error) {
      setBusy(false);
      setError(t.verifyFailed);
      return;
    }
    router.replace('/tenants');
    router.refresh();
  }

  if (step === 'email') {
    return (
      <form className="card" onSubmit={sendCode}>
        <div className="field">
          <label htmlFor="email">{t.email}</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'sign-in-error' : undefined}
          />
        </div>
        {error && (
          <p id="sign-in-error" className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? t.sending : t.sendCode}
        </button>
      </form>
    );
  }

  return (
    <form className="card" onSubmit={verify}>
      <p role="status">{format(t.codeSent, { email: email.trim() })}</p>
      <div className="field">
        <label htmlFor="code">{t.code}</label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          maxLength={10}
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'code-error' : undefined}
        />
      </div>
      {error && (
        <p id="code-error" className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="submit" disabled={busy}>
          {busy ? t.verifying : t.verify}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setStep('email');
            setCode('');
            setError(null);
          }}
        >
          {t.useOtherEmail}
        </button>
      </div>
    </form>
  );
}
