import { fetchModels, parseModelsResponse } from '../vehicle-models';

const body = {
  Count: 4,
  Results: [
    { Make_Name: 'Mazda', Model_Name: 'CX-50' },
    { Make_Name: 'Mazda', Model_Name: 'CX-5' },
    { Make_Name: 'Mazda', Model_Name: 'Mazda3' },
    { Make_Name: 'Mazda', Model_Name: 'CX-5' },
    { Make_Name: 'Mazda', Model_Name: ' ' },
    { Make_Name: 'Mazda', Model_Name: "'34" },
  ],
};

function response(json: unknown, ok = true) {
  return { ok, status: ok ? 200 : 500, json: async () => json } as Response;
}

describe('parseModelsResponse', () => {
  it('dedupes, drops blanks and sorts naturally', () => {
    expect(parseModelsResponse(body)).toEqual(['CX-5', 'CX-50', 'Mazda3']);
  });

  it('copes with an empty or odd body', () => {
    expect(parseModelsResponse(null)).toEqual([]);
    expect(parseModelsResponse({ Results: [{ Model_Name: 42 }] })).toEqual([]);
  });
});

describe('fetchModels', () => {
  it('merges cars, SUVs and trucks for the make and year, then caches the answer', async () => {
    const fetchImpl = jest.fn(async (url: string) =>
      response(
        url.includes('/truck')
          ? { Results: [{ Model_Name: 'BT-50' }] }
          : url.includes('/mpv')
            ? { Results: [{ Model_Name: 'CX-5' }] }
            : body,
      ),
    );
    const expected = ['BT-50', 'CX-5', 'CX-50', 'Mazda3'];
    expect(await fetchModels('Mazda', 2024, fetchImpl as unknown as typeof fetch)).toEqual(expected);
    expect(await fetchModels('mazda', 2024, fetchImpl as unknown as typeof fetch)).toEqual(expected);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/Mazda/modelyear/2024/vehicletype/mpv?format=json',
    );
  });

  it('uses what it got when one type fails, without caching it', async () => {
    const fetchImpl = jest.fn(async (url: string) => response(body, !url.includes('/truck')));
    expect(await fetchModels('Mazda', 2023, fetchImpl as unknown as typeof fetch)).toEqual([
      'CX-5',
      'CX-50',
      'Mazda3',
    ]);
    await fetchModels('Mazda', 2023, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it('encodes makes with spaces', async () => {
    const fetchImpl = jest.fn(async (_url: string) => response({ Results: [] }));
    await fetchModels('Land Rover', 2020, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl.mock.calls[0][0]).toContain('/make/Land%20Rover/');
  });

  it('throws when every request fails so the form can fall back to typing', async () => {
    await expect(fetchModels('Kia', 2021, async () => response({}, false))).rejects.toThrow();
  });
});
