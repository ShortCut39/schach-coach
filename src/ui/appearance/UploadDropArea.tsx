import { useEffect, useEffectEvent, useId, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { readBrowserFiles, readDroppedPaths, type ReadResult } from '../../appearance/uploads';
import { Button } from '../shared/Button';
import { IconUpload } from '../shared/icons';

interface UploadDropAreaProps {
  /** `accept` für den Datei-Dialog, z. B. `.svg,.png,.webp,.zip` */
  accept: string;
  multiple?: boolean;
  /** Hinweis zu Formaten und Grenzen */
  hint: string;
  onFiles: (result: ReadResult) => void;
}

/**
 * Ablagefläche für eigene Dateien: Datei-Dialog, HTML5-Drop (Browser) und in der Desktop-App
 * Tauris Drop-Ereignis (WebKitGTK liefert beim HTML5-Drop keine Inhalte; Rust liest die Pfade).
 */
export function UploadDropArea({ accept, multiple = true, hint, onFiles }: UploadDropAreaProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [htmlActive, setHtmlActive] = useState(false);
  const [nativeActive, setNativeActive] = useState(false);
  const titleId = useId();
  const deliver = useEffectEvent(onFiles);
  const active = htmlActive || nativeActive;

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent(async (event) => {
        const payload = event.payload;
        if (payload.type === 'enter' || payload.type === 'over') setNativeActive(true);
        else if (payload.type === 'leave') setNativeActive(false);
        else {
          setNativeActive(false);
          const paths = multiple ? payload.paths : payload.paths.slice(0, 1);
          if (paths.length > 0) deliver(await readDroppedPaths(paths));
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [multiple]);

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    setHtmlActive(false);
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) onFiles(await readBrowserFiles(multiple ? files : files.slice(0, 1)));
  }

  return (
    <section
      aria-labelledby={titleId}
      onDragOver={(event) => {
        event.preventDefault();
        setHtmlActive(true);
      }}
      onDragLeave={() => setHtmlActive(false)}
      onDrop={(event) => void handleDrop(event)}
      className={`flex flex-col items-center gap-2 rounded-panel border border-dashed px-5 py-5 text-center transition-colors ${
        active ? 'border-accent bg-accent-bg' : 'border-border-accent bg-panel-sub'
      }`}
    >
      <IconUpload width={26} height={26} className="text-accent-text" />
      <h3 id={titleId} className="font-semibold">
        {active ? t('appearance.upload.release') : t('appearance.upload.drop')}
      </h3>
      <Button variant="ghost" onClick={() => inputRef.current?.click()}>
        {t('appearance.upload.choose')}
      </Button>
      <p className="max-w-[520px] text-[12.5px] text-muted">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        data-testid="upload-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = ''; // dieselbe Datei erneut wählbar
          if (files.length > 0) void readBrowserFiles(files).then(onFiles);
        }}
      />
    </section>
  );
}
