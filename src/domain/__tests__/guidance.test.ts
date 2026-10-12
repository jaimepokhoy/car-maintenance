import { GUIDANCE } from '../guidance';

describe('GUIDANCE', () => {
  it('has sane cost ranges', () => {
    for (const { costCents: [min, max] } of Object.values(GUIDANCE)) {
      expect(min).toBeGreaterThanOrEqual(0);
      expect(max).toBeGreaterThan(min);
    }
  });
});
