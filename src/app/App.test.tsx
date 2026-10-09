import { fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '../i18n';
import { useNavigation } from '../store/navigation';
import { App } from './App';

describe('App-Shell', () => {
  const missing: string[] = [];
  const onMissing = (_lngs: readonly string[], _ns: string, key: string) => missing.push(key);

  beforeEach(() => {
    useNavigation.setState({ screen: 'analyse' });
    missing.length = 0;
    i18n.options.saveMissing = true;
    i18n.on('missingKey', onMissing);
  });
  afterEach(() => i18n.off('missingKey', onMissing));

  it('zeigt die vier Navigationspunkte, Analyse ist aktiv', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const buttons = within(nav).getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Analyse',
      'Import',
      'Bibliothek',
      'Einstellungen',
    ]);
    expect(within(nav).getByRole('button', { name: 'Analyse' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('wechselt zwischen allen Screens ohne fehlende Übersetzungen', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    const expected: Record<string, string> = {
      Import: 'Neue Partie analysieren',
      Bibliothek: 'Bibliothek',
      Einstellungen: 'Einstellungen',
      Analyse: 'Analyse',
    };
    for (const [button, heading] of Object.entries(expected)) {
      fireEvent.click(within(nav).getByRole('button', { name: button }));
      expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    }
    expect(missing).toEqual([]);
  });

  it('zeigt den echten Engine-Namen, sobald sie bereit ist, und keine erfundene KI', async () => {
    render(<App />);
    expect(await screen.findByText('Test-Engine · Tiefe 20')).toBeInTheDocument();
    expect(screen.getByText('KI nicht eingerichtet')).toBeInTheDocument();
  });
});
