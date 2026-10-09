import { formatPercent } from './format';

describe('formatPercent', () => {
  it('nutzt das deutsche Komma und eine Nachkommastelle', () => {
    expect(formatPercent(96.14)).toBe('96,1 %');
    expect(formatPercent(100)).toBe('100,0 %');
    expect(formatPercent(undefined)).toBe('–');
  });
});
