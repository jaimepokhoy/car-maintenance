import { nextTireReminder } from '../seasonal-tires';

describe('nextTireReminder', () => {
  it('reminds to install winter tires on October 15', () => {
    expect(nextTireReminder('2026-09-01', 'ON', 'all_season')).toEqual({
      action: 'install_winter',
      remindOn: '2026-10-15',
    });
  });

  it('reminds right away when winter has started and winter tires are not on', () => {
    expect(nextTireReminder('2026-11-20', 'ON', 'all_season').remindOn).toBe('2026-11-20');
    expect(nextTireReminder('2027-02-01', 'ON', 'summer').remindOn).toBe('2027-02-01');
  });

  it('adds the Quebec December 1 legal deadline', () => {
    expect(nextTireReminder('2026-09-01', 'QC', 'all_season').legalDeadline).toBe('2026-12-01');
    expect(nextTireReminder('2027-02-01', 'QC', 'all_season').legalDeadline).toBe('2026-12-01');
    expect(nextTireReminder('2026-09-01', 'ON', 'all_season').legalDeadline).toBeUndefined();
  });

  it('reminds to remove winter tires on April 15', () => {
    expect(nextTireReminder('2026-11-01', 'QC', 'winter')).toEqual({
      action: 'remove_winter',
      remindOn: '2027-04-15',
    });
    expect(nextTireReminder('2027-03-01', 'QC', 'winter').remindOn).toBe('2027-04-15');
  });

  it('reminds right away when winter tires are still on after April 15', () => {
    expect(nextTireReminder('2027-05-10', 'BC', 'winter').remindOn).toBe('2027-05-10');
  });
});
