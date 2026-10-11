import { render, screen } from '@testing-library/react';
import { resetAppearanceForTests, useAppearance } from '../../appearance/store';
import { PlayerCard } from './PlayerCard';

beforeEach(() => resetAppearanceForTests());

describe('Geschlagene Figuren neben dem Namen', () => {
  it('zeigt die geschlagenen Figuren des Gegners und den Materialvorteil', () => {
    render(
      <PlayerCard
        color="w"
        player={{ name: 'nils' }}
        isMe
        clock={null}
        toMove={false}
        captured={['p', 'p', 'n', 'q']}
        advantage={11}
      />,
    );
    const material = screen.getByRole('img', {
      name: 'Geschlagen: 2 Bauern, 1 Springer und 1 Dame, Materialvorteil +11',
    });
    const images = material.querySelectorAll('img');
    expect(images).toHaveLength(4);
    // Schwarze Figuren aus dem gewählten Figurensatz
    expect(images[0]?.getAttribute('src')).toBe(useAppearance.getState().pieces.bP);
    expect(images[3]?.getAttribute('src')).toBe(useAppearance.getState().pieces.bQ);
    expect(material).toHaveTextContent('+11');
  });

  it('zeigt bei Nachteil nur die Figuren, ohne Schlagzüge nichts', () => {
    const { rerender } = render(
      <PlayerCard
        color="b"
        player={{ name: 'gegner' }}
        isMe={false}
        clock={null}
        toMove
        captured={['p']}
        advantage={-2}
      />,
    );
    const material = screen.getByRole('img', { name: 'Geschlagen: 1 Bauer' });
    expect(material).not.toHaveTextContent('+');
    expect(material.querySelector('img')?.getAttribute('src')).toBe(
      useAppearance.getState().pieces.wP,
    );
    rerender(<PlayerCard color="b" player={{ name: 'gegner' }} isMe={false} clock={null} toMove />);
    expect(screen.queryByRole('img', { name: /Geschlagen/ })).not.toBeInTheDocument();
  });
});
