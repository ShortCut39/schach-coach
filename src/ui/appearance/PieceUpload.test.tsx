import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { memoryAppearanceStorage, setAppearanceStorage } from '../../appearance/storage';
import { resetAppearanceForTests, useAppearance } from '../../appearance/store';
import { PIECE_CODES } from '../../appearance/types';
import { getSettingsStorage } from '../../store/persistence';
import { clickPageSave, settingsCard } from '../../test/settingsScreen';
import { EinstellungenScreen } from '../screens/EinstellungenScreen';

const svg = (label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45"><text>${label}</text></svg>`;
const file = (name: string, content: string, type = 'image/svg+xml') =>
  new File([content], name, { type });

const LONG_NAMES: Record<string, string> = {
  wK: 'white_king',
  wQ: 'WhiteQueen',
  wR: 'weisser-turm',
  wB: 'white bishop',
  wN: 'Weißer Springer',
  wP: 'wP',
  bK: 'black_king',
  bQ: 'schwarze_dame',
  bR: 'bR',
  bB: 'BlackBishop',
  bN: 'black-knight',
  bP: 'schwarzer_bauer',
};

function upload(input: HTMLElement, files: File[]) {
  fireEvent.change(input, { target: { files } });
}

beforeEach(async () => {
  setAppearanceStorage(memoryAppearanceStorage());
  resetAppearanceForTests();
  await getSettingsStorage().set('appearance', null);
  await useAppearance.getState().load();
});

describe('Eigene Figuren hochladen', () => {
  it('ordnet 12 Dateien nach dem Namen zu, speichert und wählt den Satz', async () => {
    render(<EinstellungenScreen />);
    fireEvent.click(
      within(settingsCard('Figuren')).getByRole('button', { name: 'Eigenen Satz hinzufügen' }),
    );
    const dialog = await screen.findByRole('dialog', { name: 'Eigene Figuren hinzufügen' });
    expect(within(dialog).getByText(/Nichts verlässt deinen Computer/)).toBeInTheDocument();
    const save = within(dialog).getByRole('button', { name: 'Speichern' });
    expect(save).toBeDisabled();

    // Zuerst elf Figuren und eine gefährliche Datei
    const files = PIECE_CODES.filter((c) => c !== 'bN').map((code) =>
      file(`${LONG_NAMES[code]}.svg`, svg(code)),
    );
    upload(within(dialog).getByTestId('upload-input'), [
      ...files,
      file(
        'black_knight.svg',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>x()</script></svg>',
      ),
      file('notiz.svg', 'kein Bild'),
    ]);
    expect(await within(dialog).findByText('Noch 1 Platz frei.')).toBeInTheDocument();
    const alert = within(dialog).getByRole('alert');
    expect(alert).toHaveTextContent('black_knight.svg');
    expect(alert).toHaveTextContent('SVG enthält Skripte');
    expect(alert).toHaveTextContent('notiz.svg');
    expect(save).toBeDisabled();

    // Den letzten Platz von Hand belegen
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Datei für Schwarzer Springer wählen' }),
    );
    upload(within(dialog).getByTestId('slot-input'), [file('pferd.svg', svg('bN'))]);
    expect(await within(dialog).findByText('Alle 12 Figuren zugeordnet.')).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Meine Figuren' } });
    fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    // Gewählt ist der neue Satz erst im Entwurf; übernommen wird mit „Speichern“ unten
    const tile = await within(settingsCard('Figuren')).findByRole('button', {
      name: 'Meine Figuren',
      pressed: true,
    });
    expect(tile).toBeInTheDocument();
    expect(useAppearance.getState().pieceSetId).toBe('builtin:cburnett');
    clickPageSave();
    await waitFor(() => expect(useAppearance.getState().pieceSetId).toMatch(/^custom:/));

    const state = useAppearance.getState();
    expect(state.pieceSetId).toMatch(/^custom:/);
    expect(state.custom.pieces).toEqual([
      expect.objectContaining({ name: 'Meine Figuren', broken: false }),
    ]);
    expect(state.pieces.bN).toMatch(/^(blob:|data:image\/svg\+xml)/);
    expect(
      screen.getByRole('button', { name: 'Meine Figuren', pressed: true }),
    ).toBeInTheDocument();
  });

  it('ordnet unbekannte Namen per Auswahl zu', async () => {
    render(<EinstellungenScreen />);
    fireEvent.click(
      within(settingsCard('Figuren')).getByRole('button', { name: 'Eigenen Satz hinzufügen' }),
    );
    const dialog = await screen.findByRole('dialog');
    upload(within(dialog).getByTestId('upload-input'), [file('figur1.svg', svg('?'))]);
    const select = await within(dialog).findByRole('combobox', {
      name: 'Platz für figur1.svg wählen',
    });
    fireEvent.change(select, { target: { value: 'wQ' } });
    expect(await within(dialog).findByText('Noch 11 Plätze frei.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Nicht zugeordnet')).not.toBeInTheDocument();
  });

  it('benennt eigene Sätze um und löscht sie nach Rückfrage', async () => {
    const storage = memoryAppearanceStorage();
    setAppearanceStorage(storage);
    const uuid = '0b7e9c1a-1111-4222-8333-444455556666';
    const encode = (s: string) => new TextEncoder().encode(s);
    await storage.write(
      'pieces',
      uuid,
      'meta.json',
      encode(JSON.stringify({ name: 'Alt', created: '2026-10-11', kind: 'pieces' })),
    );
    for (const code of PIECE_CODES)
      await storage.write('pieces', uuid, `${code}.svg`, encode(svg(code)));
    await useAppearance.getState().refreshCustom('pieces');

    render(<EinstellungenScreen />);
    fireEvent.click(screen.getByRole('button', { name: '„Alt“ umbenennen' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Neu' } });
    fireEvent.click(within(settingsCard('Figuren')).getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByRole('button', { name: 'Neu' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '„Neu“ löschen' }));
    expect(screen.getByText('„Neu“ wirklich löschen?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ja, löschen' }));
    expect(
      await within(settingsCard('Figuren')).findByText('Noch keine eigenen Sätze.'),
    ).toBeInTheDocument();
  });
});
