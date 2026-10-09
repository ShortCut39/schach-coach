import { formatMoveNumber, formatSan } from './notation';

describe('formatSan', () => {
  it.each([
    ['Qb8+', 'Db8+'],
    ['Nxb8', 'Sxb8'],
    ['Rd8#', 'Td8#'],
    ['Bxd7+', 'Lxd7+'],
    ['Kf1', 'Kf1'],
    ['Nbd7', 'Sbd7'],
    ['R1e2', 'T1e2'],
    ['Qh4xe1', 'Dh4xe1'],
    ['e4', 'e4'],
    ['exd6', 'exd6'],
    ['bxc3', 'bxc3'],
    ['b5', 'b5'],
    ['e8=Q+', 'e8=D+'],
    ['bxa1=N', 'bxa1=S'],
    ['O-O', 'O-O'],
    ['O-O-O+', 'O-O-O+'],
  ])('deutsch: %s → %s', (san, expected) => {
    expect(formatSan(san, 'de')).toBe(expected);
  });

  it('englisch bleibt unverändert', () => {
    expect(formatSan('Qb8+', 'en')).toBe('Qb8+');
    expect(formatSan('e8=N', 'en')).toBe('e8=N');
  });
});

describe('formatMoveNumber', () => {
  it('schreibt Weiß mit Punkt und Schwarz mit Auslassungszeichen', () => {
    expect(formatMoveNumber(16, 'w')).toBe('16.');
    expect(formatMoveNumber(9, 'b')).toBe('9…');
  });
});
