import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Fußzeile mit Knöpfen */
  footer?: ReactNode;
  wide?: boolean;
}

/**
 * Dialog über der Seite (natives `<dialog>`: Fokus bleibt im Dialog, Escape schließt).
 * Ohne `showModal` (z. B. jsdom) wird er einfach offen angezeigt.
 */
export function Modal({ title, onClose, children, footer, wide = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (typeof dialog.showModal === 'function' && !dialog.open) dialog.showModal();
    else dialog.setAttribute('open', '');
    return () => {
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={`m-auto max-h-[calc(100dvh-48px)] w-[calc(100vw-32px)] ${wide ? 'max-w-[860px]' : 'max-w-[560px]'} overflow-hidden rounded-panel border border-border bg-panel p-0 text-text shadow-board backdrop:bg-black/55`}
    >
      <div className="flex max-h-[calc(100dvh-48px)] flex-col">
        <h2
          id={titleId}
          className="border-b border-divider px-5 pt-[18px] pb-3 text-base font-bold"
        >
          {title}
        </h2>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {children}
        </div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-divider px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
