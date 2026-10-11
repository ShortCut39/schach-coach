import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { memoryAppearanceStorage, setAppearanceStorage } from '../../appearance/storage';
import { resetAppearanceForTests, useAppearance } from '../../appearance/store';
import { soundSourceFor } from '../../play/sound';
import { getSettingsStorage } from '../../store/persistence';
import { clickInCard, clickPageSave, settingsCard } from '../../test/settingsScreen';
import { EinstellungenScreen } from '../screens/EinstellungenScreen';

// Dekodieren übernimmt in der App Rust bzw. das Audio-Element; hier: Länge aus Byte 5 (Zehntelsekunden)
vi.mock('../../play/sound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../play/sound')>()),
  probeSound: async (bytes: Uint8Array) => {
    const tenths = bytes[5] ?? 0;
    if (tenths === 0xff) return { ok: false, error: 'unsupported' };
    return tenths > 50 ? { ok: false, error: 'tooLong' } : { ok: true, durationMs: tenths * 100 };
  },
}));

const ogg = (tenths: number) => new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0, tenths, 0, 0]);
const file = (name: string, bytes: Uint8Array<ArrayBuffer>) => new File([bytes], name);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeEach(async () => {
  setAppearanceStorage(memoryAppearanceStorage());
  resetAppearanceForTests();
  await getSettingsStorage().set('appearance', null);
  await useAppearance.getState().load();
});

describe('Töne', () => {
  it('wählt ein Ton-Set und übernimmt es mit „Speichern“', async () => {
    render(<EinstellungenScreen />);
    clickInCard('Töne', 'Piano');
    expect(useAppearance.getState().soundSetId).toBe('builtin:sfx');
    clickPageSave();
    await waitFor(() => expect(useAppearance.getState().soundSetId).toBe('builtin:piano'));
    expect(soundSourceFor('victory')?.key).toBe('piano:Victory');
  });

  it('legt ein eigenes Set aus einzelnen Tönen an, prüft jede Datei', async () => {
    render(<EinstellungenScreen />);
    clickInCard('Töne', 'Eigenen Satz hinzufügen');
    const dialog = await screen.findByRole('dialog', { name: 'Eigene Töne hinzufügen' });
    expect(within(dialog).getByRole('button', { name: 'Speichern' })).toBeDisabled();

    fireEvent.change(within(dialog).getByTestId('upload-input'), {
      target: {
        files: [
          file('Move.ogg', ogg(4)),
          file('Capture.ogg', ogg(60)),
          file('check.mp3', PNG),
          file('Draw.ogg', ogg(0xff)),
          file('Berserk.ogg', ogg(3)),
        ],
      },
    });
    const alert = await within(dialog).findByRole('alert');
    expect(alert).toHaveTextContent('Capture.ogg: länger als 5 Sekunden');
    expect(alert).toHaveTextContent('check.mp3: kein unterstütztes Format');
    expect(alert).toHaveTextContent('Draw.ogg: dein System kann dieses Format nicht abspielen');
    expect(alert).toHaveTextContent('Berserk.ogg: Ereignis am Dateinamen nicht erkannt');
    expect(within(dialog).getByText('1 von 11 eigene')).toBeInTheDocument();
    expect(within(dialog).getByText('Move.ogg')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Standard („SFX“)')).toHaveLength(10);

    // Platz von Hand belegen
    fireEvent.click(within(dialog).getByRole('button', { name: 'Datei für Sieg wählen' }));
    fireEvent.change(within(dialog).getByTestId('slot-input'), {
      target: { files: [file('jubel.wav', ogg(12))] },
    });
    expect(await within(dialog).findByText('2 von 11 eigene')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    clickPageSave();
    await waitFor(() => expect(useAppearance.getState().soundSetId).toMatch(/^custom:/));
    // Eigene Töne für Zug (auch Rochade) und Sieg, sonst das Standard-Set
    expect(soundSourceFor('castle')?.key).toMatch(/^custom:.*:move:/);
    expect(soundSourceFor('victory')?.key).toMatch(/^custom:.*:victory:/);
    expect(soundSourceFor('defeat')?.key).toBe('sfx:Defeat');
  });

  it('übernimmt Lichess-Ordner mit Git-Verweisen (Sieg → GenericNotify)', async () => {
    render(<EinstellungenScreen />);
    clickInCard('Töne', 'Eigenen Satz hinzufügen');
    const dialog = await screen.findByRole('dialog');
    const link = (target: string) => new TextEncoder().encode(target) as Uint8Array<ArrayBuffer>;
    fireEvent.change(within(dialog).getByTestId('upload-input'), {
      target: {
        files: [
          file('Move.ogg', ogg(2)),
          file('GenericNotify.ogg', ogg(6)),
          file('Victory.ogg', link('GenericNotify.ogg')),
          file('Check.ogg', link('../Silence.ogg')),
        ],
      },
    });
    expect(await within(dialog).findByText('4 von 11 eigene')).toBeInTheDocument();
    expect(within(dialog).getByText('Victory.ogg')).toBeInTheDocument();
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Check.ogg: ist kein Ton und kein Bild, sondern nur ein Verweis auf „Silence.ogg“',
    );
  });

  it('bearbeitet ein eigenes Set: Platz leeren und speichern', async () => {
    const storage = memoryAppearanceStorage();
    setAppearanceStorage(storage);
    const uuid = '0b7e9c1a-1111-4222-8333-444455556666';
    await storage.write(
      'sounds',
      uuid,
      'meta.json',
      new TextEncoder().encode(
        JSON.stringify({ name: 'Klick', created: '2026-10-11', kind: 'sounds' }),
      ),
    );
    await storage.write('sounds', uuid, 'move.ogg', ogg(2));
    await storage.write('sounds', uuid, 'check.ogg', ogg(3));
    await useAppearance.getState().refreshCustom('sounds');

    render(<EinstellungenScreen />);
    expect(within(settingsCard('Töne')).getByText('2 von 11 eigene')).toBeInTheDocument();
    clickInCard('Töne', '„Klick“ bearbeiten');
    const dialog = await screen.findByRole('dialog', { name: 'Eigene Töne bearbeiten' });
    fireEvent.click(
      await within(dialog).findByRole('button', { name: 'Eigenen Ton für Schach entfernen' }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await storage.list('sounds')).toEqual([
      expect.objectContaining({ files: ['move.ogg'] }),
    ]);
    expect(within(settingsCard('Töne')).getByText('1 von 11 eigene')).toBeInTheDocument();
  });
});
