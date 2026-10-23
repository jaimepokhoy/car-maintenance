import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchTenantNames } from '../tenant-names';

const SHOP = 'aaaaaaaa-0000-4000-8000-000000000000';

function client(result: unknown) {
  const inFilter = jest.fn(async () => result);
  const select = jest.fn(() => ({ in: inFilter }));
  const from = jest.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, select, inFilter };
}

describe('fetchTenantNames', () => {
  it('reads names of the given shops from tenant_profiles', async () => {
    const mock = client({ data: [{ id: SHOP, name: 'Demo Auto Service' }, { id: 7, name: 'bad' }], error: null });
    expect(await fetchTenantNames(mock.client, [SHOP])).toEqual([{ id: SHOP, name: 'Demo Auto Service' }]);
    expect(mock.from).toHaveBeenCalledWith('tenant_profiles');
    expect(mock.select).toHaveBeenCalledWith('id, name');
    expect(mock.inFilter).toHaveBeenCalledWith('id', [SHOP]);
  });

  it('makes no request without ids', async () => {
    const mock = client({ data: [], error: null });
    expect(await fetchTenantNames(mock.client, [])).toEqual([]);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('throws when the request fails, so the caller retries after the next sync', async () => {
    const mock = client({ data: null, error: { message: 'offline' } });
    await expect(fetchTenantNames(mock.client, [SHOP])).rejects.toEqual({ message: 'offline' });
  });
});
