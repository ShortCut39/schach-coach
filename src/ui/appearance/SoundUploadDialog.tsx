import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  createSoundSet,
  CustomSetError,
  renameSet,
  updateSoundSlot,
} from '../../appearance/customSets';
import { assignSoundFiles } from '../../appearance/fileNames';
import { SOUND_EVENTS, type SoundEvent } from '../../appearance/soundMapping';
import { builtinSoundSet, DEFAULT_SOUND_SET, type SoundSources } from '../../appearance/sounds';
import { getAppearanceStorage } from '../../appearance/storage';
import { objectUrl, useAppearance, type CustomSet } from '../../appearance/store';
import { uuidOf } from '../../appearance/types';
import { expandArchives, readBrowserFiles, type ReadResult } from '../../appearance/uploads';
import { AUDIO_MIME, checkAudio, MAX_CUSTOM_SETS, type AudioType } from '../../appearance/validate';
import { playSound, probeSound } from '../../play/sound';
import { formatNumber } from '../format';
import { Button } from '../shared/Button';
import { TextField } from '../shared/form';
import { Modal } from '../shared/Modal';
import { UploadDropArea } from './UploadDropArea';
import { FileProblems, UploadPrivacyNote, type FileProblem } from './uploadParts';

interface SoundFile {
  name: string;
  bytes: Uint8Array;
  type: AudioType;
  url: string;
  durationMs: number | null;
  /** Schlüssel zum Abspielen (Rust legt den dekodierten Ton darunter ab) */
  key: string;
}

const ACCEPT =
  '.ogg,.mp3,.wav,.flac,.zip,audio/ogg,audio/mpeg,audio/wav,audio/x-wav,audio/flac,application/zip';
const acceptEntry = (name: string) => /\.(ogg|oga|mp3|wav|flac)$/i.test(name);
let previewCounter = 0;

interface SoundUploadDialogProps {
  onClose: () => void;
  onCreated: (id: string) => void;
  /** Vorhandenes eigenes Set bearbeiten statt ein neues anzulegen */
  edit?: CustomSet;
  volume: number;
}

/**
 * Dialog „Eigene Töne“: ein Platz je Ereignis. Jede Datei wird geprüft (Magic Bytes, 2 MB) und
 * probeweise dekodiert (Länge höchstens 5 s); freie Plätze nutzen das Standard-Set.
 */
