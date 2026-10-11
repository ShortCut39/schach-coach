import { useTranslation } from 'react-i18next';
import { BUILTIN_PIECE_SETS, DEFAULT_PIECE_SET } from '../../appearance/pieces';
import { useAppearance, type CustomSet } from '../../appearance/store';
import { AssetCard } from './AssetCard';
import { PieceUploadDialog } from './PieceUploadDialog';
import { useCustomPreview } from './useCustomPreview';

const PREVIEW = ['wK', 'bQ', 'wN'] as const;

/** Drei Figuren auf den Feldfarben des aktiven Bretts (bei einem Brettbild: App-Standard) */
function PiecePreview({ urls }: { urls: Partial<Record<string, string>> }) {
  const board = useAppearance((s) => s.board);
  const colors =
    board.kind === 'colors'
      ? board
      : { light: 'var(--sc-board-light)', dark: 'var(--sc-board-dark)' };
  return (
    <span className="flex h-full w-full">
      {PREVIEW.map((code, index) => (
        <span
          key={code}
          className="flex flex-1 items-center justify-center"
          style={{ background: index % 2 === 0 ? colors.light : colors.dark }}
        >
          {urls[code] && (
            <img
              src={urls[code]}
              alt=""
              draggable={false}
              className="size-[88%] max-h-11 object-contain"
            />
          )}
        </span>
      ))}
    </span>
  );
}

function CustomPiecePreview({ set }: { set: CustomSet }) {
  return <PiecePreview urls={useCustomPreview(set, PREVIEW)} />;
}

/** Karte „Figuren“ */
export function PiecesCard() {
  const { t } = useTranslation();
  return (
    <AssetCard
      kind="pieces"
      id="darstellung-figuren"
      title={t('appearance.pieces.title')}
      subtitle={t('appearance.pieces.subtitle')}
      defaultId={DEFAULT_PIECE_SET}
      presets={BUILTIN_PIECE_SETS.map((set) => ({
        id: set.id,
        label: set.name,
        preview: <PiecePreview urls={set.urls} />,
      }))}
      customPreview={(set) => <CustomPiecePreview set={set} />}
      dialog={(onClose) => <PieceUploadDialog onClose={onClose} />}
    />
  );
}
