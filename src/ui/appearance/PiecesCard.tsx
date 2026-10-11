import { useTranslation } from 'react-i18next';
import { BUILTIN_PIECE_SETS, DEFAULT_PIECE_SET } from '../../appearance/pieces';
import type { BoardLook } from '../../appearance/boards';
import type { CustomSet } from '../../appearance/store';
import { AssetCard } from './AssetCard';
import { PieceUploadDialog } from './PieceUploadDialog';
import { useCustomPreview } from './useCustomPreview';

const PREVIEW = ['wK', 'bQ', 'wN'] as const;

/** Drei Figuren auf den Feldfarben des aktiven Bretts (bei einem Brettbild: App-Standard) */
function PiecePreview({
  urls,
  board,
}: {
  urls: Partial<Record<string, string>>;
  board: BoardLook;
}) {
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

function CustomPiecePreview({ set, board }: { set: CustomSet; board: BoardLook }) {
  return <PiecePreview urls={useCustomPreview(set, PREVIEW)} board={board} />;
}

/** Karte „Figuren“ */
export function PiecesCard({
  value,
  onChange,
  board,
}: {
  value: string;
  onChange: (id: string) => void;
  /** Brett der Vorschau (Entwurf), damit die Kacheln dazu passen */
  board: BoardLook;
}) {
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
        preview: <PiecePreview urls={set.urls} board={board} />,
      }))}
      customPreview={(set) => <CustomPiecePreview set={set} board={board} />}
      activeId={value}
      onSelect={onChange}
      dialog={(onClose, onCreated) => <PieceUploadDialog onClose={onClose} onCreated={onCreated} />}
    />
  );
}
