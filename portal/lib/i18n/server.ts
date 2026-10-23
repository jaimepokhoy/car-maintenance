import 'server-only';

import { cookies, headers } from 'next/headers';

import { type Locale, messages, resolveLocale } from './messages';

export const LOCALE_COOKIE = 'locale';

export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get('accept-language'));
}

export async function getMessages() {
  const locale = await getLocale();
  return { locale, t: messages[locale] };
}
