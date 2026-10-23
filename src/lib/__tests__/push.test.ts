import type { SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken, removePushToken, SHOP_CHANNEL_ID } from '../push';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} }, easConfig: null } }));
jest.mock('expo-device', () => ({ isDevice: true }));
jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  getPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));
jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));

const TOKEN = 'ExponentPushToken[abc]';
const SHOP = '22222222-2222-4222-8222-222222222222';

/** Records every query builder call; reads of `tenant_profiles` answer with `profile`. */
function fakeClient(profile: { id: string } | null = null) {
  const calls: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'delete']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.maybeSingle = async () => ({ data: profile, error: null });
  builder.then = (resolve: (value: unknown) => void) => resolve({ data: null, error: null });
  const client = {
    rpc: async (...args: unknown[]) => {
      calls.push(['rpc', ...args]);
      return { data: null, error: null };
    },
    from: (table: string) => {
      calls.push(['from', table]);
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

function setExtra(extra: Record<string, unknown>) {
  (Constants as { expoConfig: { extra: Record<string, unknown> } }).expoConfig.extra = extra;
}

beforeEach(async () => {
  Platform.OS = 'ios';
  setExtra({ eas: { projectId: 'project-1' } });
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(Notifications.getExpoPushTokenAsync).mockResolvedValue({ type: 'expo', data: TOKEN });
  // Forget the token an earlier test registered.
  await removePushToken(fakeClient().client);
  jest.clearAllMocks();
});

describe('registering a push token', () => {
  it('saves the token with no shop in the unbranded app', async () => {
    const { client, calls } = fakeClient();

    await registerPushToken(client, 'me');

    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-1' });
    expect(calls).not.toContainEqual(['from', 'tenant_profiles']);
    expect(calls).toContainEqual(['rpc', 'register_push_token', { p_token: TOKEN, p_platform: 'ios', p_tenant_id: null }]);
  });

  it('records the shop a branded build belongs to', async () => {
    setExtra({ eas: { projectId: 'project-1' }, tenant: { slug: 'garage-tremblay' } });
    const { client, calls } = fakeClient({ id: SHOP });

    await registerPushToken(client, 'me');

    expect(calls).toContainEqual(['eq', 'slug', 'garage-tremblay']);
    expect(calls).toContainEqual(['rpc', 'register_push_token', { p_token: TOKEN, p_platform: 'ios', p_tenant_id: SHOP }]);
  });

  it('creates the shop channel first on Android', async () => {
    Platform.OS = 'android';
    const { client, calls } = fakeClient();

    await registerPushToken(client, 'me');

    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(SHOP_CHANNEL_ID, expect.anything());
    expect(calls).toContainEqual(['rpc', 'register_push_token', expect.objectContaining({ p_platform: 'android' })]);
  });

  it('does nothing without permission, on web, or without an EAS project', async () => {
    const { client, calls } = fakeClient();

    jest.mocked(Notifications.getPermissionsAsync).mockResolvedValueOnce({ granted: false } as never);
    await registerPushToken(client, 'me');
    Platform.OS = 'web';
    await registerPushToken(client, 'me');
    Platform.OS = 'ios';
    setExtra({});
    await registerPushToken(client, 'me');

    expect(calls).toEqual([]);
    expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('uploads once per owner while the app runs', async () => {
    const { client, calls } = fakeClient();

    await registerPushToken(client, 'me');
    await registerPushToken(client, 'me');

    expect(calls.filter(([method]) => method === 'rpc')).toHaveLength(1);
  });
});

describe('removing a push token', () => {
  it('deletes the registered token', async () => {
    const { client, calls } = fakeClient();
    await registerPushToken(client, 'me');

    await removePushToken(client);

    expect(calls).toContainEqual(['delete']);
    expect(calls).toContainEqual(['eq', 'token', TOKEN]);
  });

  it('waits for a registration still in progress, so the token never outlives sign-out', async () => {
    const { client, calls } = fakeClient();

    const registering = registerPushToken(client, 'me');
    await removePushToken(client);
    await registering;

    const methods = calls.map(([method]) => method);
    expect(methods.indexOf('rpc')).toBeLessThan(methods.indexOf('delete'));
    expect(calls).toContainEqual(['eq', 'token', TOKEN]);
  });

  it("looks up this device's token when none was registered in this run", async () => {
    const { client, calls } = fakeClient();

    await removePushToken(client);

    expect(calls).toContainEqual(['eq', 'token', TOKEN]);
  });

  it('does not hold up sign-out when the delete fails', async () => {
    const { client } = fakeClient();
    jest.mocked(Notifications.getExpoPushTokenAsync).mockRejectedValueOnce(new Error('offline'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(removePushToken(client)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
