import { useTranslation } from 'react-i18next';
import type { Appearance } from '../../appearance/store';
import { BoardView } from '../analyse/BoardView';
import { boardAppearanceOptions } from '../boardAppearance';
import { SettingsCard } from '../shared/SettingsCard';
import { BoardCard } from './BoardCard';
import { PiecesCard } from './PiecesCard';
import { PREVIEW_FEN, PREVIEW_LAST_MOVE } from './preview';
import { useAppearancePreview } from './useAppearancePreview';

interface AppearanceSectionProps {
  /** Entwurf der Auswahl; übernommen wird mit „Speichern“ unten auf der Seite */
  draft: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
}

/** Bereich „Darstellung“ in den Einstellungen: die Vorschau zeigt den Entwurf sofort. */
export function AppearanceSection({ draft, onChange }: AppearanceSectionProps) {
  const { t } = useTranslation();
  const preview = useAppearancePreview(draft);
  return (
    <>
      <SettingsCard
        id="darstellung"
        title={t('einstellungen.sections.darstellung')}
        subtitle={t('appearance.subtitle')}
      >
        <div className="flex flex-wrap items-start gap-5">
          <div className="w-[min(280px,100%)] shrink-0">
            <BoardView
              fen={PREVIEW_FEN}
              orientation="white"
              lastMove={PREVIEW_LAST_MOVE}
              id="appearance-preview"
              label={t('appearance.preview.label')}
              appearance={boardAppearanceOptions(
                preview.pieces,
                preview.board,
                preview.showCoordinates,
              )}
            />
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-2 text-[13.5px] text-body">
            <p>{t('appearance.preview.text')}</p>
          </div>
        </div>
      </SettingsCard>
      <PiecesCard
        value={draft.pieceSetId}
        onChange={(pieceSetId) => onChange({ pieceSetId })}
        board={preview.board}
      />
      <BoardCard
        value={draft.boardThemeId}
        onChange={(boardThemeId) => onChange({ boardThemeId })}
        showCoordinates={draft.showCoordinates}
        onShowCoordinates={(showCoordinates) => onChange({ showCoordinates })}
      />
    </>
  );
}
