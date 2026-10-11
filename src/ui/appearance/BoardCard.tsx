import { useTranslation } from 'react-i18next';
import { BUILTIN_BOARD_THEMES, DEFAULT_BOARD_THEME } from '../../appearance/boards';
import { useAppearance, type CustomSet } from '../../appearance/store';
import { Toggle } from '../shared/form';
import { AssetCard } from './AssetCard';
import { BoardSwatch } from './BoardSwatch';
import { BoardUploadDialog } from './BoardUploadDialog';
import { useCustomPreview } from './useCustomPreview';

const IMAGE = ['board'] as const;

function CustomBoardPreview({ set }: { set: CustomSet }) {
  const urls = useCustomPreview(set, set.colors ? [] : IMAGE);
  if (set.colors) return <BoardSwatch look={{ kind: 'colors', ...set.colors }} />;
  return <BoardSwatch look={urls.board ? { kind: 'image', url: urls.board } : null} />;
}

/** Karte „Brett“: Farbpaare, eigene Farben oder Brettbild, Koordinaten */
export function BoardCard() {
  const { t } = useTranslation();
  const showCoordinates = useAppearance((s) => s.showCoordinates);
  const setShowCoordinates = useAppearance((s) => s.setShowCoordinates);
  return (
    <AssetCard
      kind="boards"
      id="darstellung-brett"
      title={t('appearance.boards.title')}
      subtitle={t('appearance.boards.subtitle')}
      defaultId={DEFAULT_BOARD_THEME}
      presets={BUILTIN_BOARD_THEMES.map((theme) => ({
        id: theme.id,
        label: t(`appearance.boards.${theme.nameKey}`),
        preview: <BoardSwatch look={theme.look} />,
      }))}
      customPreview={(set) => <CustomBoardPreview set={set} />}
      dialog={(onClose) => <BoardUploadDialog onClose={onClose} />}
    >
      <div className="flex min-h-hit items-center gap-3">
        <div className="flex-1">
          <div className="font-semibold">{t('appearance.boards.coordinates')}</div>
          <div className="text-[13px] text-muted">{t('appearance.boards.coordinatesHint')}</div>
        </div>
        <Toggle
          checked={showCoordinates}
          onChange={(show) => void setShowCoordinates(show)}
          label={t('appearance.boards.coordinates')}
        />
      </div>
    </AssetCard>
  );
}
