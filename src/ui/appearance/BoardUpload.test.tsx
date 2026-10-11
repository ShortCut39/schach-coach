import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { memoryAppearanceStorage, setAppearanceStorage } from '../../appearance/storage';
import { resetAppearanceForTests, useAppearance } from '../../appearance/store';
import { getSettingsStorage } from '../../store/persistence';
import { clickInCard, clickPageSave, settingsCard } from '../../test/settingsScreen';
import { boardAppearanceOptions } from '../boardAppearance';
import { EinstellungenScreen } from '../screens/EinstellungenScreen';

// jsdom lädt keine Bilder: Abmessungen vorgeben (quadratisch bzw. breit)
const size = vi.hoisted(() => ({ width: 800, height: 800 }));
vi.mock('./imageInfo', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./imageInfo')>()),
  imageSize: async () => ({ ...size }),
}));

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

beforeEach(async () => {
  setAppearanceStorage(memoryAppearanceStorage());
  resetAppearanceForTests();
  await getSettingsStorage().set('appearance', null);
  await useAppearance.getState().load();
  size.width = 800;
  size.height = 800;
});

describe('Brett', () => {
  it('wählt Farbpaare sofort und schaltet Koordinaten', async () => {
    render(<EinstellungenScreen />);
    clickInCard('Brett', 'Braun');
    expect(
      within(settingsCard('Brett')).getByRole('button', { name: 'Braun', pressed: true }),
    ).toBeInTheDocument();
    // Erst „Speichern“ übernimmt die Auswahl
    expect(useAppearance.getState().boardThemeId).toBe('builtin:app');
    fireEvent.click(screen.getByRole('switch', { name: 'Koordinaten am Brettrand' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Figuren-Animation' }));
    expect(useAppearance.getState().showCoordinates).toBe(true);
    expect(useAppearance.getState().animatePieces).toBe(true);
    clickPageSave();
    await waitFor(() =>
      expect(useAppearance.getState().board).toEqual({
        kind: 'colors',
        light: '#f0d9b5',
        dark: '#b58863',
      }),
    );
    expect(useAppearance.getState().showCoordinates).toBe(false);
    expect(useAppearance.getState().animatePieces).toBe(false);
    const { pieces, board } = useAppearance.getState();
    expect(boardAppearanceOptions(pieces, board, true, false).showAnimations).toBe(false);
    // Zurücksetzen und Verwerfen: der Entwurf geht zurück auf den gespeicherten Stand
    clickInCard('Brett', 'Zurücksetzen auf Standard');
    expect(
      within(settingsCard('Brett')).getByRole('button', { name: /App-Standard/, pressed: true }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Verwerfen' }));
    expect(
      await within(settingsCard('Brett')).findByRole('button', { name: 'Braun', pressed: true }),
    ).toBeInTheDocument();
    expect(useAppearance.getState().boardThemeId).toBe('builtin:brown');
  });

  it('legt ein Brett aus zwei Farben an und warnt bei wenig Kontrast', async () => {
    render(<EinstellungenScreen />);
    clickInCard('Brett', 'Eigenen Satz hinzufügen');
    const dialog = await screen.findByRole('dialog', { name: 'Eigenes Brett hinzufügen' });
    fireEvent.change(
      within(dialog).getByLabelText('Helle Felder', { selector: 'input:not([type=color])' }),
      {
        target: { value: '#808080' },
      },
    );
    fireEvent.change(
      within(dialog).getByLabelText('Dunkle Felder', { selector: 'input:not([type=color])' }),
      {
        target: { value: '#7a7a7a' },
      },
    );
    expect(within(dialog).getByText(/kaum zu unterscheiden/)).toBeInTheDocument();
    fireEvent.change(
      within(dialog).getByLabelText('Helle Felder', { selector: 'input:not([type=color])' }),
      {
        target: { value: 'ffeedd' },
      },
    );
    expect(within(dialog).queryByText(/kaum zu unterscheiden/)).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    clickPageSave();
    await waitFor(() =>
      expect(useAppearance.getState().board).toEqual({
        kind: 'colors',
        light: '#ffeedd',
        dark: '#7a7a7a',
      }),
    );
  });

  it('nimmt ein quadratisches Brettbild an und lehnt falsche Dateien ab', async () => {
    render(<EinstellungenScreen />);
    clickInCard('Brett', 'Eigenen Satz hinzufügen');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Brettbild' }));
    const input = within(dialog).getByTestId('upload-input');
    fireEvent.change(input, { target: { files: [new File(['MZ…'], 'brett.png')] } });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('brett.png');
    fireEvent.change(input, { target: { files: [new File([PNG], 'brett.png')] } });
    expect(await within(dialog).findByText('Quadratisch, passt.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    clickPageSave();
    await waitFor(() => expect(useAppearance.getState().board.kind).toBe('image'));
  });

  it('verlangt bei nicht quadratischen Bildern das Zuschneiden', async () => {
    size.width = 1200;
    render(<EinstellungenScreen />);
    clickInCard('Brett', 'Eigenen Satz hinzufügen');
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Brettbild' }));
    fireEvent.change(within(dialog).getByTestId('upload-input'), {
      target: { files: [new File([PNG], 'breit.png')] },
    });
    expect(await within(dialog).findByText(/nicht quadratisch/)).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Mittig quadratisch zuschneiden' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });
});
