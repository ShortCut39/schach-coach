import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isHexColor, lowContrast } from '../../appearance/boards';
import { createColorBoard, createImageBoard, CustomSetError } from '../../appearance/customSets';
import { objectUrl, useAppearance } from '../../appearance/store';
import { expandArchives, type ReadResult } from '../../appearance/uploads';
import {
  checkImage,
  IMAGE_MIME,
  LIMITS,
  MAX_CUSTOM_SETS,
  type ImageType,
} from '../../appearance/validate';
import { Button } from '../shared/Button';
import { FieldLabel } from '../shared/FieldLabel';
import { TextField } from '../shared/form';
import { Modal } from '../shared/Modal';
import { Segmented } from '../shared/Segmented';
import { cropToSquare, imageSize, type ImageSize } from './imageInfo';
import { UploadDropArea } from './UploadDropArea';
import { FileProblems, UploadPrivacyNote, type FileProblem } from './uploadParts';

interface BoardImage {
  bytes: Uint8Array;
  type: ImageType;
  url: string;
  size: ImageSize | null;
}

const ACCEPT = '.png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml';

function isSquare(size: ImageSize | null): boolean {
  return !size || Math.abs(size.width - size.height) <= Math.max(1, size.width * 0.02);
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  const [shown, setShown] = useState(value);
  // Farbwähler geändert: Textfeld nachziehen
  if (value !== shown) {
    setShown(value);
    setText(value);
  }
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer rounded-control border border-border-input bg-panel p-0.5"
        />
        <input
          id={id}
          value={text}
          maxLength={7}
          spellCheck={false}
          onChange={(event) => {
            const next = event.target.value.trim();
            setText(next);
            const hex = next.startsWith('#') ? next : `#${next}`;
            if (isHexColor(hex)) onChange(hex.toLowerCase());
          }}
          className="min-h-10 w-[110px] rounded-control border border-border-input bg-panel px-2.5 font-mono text-sm"
        />
      </div>
    </div>
  );
}

/** Dialog „Eigenes Brett“: zwei Farben oder ein Brettbild (8 × 8, über die Felder gelegt). */
export function BoardUploadDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const customCount = useAppearance((s) => s.custom.boards.length);
  const select = useAppearance((s) => s.select);
  const [mode, setMode] = useState<'colors' | 'image'>('colors');
  const [name, setName] = useState(() =>
    t('appearance.boards.defaultName', { n: customCount + 1 }),
  );
  const [light, setLight] = useState('#eeeed2');
  const [dark, setDark] = useState('#769656');
  const [image, setImage] = useState<BoardImage | null>(null);
  const [problems, setProblems] = useState<FileProblem[]>([]);
  const [cropFailed, setCropFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<'limit' | 'failed' | null>(null);
  const urls = useRef<string[]>([]);
  const nameId = useId();

  useEffect(() => {
    const created = urls.current;
    return () => {
      for (const url of created) if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, []);

  async function showImage(bytes: Uint8Array, type: ImageType) {
    const mime = IMAGE_MIME[type];
    const url = objectUrl(bytes, mime);
    urls.current.push(url);
    setImage({ bytes, type, url, size: await imageSize(bytes, mime) });
  }

  async function addFiles(result: ReadResult) {
    const expanded = expandArchives(result.files, () => false);
    const found: FileProblem[] = [...result.errors, ...expanded.errors].map((e) => ({
      name: e.name,
      reason: e.error,
    }));
    const [file] = expanded.files;
    setCropFailed(false);
    if (file) {
      const checked = checkImage(file.bytes, LIMITS.board, ['png', 'jpg', 'webp', 'svg']);
      if (checked.ok) await showImage(file.bytes, checked.type);
      else found.push({ name: file.name, reason: checked.error });
    }
    setProblems(found);
  }

  async function crop() {
    if (!image) return;
    const cropped = await cropToSquare(image.bytes, IMAGE_MIME[image.type], LIMITS.board);
    if (cropped) await showImage(cropped.bytes, cropped.type);
    else setCropFailed(true);
  }

  const contrastLow = lowContrast(light, dark);
  const square = isSquare(image?.size ?? null);
  const ready = mode === 'colors' ? isHexColor(light) && isHexColor(dark) : !!image && square;
  const canSave = ready && name.trim().length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const id =
        mode === 'colors'
          ? await createColorBoard(name.trim(), light, dark)
          : await createImageBoard(name.trim(), {
              bytes: (image as BoardImage).bytes,
              type: (image as BoardImage).type,
            });
      await select('boards', id);
      onClose();
    } catch (error) {
      setSaveError(error instanceof CustomSetError ? error.code : 'failed');
      setSaving(false);
    }
  }

  return (
    <Modal
      title={t('appearance.boards.uploadTitle')}
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
      <TextField
        id={nameId}
        label={t('appearance.name')}
        mono={false}
        maxLength={60}
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Segmented
        label={t('appearance.boards.kind')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'colors', label: t('appearance.boards.kindColors') },
          { value: 'image', label: t('appearance.boards.kindImage') },
        ]}
      />

      {mode === 'colors' ? (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex flex-col gap-3">
            <ColorField label={t('appearance.boards.light')} value={light} onChange={setLight} />
            <ColorField label={t('appearance.boards.dark')} value={dark} onChange={setDark} />
          </div>
          <div
            aria-hidden="true"
            className="grid size-[160px] shrink-0 grid-cols-8 overflow-hidden rounded-small shadow-board"
          >
            {Array.from({ length: 64 }, (_, i) => (
              <span
                key={i}
                style={{ background: (i + Math.floor(i / 8)) % 2 === 0 ? light : dark }}
              />
            ))}
          </div>
          {contrastLow && (
            <p role="status" className="basis-full text-[13px] font-medium text-danger">
              {t('appearance.boards.lowContrast')}
            </p>
          )}
        </div>
      ) : (
        <>
          <UploadPrivacyNote />
          <UploadDropArea
            accept={ACCEPT}
            multiple={false}
            hint={t('appearance.boards.formats')}
            onFiles={(result) => void addFiles(result)}
          />
          <FileProblems problems={problems} />
          {image && (
            <div className="flex flex-wrap items-start gap-4">
              <div
                role="img"
                aria-label={t('appearance.boards.imagePreview')}
                className="size-[180px] shrink-0 overflow-hidden rounded-small shadow-board"
                style={{
                  backgroundImage: `url("${image.url}")`,
                  backgroundSize: '100% 100%',
                }}
              />
              <div className="flex min-w-[200px] flex-1 flex-col gap-2 text-[13px]">
                {image.size && (
                  <span className="text-muted">
                    {t('appearance.boards.imageSize', {
                      width: image.size.width,
                      height: image.size.height,
                    })}
                  </span>
                )}
                {square ? (
                  <span className="text-success">{t('appearance.boards.imageOk')}</span>
                ) : (
                  <>
                    <span role="status" className="font-medium text-danger">
                      {t('appearance.boards.notSquare')}
                    </span>
                    <Button variant="ghost" className="self-start" onClick={() => void crop()}>
                      {t('appearance.boards.crop')}
                    </Button>
                    {cropFailed && (
                      <span className="text-danger">{t('appearance.boards.cropFailed')}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
