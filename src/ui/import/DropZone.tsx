import { useId, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../shared/Button';
import { IconUpload } from '../shared/icons';

interface DropZoneProps {
  onFile: (file: File) => void;
}

/** Ablagefläche für PGN-Dateien mit zusätzlichem Datei-Auswahl-Knopf. */
export function DropZone({ onFile }: DropZoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const titleId = useId();

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setActive(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <section
      aria-labelledby={titleId}
      onDragOver={(event) => {
        event.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center gap-2 rounded-panel border border-dashed px-5 py-[26px] text-center transition-colors ${
        active ? 'border-accent bg-accent-bg' : 'border-border-accent bg-panel'
      }`}
    >
      <IconUpload width={30} height={30} className="text-accent-text" />
      <h2 id={titleId} className="font-semibold">
        {active ? t('import.drop.release') : t('import.drop.title')}
      </h2>
      <div className="text-[13px] text-muted">{t('import.drop.or')}</div>
      <Button variant="ghost" onClick={() => inputRef.current?.click()}>
        {t('import.drop.choose')}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".pgn,.txt,.fen,text/plain,application/x-chess-pgn"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = ''; // dieselbe Datei erneut wählbar
        }}
      />
    </section>
  );
}
