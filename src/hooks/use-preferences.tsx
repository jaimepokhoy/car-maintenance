import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { getPreferences, setPreference } from '@/db/settings';
import { DEFAULT_PREFERENCES, type Preferences } from '@/domain';
import i18n, { detectLanguage } from '@/i18n';
import { refreshReminders } from '@/lib/reminders';

interface PreferencesContextValue {
  preferences: Preferences;
  update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  update: async () => {},
});

function applyLanguage(language: Preferences['language']) {
  i18n.changeLanguage(language === 'system' ? detectLanguage() : language);
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  useEffect(() => {
    getPreferences(db).then((stored) => {
      setPreferences(stored);
      applyLanguage(stored.language);
    });
  }, [db]);

  const update = useCallback(
    async <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      await setPreference(db, key, value);
      setPreferences((current) => ({ ...current, [key]: value }));
      if (key === 'language') applyLanguage(value as Preferences['language']);
      // Reminder text, units and tire rules all depend on preferences.
      refreshReminders(db);
    },
    [db],
  );

  const value = useMemo(() => ({ preferences, update }), [preferences, update]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
