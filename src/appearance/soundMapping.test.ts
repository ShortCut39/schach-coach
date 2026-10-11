import { fallbackChain, pickCustomSound, pickSound, SOUND_EVENTS } from './soundMapping';

describe('Ersatzkette der Töne', () => {
  it('endet bei jedem Ereignis beim Zug-Ton', () => {
    for (const event of SOUND_EVENTS) {
      const chain = fallbackChain(event);
      expect(chain[0]).toBe(event);
      expect(chain.at(-1)).toBe('move');
    }
  });

  it('geht von spezifisch zu allgemein', () => {
    expect(fallbackChain('victory')).toEqual(['victory', 'gameEnd', 'move']);
    expect(pickSound('victory', { gameEnd: 'ende', move: 'zug' })).toBe('ende');
    expect(pickSound('castle', { move: 'zug' })).toBe('zug');
    expect(pickSound('draw', {})).toBeUndefined();
  });

  it('nimmt bei eigenen Sets für Züge den eigenen Zug-Ton, sonst das Standard-Set', () => {
    const own = { move: 'eigener Zug' };
    const standard = { move: 'Zug', victory: 'Sieg', check: 'Schach' };
    expect(pickCustomSound('castle', own, standard)).toEqual({ sound: 'eigener Zug', own: true });
    expect(pickCustomSound('check', own, standard)).toEqual({ sound: 'eigener Zug', own: true });
    expect(pickCustomSound('victory', own, standard)).toEqual({ sound: 'Sieg', own: false });
    expect(pickCustomSound('lowTime', own, standard)).toEqual({ sound: 'Zug', own: false });
    // Eigenes Partieende deckt Sieg mit ab
    expect(pickCustomSound('victory', { gameEnd: 'Ende' }, standard)).toEqual({
      sound: 'Ende',
      own: true,
    });
  });
});
