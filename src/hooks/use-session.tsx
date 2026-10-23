import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';

import { refreshPushToken } from '@/lib/push';
import { supabase } from '@/lib/supabase';

interface SessionContextValue {
  /** The signed-in session, or `null` when signed out or when Supabase isn't configured. */
  session: Session | null;
  /** False until the stored session has been read, so screens don't flash the signed-out state. */
  ready: boolean;
}

const SessionContext = createContext<SessionContextValue>({ session: null, ready: true });

/** Holds the Supabase Auth session. Without Supabase it stays signed out and the app works offline as before. */
export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    const auth = supabase.auth;

    auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setReady(true));
    const { data } = auth.onAuthStateChange((_event, next) => setSession(next));

    // Refresh tokens only while the app is in the foreground, as Supabase recommends for React Native.
    const appState =
      Platform.OS === 'web'
        ? undefined
        : AppState.addEventListener('change', (state) => {
            if (state === 'active') auth.startAutoRefresh();
            else auth.stopAutoRefresh();
          });

    return () => {
      data.subscription.unsubscribe();
      appState?.remove();
    };
  }, []);

  // Register this device for shop messages once signed in, and again on return
  // to the foreground in case notifications were allowed since.
  const userId = session?.user.id;
  useEffect(() => {
    const client = supabase;
    if (!client || !userId || Platform.OS === 'web') return;
    refreshPushToken(client, userId);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPushToken(client, userId);
    });
    return () => appState.remove();
  }, [userId]);

  const value = useMemo(() => ({ session, ready }), [session, ready]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
