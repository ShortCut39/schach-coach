import i18n from '../i18n';
import { formatPercent } from './format';

describe('formatPercent', () => {
  afterEach(async () => {
    await i18n.changeLanguage('de');
  });

  it('nutzt das deutsche Komma und eine Nachkommastelle (geschütztes Leerzeichen vor %)', () => {
    expect(formatPercent(96.14)).toBe('96,1 %');
    expect(formatPercent(100)).toBe('100,0 %');
    expect(formatPercent(undefined)).toBe('–');
  });

  it('schreibt auf Englisch mit Punkt und ohne Leerzeichen', async () => {
    await i18n.changeLanguage('en');
    expect(formatPercent(96.14)).toBe('96.1%');
  });
});
