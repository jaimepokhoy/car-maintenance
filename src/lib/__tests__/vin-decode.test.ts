import { decodeVin, parseVpicResponse } from '../vin-decode';

function vpic(fields: Record<string, string>) {
  return { Count: 1, Results: [{ Make: '', Model: '', ModelYear: '', ...fields }] };
}

describe('parseVpicResponse', () => {
  it('maps a gas car and title-cases the make', () => {
    expect(
      parseVpicResponse(
        vpic({ Make: 'HONDA', Model: 'Accord', ModelYear: '2003', FuelTypePrimary: 'Gasoline' }),
      ),
    ).toEqual({ year: '2003', make: 'Honda', model: 'Accord', powertrain: 'gas' });
  });

  it('keeps hyphenated makes readable', () => {
    expect(parseVpicResponse(vpic({ Make: 'MERCEDES-BENZ' }))?.make).toBe('Mercedes-Benz');
  });

  it('recognizes battery electric vehicles', () => {
    expect(
      parseVpicResponse(
        vpic({ Make: 'TESLA', ElectrificationLevel: 'BEV (Battery Electric Vehicle)', FuelTypePrimary: 'Electric' }),
      )?.powertrain,
    ).toBe('ev');
  });

  it('treats hybrids and plug-in hybrids as hybrid', () => {
    for (const level of ['HEV (Hybrid Electric Vehicle) - Level Unknown', 'PHEV (Plug-in Hybrid Electric Vehicle)']) {
      expect(parseVpicResponse(vpic({ Make: 'TOYOTA', ElectrificationLevel: level }))?.powertrain).toBe('hybrid');
    }
    expect(
      parseVpicResponse(vpic({ Make: 'FORD', FuelTypePrimary: 'Gasoline', FuelTypeSecondary: 'Electric' }))
        ?.powertrain,
    ).toBe('hybrid');
  });

  it('leaves the powertrain unset when vPIC does not say', () => {
    expect(parseVpicResponse(vpic({ Make: 'HONDA' }))?.powertrain).toBeUndefined();
  });

  it('returns null when nothing useful decoded', () => {
    expect(parseVpicResponse(vpic({ Make: 'Not Applicable' }))).toBeNull();
    expect(parseVpicResponse({ Results: [] })).toBeNull();
    expect(parseVpicResponse(null)).toBeNull();
  });
});

describe('decodeVin', () => {
  it('calls vPIC with the VIN and parses the result', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => vpic({ Make: 'MAZDA', Model: 'CX-5', ModelYear: '2021', FuelTypePrimary: 'Gasoline' }),
    });
    await expect(decodeVin('JM3KFBCM1M0123456', fetchImpl)).resolves.toEqual({
      year: '2021',
      make: 'Mazda',
      model: 'CX-5',
      powertrain: 'gas',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/JM3KFBCM1M0123456?format=json',
    );
  });

  it('throws on an HTTP error so the screen can say the lookup failed', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(decodeVin('JM3KFBCM1M0123456', fetchImpl)).rejects.toThrow('503');
  });
});
