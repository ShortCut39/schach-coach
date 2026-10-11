import { getSettingsStorage } from '../store/persistence';
import { soundSourceFor } from '../play/sound';
import { DEFAULT_APPEARANCE, resetAppearanceForTests, useAppearance } from './store';
import { memoryAppearanceStorage, setAppearanceStorage, type AppearanceStorage } from './storage';
import { PIECE_CODES } from './types';

const UUID = '0b7e9c1a-1111-4222-8333-444455556666';
const text = (value: string) => new TextEncoder().encode(value);
const SVG = text(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><circle r="9"/></svg>',
);
const EVIL_SVG = text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0]);

function meta(kind: string, extra: Record<string, string> = {}) {
  return text(
    JSON.stringify({ name: 'Mein Satz', created: '2026-10-11T10:00:00Z', kind, ...extra }),
  );
}

async function pieceSet(
  storage: AppearanceStorage,
  svgFor: (code: string) => Uint8Array = () => SVG,
) {
  await storage.write('pieces', UUID, 'meta.json', meta('pieces'));
  for (const code of PIECE_CODES) await storage.write('pieces', UUID, `${code}.svg`, svgFor(code));
}

let storage: AppearanceStorage;

beforeEach(async () => {
  storage = memoryAppearanceStorage();
  setAppearanceStorage(storage);
  resetAppearanceForTests();
  await getSettingsStorage().set('appearance', null);
  await getSettingsStorage().set('settings', null);
});

describe('Darstellung', () => {
  it('startet mit cburnett, App-Brett und sfx', async () => {
    await useAppearance.getState().load();
    const state = useAppearance.getState();
    expect(state.pieceSetId).toBe('builtin:cburnett');
    expect(state.boardThemeId).toBe('builtin:app');
    expect(state.soundSetId).toBe('builtin:sfx');
    expect(state.showCoordinates).toBe(true);
    expect(state.pieces.wK).toMatch(/cburnett\/wK\.svg|^data:/);
    expect(state.board).toEqual({
      kind: 'colors',
      light: 'var(--sc-board-light)',
      dark: 'var(--sc-board-dark)',
    });
    expect(state.fallbacks).toEqual([]);
  });

  it('übernimmt beim ersten Start das bisherige Brett aus den Einstellungen', async () => {
    await getSettingsStorage().set('settings', { boardTheme: 'wood' });
    await useAppearance.getState().load();
    expect(useAppearance.getState().boardThemeId).toBe('builtin:wood');
  });

  it('speichert die Auswahl sofort', async () => {
    await useAppearance.getState().load();
    await useAppearance.getState().select('pieces', 'builtin:merida');
    await useAppearance.getState().select('boards', 'builtin:green');
    await useAppearance.getState().setShowCoordinates(false);
    expect(await getSettingsStorage().get('appearance')).toEqual({
      ...DEFAULT_APPEARANCE,
      pieceSetId: 'builtin:merida',
      boardThemeId: 'builtin:green',
      showCoordinates: false,
    });
    expect(useAppearance.getState().board).toEqual({
      kind: 'colors',
      light: '#ffffdd',
      dark: '#86a666',
    });
  });

  it('fällt bei fehlender oder kaputter Auswahl still auf den Standard zurück und meldet es einmal', async () => {
    await getSettingsStorage().set('appearance', {
      pieceSetId: 'custom:00000000-0000-4000-8000-000000000000',
      boardThemeId: 'builtin:gibtsnicht',
      soundSetId: 42,
      showCoordinates: 'ja',
    });
    await useAppearance.getState().load();
    const state = useAppearance.getState();
    expect(state.pieceSetId).toBe('builtin:cburnett');
    expect(state.boardThemeId).toBe('builtin:app');
    expect(state.soundSetId).toBe('builtin:sfx');
    expect(state.fallbacks).toEqual(['pieces', 'boards']);
    // Gespeichert ist wieder der Standard: beim nächsten Start kein Hinweis
    expect(await getSettingsStorage().get('appearance')).toEqual(DEFAULT_APPEARANCE);
    state.dismissFallbacks();
    expect(useAppearance.getState().fallbacks).toEqual([]);
  });

  it('lädt einen eigenen Figurensatz und zeigt ihn als Bilder', async () => {
    await pieceSet(storage);
    await getSettingsStorage().set('appearance', { pieceSetId: `custom:${UUID}` });
    await useAppearance.getState().load();
    const state = useAppearance.getState();
    expect(state.pieceSetId).toBe(`custom:${UUID}`);
    expect(state.pieces.bQ).toMatch(/^(blob:|data:image\/svg\+xml)/);
    expect(state.custom.pieces).toEqual([
      expect.objectContaining({ id: `custom:${UUID}`, name: 'Mein Satz', broken: false }),
    ]);
  });

  it('markiert unvollständige oder gefährliche Sätze als defekt und nutzt den Standard', async () => {
    await pieceSet(storage, (code) => (code === 'bN' ? EVIL_SVG : SVG));
    await getSettingsStorage().set('appearance', { pieceSetId: `custom:${UUID}` });
    await useAppearance.getState().load();
    let state = useAppearance.getState();
    expect(state.pieceSetId).toBe('builtin:cburnett');
    expect(state.custom.pieces[0]?.broken).toBe(true);
    expect(state.fallbacks).toEqual(['pieces']);

    await storage.removeFile('pieces', UUID, 'wK.svg');
    await useAppearance.getState().refreshCustom('pieces');
    state = useAppearance.getState();
    expect(state.custom.pieces[0]?.broken).toBe(true);
    expect(await useAppearance.getState().select('pieces', `custom:${UUID}`)).toBe(false);
    expect(useAppearance.getState().pieceSetId).toBe('builtin:cburnett');
  });

  it('nutzt eigene Bretter aus Farben', async () => {
    await storage.write(
      'boards',
      UUID,
      'meta.json',
      meta('boards', { light: '#ffeedd', dark: '#335577' }),
    );
    await useAppearance.getState().load();
    expect(await useAppearance.getState().select('boards', `custom:${UUID}`)).toBe(true);
    expect(useAppearance.getState().board).toEqual({
      kind: 'colors',
      light: '#ffeedd',
      dark: '#335577',
    });
  });

  it('füllt freie Plätze eines eigenen Ton-Sets mit dem Standard-Set', async () => {
    await storage.write('sounds', UUID, 'meta.json', meta('sounds'));
    await storage.write('sounds', UUID, 'move.ogg', OGG);
    await useAppearance.getState().load();
    expect(await useAppearance.getState().select('sounds', `custom:${UUID}`)).toBe(true);
    expect(soundSourceFor('castle')?.key).toMatch(new RegExp(`^custom:${UUID}:move:`));
    expect(soundSourceFor('victory')?.key).toBe('sfx:Victory');
  });

  it('geht zurück auf den Standard, wenn der aktive eigene Satz gelöscht wird', async () => {
    await pieceSet(storage);
    await useAppearance.getState().load();
    await useAppearance.getState().select('pieces', `custom:${UUID}`);
    await storage.remove('pieces', UUID);
    await useAppearance.getState().refreshCustom('pieces');
    expect(useAppearance.getState().pieceSetId).toBe('builtin:cburnett');
    expect(useAppearance.getState().custom.pieces).toEqual([]);
  });

  it('setzt einen Bereich auf den Standard zurück', async () => {
    await useAppearance.getState().load();
    await useAppearance.getState().select('sounds', 'builtin:piano');
    await useAppearance.getState().reset('sounds');
    expect(useAppearance.getState().soundSetId).toBe('builtin:sfx');
  });
});
