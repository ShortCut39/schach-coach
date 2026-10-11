import { fireEvent, screen, within } from '@testing-library/react';

/** Karte in den Einstellungen nach ihrem Titel (z. B. „Figuren“) */
export function settingsCard(title: string): HTMLElement {
  return screen.getByRole('region', { name: title });
}

/** „Speichern“ ganz unten auf der Einstellungsseite (außerhalb von Dialogen und Karten) */
export function clickPageSave(): void {
  const buttons = screen
    .getAllByRole('button', { name: 'Speichern' })
    .filter((button) => !button.closest('dialog') && !button.closest('section'));
  const last = buttons.at(-1);
  if (!last) throw new Error('Speichern-Knopf fehlt');
  fireEvent.click(last);
}

export function clickInCard(title: string, name: string, pressed?: boolean): void {
  fireEvent.click(
    within(settingsCard(title)).getByRole('button', {
      name,
      ...(pressed === undefined ? {} : { pressed }),
    }),
  );
}
