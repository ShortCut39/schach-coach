import { fireEvent, render, screen, within } from '@testing-library/react';
import { THIRD_PARTY_ASSETS } from '../../appearance/thirdParty';
import { LicensesCard } from './LicensesCard';

describe('Lizenzen und Quellen', () => {
  it('zeigt jeden mitgelieferten Satz mit Autor, Lizenz und Quelle', () => {
    render(<LicensesCard />);
    fireEvent.click(screen.getByText('Mitgelieferte Figuren und Töne anzeigen'));
    for (const asset of THIRD_PARTY_ASSETS) {
      const row = screen.getByText(asset.name, { selector: 'td:first-child' }).closest('tr');
      expect(row).not.toBeNull();
      const cells = Array.from((row as HTMLElement).querySelectorAll('td')).map(
        (td) => td.textContent,
      );
      expect(cells.slice(1, 3)).toEqual([asset.author, asset.license]);
      expect(within(row as HTMLElement).getByTitle(asset.source)).toBeInTheDocument();
    }
    expect(screen.getByText(/Standardtöne von Lichess sind nicht frei/)).toBeInTheDocument();
  });

  it('lädt Lizenztexte beim Aufklappen', async () => {
    render(<LicensesCard />);
    const summary = screen.getByText('Lizenztext GPL-2.0.txt');
    const details = summary.closest('details') as HTMLDetailsElement;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(await within(details).findByText(/GNU GENERAL PUBLIC LICENSE/)).toBeInTheDocument();
  });
});
