import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createPieceSet, CustomSetError } from '../../appearance/customSets';
import { pieceCodeFromName } from '../../appearance/fileNames';
import { objectUrl, useAppearance } from '../../appearance/store';
import { PIECE_CODES, type PieceCode } from '../../appearance/types';
import { expandArchives, readBrowserFiles, type ReadResult } from '../../appearance/uploads';
import {
  checkImage,
  IMAGE_MIME,
  LIMITS,
  MAX_CUSTOM_SETS,
  type ImageType,
} from '../../appearance/validate';
import { Button } from '../shared/Button';
import { TextField } from '../shared/form';
import { Modal } from '../shared/Modal';
import { imageSize, sizeWarnings } from './imageInfo';
import { UploadDropArea } from './UploadDropArea';
import { FileProblems, UploadPrivacyNote, type FileProblem } from './uploadParts';

interface Candidate {
  key: number;
  name: string;
  bytes: Uint8Array;
  type: ImageType;
  url: string;
  warnings: ('notSquare' | 'small')[];
}

const ACCEPT = '.svg,.png,.webp,.zip,image/svg+xml,image/png,image/webp,application/zip';
const acceptEntry = (name: string) => /\.(svg|png|webp)$/i.test(name);

/** Dialog „Eigene Figuren“: Dateien prüfen, den 12 Plätzen zuordnen, speichern. */
export function PieceUploadDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
  const customCount = useAppearance((s) => s.custom.pieces.length);
  const [name, setName] = useState(() =>
    t('appearance.pieces.defaultName', { n: customCount + 1 }),
  );
  const [slots, setSlots] = useState<Partial<Record<PieceCode, Candidate>>>({});
  const [unassigned, setUnassigned] = useState<Candidate[]>([]);
  const [problems, setProblems] = useState<FileProblem[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<'limit' | 'failed' | null>(null);
  const slotInput = useRef<HTMLInputElement>(null);
  const slotTarget = useRef<PieceCode | null>(null);
  const urls = useRef<string[]>([]);
  const nextKey = useRef(1);
  const nameId = useId();

  useEffect(() => {
    const created = urls.current;
    return () => {
      for (const url of created) if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, []);

  /** Prüft Dateien; liefert gültige Kandidaten und sammelt Probleme */
  async function check(result: ReadResult): Promise<Candidate[]> {
    const expanded = expandArchives(result.files, acceptEntry);
    const found: FileProblem[] = [...result.errors, ...expanded.errors].map((e) => ({
      name: e.name,
      reason: e.error,
    }));
    const candidates: Candidate[] = [];
    for (const file of expanded.files) {
      const checked = checkImage(file.bytes, LIMITS.piece, ['svg', 'png', 'webp']);
      if (!checked.ok) {
        found.push({ name: file.name, reason: checked.error });
        continue;
      }
      const mime = IMAGE_MIME[checked.type];
      const warnings =
        checked.type === 'svg' ? [] : sizeWarnings(await imageSize(file.bytes, mime));
      const url = objectUrl(file.bytes, mime);
      urls.current.push(url);
      candidates.push({
        key: nextKey.current++,
        name: file.name,
        bytes: file.bytes,
        type: checked.type,
        url,
        warnings,
      });
    }
    setProblems(found);
    return candidates;
  }

  async function addFiles(result: ReadResult) {
    const candidates = await check(result);
    const nextSlots = { ...slots };
    const rest: Candidate[] = [];
    for (const candidate of candidates) {
      const code = pieceCodeFromName(candidate.name);
      if (code && !nextSlots[code]) nextSlots[code] = candidate;
      else rest.push(candidate);
    }
    setSlots(nextSlots);
    setUnassigned((current) => [...current, ...rest]);
    setSaveError(null);
  }

  function assign(code: PieceCode, candidate: Candidate) {
    const previous = slots[code];
    setSlots((current) => ({ ...current, [code]: candidate }));
    setUnassigned((current) => [
      ...current.filter((c) => c.key !== candidate.key),
      ...(previous && previous.key !== candidate.key ? [previous] : []),
    ]);
  }

  function clearSlot(code: PieceCode) {
    const previous = slots[code];
    setSlots((current) =>
      Object.fromEntries(Object.entries(current).filter(([slot]) => slot !== code)),
    );
    if (previous) setUnassigned((current) => [...current, previous]);
  }

  async function pickForSlot(files: File[]) {
    const code = slotTarget.current;
    if (!code || files.length === 0) return;
    const [candidate] = await check(await readBrowserFiles(files.slice(0, 1)));
    if (candidate) assign(code, candidate);
  }

  const filled = PIECE_CODES.filter((code) => slots[code]).length;
  const complete = filled === PIECE_CODES.length;
  const canSave = complete && name.trim().length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const pieces = Object.fromEntries(
        PIECE_CODES.map((code) => {
          const c = slots[code] as Candidate;
          return [code, { bytes: c.bytes, type: c.type }];
        }),
      ) as Record<PieceCode, { bytes: Uint8Array; type: ImageType }>;
      const id = await createPieceSet(name.trim(), pieces);
      onCreated(id);
    } catch (error) {
      setSaveError(error instanceof CustomSetError ? error.code : 'failed');
      setSaving(false);
    }
  }

  return (
    <Modal
      wide
      title={t('appearance.pieces.uploadTitle')}
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
        hint={t('appearance.pieces.formats')}
        onFiles={(result) => void addFiles(result)}
      />
      <FileProblems problems={problems} />

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-semibold">{t('appearance.pieces.slots')}</h3>
          <span role="status" className={`text-[13px] ${complete ? 'text-success' : 'text-muted'}`}>
            {complete
              ? t('appearance.pieces.complete')
              : t('appearance.pieces.missing', { count: PIECE_CODES.length - filled })}
          </span>
        </div>
        <p className="mb-2.5 text-[12.5px] text-muted">{t('appearance.pieces.slotsHint')}</p>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-2.5">
          {PIECE_CODES.map((code, index) => {
            const candidate = slots[code];
            const label = t(`appearance.pieceNames.${code}`);
            return (
              <li key={code} className="flex flex-col gap-1">
                <button
                  type="button"
                  aria-label={t('appearance.pieces.chooseFor', { piece: label })}
                  onClick={() => {
                    slotTarget.current = code;
                    slotInput.current?.click();
                  }}
                  className={`relative flex aspect-square items-center justify-center rounded-control border-2 ${
                    candidate ? 'border-border-chip' : 'border-dashed border-border-input'
                  } ${(index + Math.floor(index / 6)) % 2 === 0 ? 'bg-board-light' : 'bg-board-dark'} hover:border-accent`}
                >
                  {candidate ? (
                    <img
                      src={candidate.url}
                      alt=""
                      draggable={false}
                      className="size-[78%] object-contain"
                    />
                  ) : (
                    <span className="rounded-small bg-panel/85 px-1.5 py-0.5 font-mono text-[12px] text-muted">
                      {code}
                    </span>
                  )}
                </button>
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[12.5px] leading-tight font-medium">{label}</span>
                  {candidate && (
                    <button
                      type="button"
                      onClick={() => clearSlot(code)}
                      aria-label={t('appearance.pieces.clearSlot', { piece: label })}
                      className="min-h-6 rounded-small px-1 text-[12px] text-muted hover:text-text"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {candidate?.warnings.map((warning) => (
                  <span key={warning} className="text-[11.5px] leading-tight text-danger">
                    {t(`appearance.warnings.${warning}`)}
                  </span>
                ))}
              </li>
            );
          })}
        </ul>
        <input
          ref={slotInput}
          type="file"
          accept=".svg,.png,.webp,image/svg+xml,image/png,image/webp"
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

      {unassigned.length > 0 && (
        <div>
          <h3 className="mb-1 font-semibold">{t('appearance.pieces.unassigned')}</h3>
          <p className="mb-2 text-[12.5px] text-muted">{t('appearance.pieces.unassignedHint')}</p>
          <ul className="flex flex-col gap-2">
            {unassigned.map((candidate) => (
              <li
                key={candidate.key}
                className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-panel-sub px-3 py-2"
              >
                <img
                  src={candidate.url}
                  alt=""
                  draggable={false}
                  className="size-10 rounded-small bg-board-light object-contain"
                />
                <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
                  {candidate.name}
                </span>
                <select
                  aria-label={t('appearance.pieces.assignTo', { name: candidate.name })}
                  value=""
                  onChange={(event) => assign(event.target.value as PieceCode, candidate)}
                  className="min-h-9 rounded-control border border-border-input bg-panel px-2 text-[13px]"
                >
                  <option value="" disabled>
                    {t('appearance.pieces.assignPlaceholder')}
                  </option>
                  {PIECE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {t(`appearance.pieceNames.${code}`)}
                      {slots[code] ? ` (${t('appearance.pieces.replaces')})` : ''}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}
