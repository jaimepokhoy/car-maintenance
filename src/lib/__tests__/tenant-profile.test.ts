import type { SupabaseClient } from '@supabase/supabase-js';

import { fetchTenantProfile } from '../tenant-profile';

const row = {
  slug: 'demo-shop',
  name: 'Demo Auto Service',
  brand: { accent: '#FF8A3D' },
  phone: null,
  email: null,
  address: null,
  latitude: null,
  longitude: null,
  hours: null,
  booking_url: null,
  website_url: null,
  updated_at: '2026-10-20T12:00:00Z',
};

function client(result: Promise<unknown>) {
  const maybeSingle = jest.fn(() => result);
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return { client: { from } as unknown as SupabaseClient, from, eq };
}

describe('fetchTenantProfile', () => {
  it("selects this shop's row from tenant_profiles", async () => {
    const mock = client(Promise.resolve({ data: row, error: null }));
    expect(await fetchTenantProfile(mock.client, 'demo-shop')).toEqual({ ok: true, profile: row });
    expect(mock.from).toHaveBeenCalledWith('tenant_profiles');
    expect(mock.eq).toHaveBeenCalledWith('slug', 'demo-shop');
  });

  it('reports a missing or suspended shop as no profile', async () => {
    const mock = client(Promise.resolve({ data: null, error: null }));
    expect(await fetchTenantProfile(mock.client, 'demo-shop')).toEqual({ ok: true, profile: null });
  });

  it('reports errors and network failures as not ok', async () => {
    expect(await fetchTenantProfile(client(Promise.resolve({ data: null, error: { message: 'x' } })).client, 'a')).toEqual({
      ok: false,
    });
    expect(await fetchTenantProfile(client(Promise.reject(new Error('offline'))).client, 'a')).toEqual({ ok: false });
  });
});