export function SoundUploadDialog({ onClose, onCreated, edit, volume }: SoundUploadDialogProps) {
  const { t } = useTranslation();
  const customCount = useAppearance((s) => s.custom.sounds.length);
  const [name, setName] = useState(
    () => edit?.name || t('appearance.sounds.defaultName', { n: customCount + 1 }),
  );
  const [slots, setSlots] = useState<Partial<Record<SoundEvent, SoundFile>>>({});
  /** Plätze, die beim Bearbeiten geändert (oder geleert) wurden */
  const [changed, setChanged] = useState<Set<SoundEvent>>(new Set());
  const [problems, setProblems] = useState<FileProblem[]>([]);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<'limit' | 'failed' | null>(null);
  const slotInput = useRef<HTMLInputElement>(null);
  const slotTarget = useRef<SoundEvent | null>(null);
  const urls = useRef<string[]>([]);
  const nameId = useId();
  const fallback: SoundSources = builtinSoundSet(DEFAULT_SOUND_SET)?.sources ?? {};
  const fallbackName = builtinSoundSet(DEFAULT_SOUND_SET)?.name ?? '';

  function makeSoundFile(
    fileName: string,
    bytes: Uint8Array,
    type: AudioType,
    durationMs: number | null,
  ): SoundFile {
    const url = objectUrl(bytes, AUDIO_MIME[type]);
    urls.current.push(url);
    return { name: fileName, bytes, type, url, durationMs, key: `preview:${++previewCounter}` };
  }

  // Beim Bearbeiten die vorhandenen eigenen Töne laden
  useEffect(() => {
    const created = urls.current;
    if (edit) {
      void (async () => {
        const loaded: Partial<Record<SoundEvent, SoundFile>> = {};
        for (const file of edit.files) {
          const event = file.split('.')[0] as SoundEvent;
          if (!SOUND_EVENTS.includes(event)) continue;
          try {
            const bytes = await getAppearanceStorage().read('sounds', uuidOf(edit.id), file);
            const checked = checkAudio(bytes);
            if (checked.ok) loaded[event] = makeSoundFile(file, bytes, checked.type, null);
          } catch {
            // Datei fehlt: Platz bleibt frei
          }
        }
        setSlots(loaded);
      })();
    }
    return () => {
      for (const url of created) if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
    // Nur beim Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Prüft und dekodiert Dateien; Probleme werden gesammelt */
  async function check(result: ReadResult): Promise<SoundFile[]> {
    setChecking(true);
    const expanded = expandArchives(result.files, acceptEntry);
    const found: FileProblem[] = [...result.errors, ...expanded.errors].map((e) => ({
      name: e.name,
      reason: e.error,
    }));
    const valid: SoundFile[] = [];
    for (const file of expanded.files) {
      const checked = checkAudio(file.bytes);
      if (!checked.ok) {
        found.push({ name: file.name, reason: checked.error });
        continue;
      }
      const probe = await probeSound(file.bytes, AUDIO_MIME[checked.type]);
      if (!probe.ok) {
        found.push({ name: file.name, reason: probe.error });
        continue;
      }
      valid.push(makeSoundFile(file.name, file.bytes, checked.type, probe.durationMs));
    }
    setProblems(found);
    setChecking(false);
    return valid;
  }

  function setSlot(event: SoundEvent, file: SoundFile | null) {
    setSlots((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([slot]) => slot !== event));
      return file ? { ...next, [event]: file } : next;
    });
    setChanged((current) => new Set(current).add(event));
    setSaveError(null);
  }

  async function addFiles(result: ReadResult) {
    const valid = await check(result);
    const assigned = assignSoundFiles(valid);
    for (const event of SOUND_EVENTS) {
      const file = assigned[event];
      if (file) setSlot(event, file);
    }
    const unknown = valid.filter((file) => !Object.values(assigned).includes(file));
    if (unknown.length > 0) {
      setProblems((current) => [
        ...current,
        ...unknown.map((file) => ({ name: file.name, reason: 'unassigned' as const })),
      ]);
    }
  }

  async function pickForSlot(files: File[]) {
    const event = slotTarget.current;
    if (!event || files.length === 0) return;
    const [file] = await check(await readBrowserFiles(files.slice(0, 1)));
    if (file) setSlot(event, file);
  }

  function listen(event: SoundEvent) {
    const own = slots[event];
    if (own) {
      playSound(event, volume, {
        id: 'preview',
        own: {
          [event]: { type: 'file', key: own.key, url: own.url, bytes: async () => own.bytes },
        },
        fallback: null,
      });
    } else {
      playSound(event, volume, { id: DEFAULT_SOUND_SET, own: fallback, fallback: null });
    }
  }

  const ownCount = SOUND_EVENTS.filter((event) => slots[event]).length;
  const canSave = ownCount > 0 && name.trim().length > 0 && !saving && !checking;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (edit) {
        for (const event of changed) {
          const file = slots[event];
          await updateSoundSlot(
            edit.id,
            event,
            file ? { bytes: file.bytes, type: file.type } : null,
          );
        }
        if (name.trim() !== edit.name) await renameSet('sounds', edit.id, name.trim());
        onClose();
      } else {
        const sounds = Object.fromEntries(
          SOUND_EVENTS.flatMap((event) => {
            const file = slots[event];
            return file ? [[event, { bytes: file.bytes, type: file.type }]] : [];
          }),
        );
        onCreated(await createSoundSet(name.trim(), sounds));
      }
    } catch (error) {
      setSaveError(error instanceof CustomSetError ? error.code : 'failed');
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title={edit ? t('appearance.sounds.editTitle') : t('appearance.sounds.uploadTitle')}
      onClose={onClose}
      footer={
        <>
          {saveError && (
            <span role="alert" className="mr-auto text-[13px] font-medium text-danger">
              {t(`appearance.saveErrors.${saveError}`, { max: MAX_CUSTOM_SETS })}
            </span>
          )}
          <Button variant="secondary" className="min-h-hit" onClick={onClose}>
            {t('appearance.cancel')}
          </Button>
          <Button
            variant="primary"
            className="min-h-hit"
            disabled={!canSave}
            onClick={() => void save()}
          >
            {t('appearance.save')}
          </Button>
        </>
      }
    >
      <UploadPrivacyNote />
      <TextField
        id={nameId}
        label={t('appearance.name')}
        mono={false}
        maxLength={60}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <UploadDropArea
        accept={ACCEPT}
        hint={t('appearance.sounds.formats')}
        onFiles={(result) => void addFiles(result)}
      />
      {checking && (
        <p role="status" className="text-[13px] text-muted">
          {t('appearance.sounds.checking')}
        </p>
      )}
      <FileProblems problems={problems} />

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{t('appearance.sounds.slots')}</h3>
          <span role="status" className="text-[13px] text-muted">
            {t('appearance.sounds.ownCount', { count: ownCount, total: SOUND_EVENTS.length })}
          </span>
        </div>
        <p className="mb-2.5 text-[12.5px] text-muted">
          {t('appearance.sounds.slotsHint', { set: fallbackName })}
        </p>
        <ul className="flex flex-col divide-y divide-divider rounded-control border border-border">
          {SOUND_EVENTS.map((event) => {
            const file = slots[event];
            const label = t(`appearance.soundEvents.${event}`);
            return (
              <li key={event} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <span className="min-w-[150px] font-medium">{label}</span>
                <span className="min-w-0 flex-1 text-[12.5px]">
                  {file ? (
                    <span className="text-text">
                      <span className="mr-1.5 rounded-small bg-accent-bg px-1.5 py-px text-[11px] font-semibold text-accent-text">
                        {t('appearance.sounds.own')}
                      </span>
                      <span className="font-mono break-all">{file.name}</span>
                      {file.durationMs !== null && (
                        <span className="text-muted">
                          {' '}
                          ·{' '}
                          {t('appearance.sounds.seconds', {
                            value: formatNumber(file.durationMs / 1000),
                          })}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted">
                      {t('appearance.sounds.fromDefault', { set: fallbackName })}
                    </span>
                  )}
                </span>
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => listen(event)}
                    aria-label={t('appearance.sounds.listenTo', { event: label })}
                    className="min-h-8 rounded-small px-2 text-[12.5px] font-semibold text-muted hover:bg-panel-sub hover:text-text"
                  >
                    {t('appearance.sounds.listen')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      slotTarget.current = event;
                      slotInput.current?.click();
                    }}
                    aria-label={t('appearance.sounds.chooseFor', { event: label })}
                    className="min-h-8 rounded-small px-2 text-[12.5px] font-semibold text-muted hover:bg-panel-sub hover:text-text"
                  >
                    {t('appearance.sounds.choose')}
                  </button>
                  {file && (
                    <button
                      type="button"
                      onClick={() => setSlot(event, null)}
                      aria-label={t('appearance.sounds.clearSlot', { event: label })}
                      className="min-h-8 rounded-small px-2 text-[12.5px] font-semibold text-muted hover:bg-panel-sub hover:text-text"
                    >
                      {t('appearance.sounds.clear')}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <input
          ref={slotInput}
          type="file"
          accept={ACCEPT.replace(',.zip', '').replace(',application/zip', '')}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="slot-input"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = '';
            void pickForSlot(files);
          }}
        />
      </div>
    </Modal>
  );
}
