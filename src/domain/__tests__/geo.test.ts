import { distanceKm } from '../geo';

describe('distanceKm', () => {
  it('measures Montreal to Toronto at about 504 km', () => {
    const montreal = { latitude: 45.5017, longitude: -73.5673 };
    const toronto = { latitude: 43.6532, longitude: -79.3832 };
    expect(distanceKm(montreal, toronto)).toBeGreaterThan(495);
    expect(distanceKm(montreal, toronto)).toBeLessThan(510);
  });

  it('is zero for the same point', () => {
    expect(distanceKm({ latitude: 1, longitude: 1 }, { latitude: 1, longitude: 1 })).toBe(0);
  });
});
