import { useTranslation } from 'react-i18next';
import type { Appearance } from '../../appearance/store';
import { BoardView } from '../analyse/BoardView';
import { boardAppearanceOptions } from '../boardAppearance';
import { SettingsCard } from '../shared/SettingsCard';
import { BoardCard } from './BoardCard';
import { PiecesCard } from './PiecesCard';
import { PREVIEW_FEN, PREVIEW_LAST_MOVE } from './preview';
import { playTestSequence } from './soundTest';
import { SoundsCard } from './SoundsCard';
import type { AppearancePreview } from './useAppearancePreview';
import { Button } from '../shared/Button';

interface AppearanceSectionProps {
  /** Entwurf der Auswahl; übernommen wird mit „Speichern“ unten auf der Seite */
  draft: Appearance;
  onChange: (patch: Partial<Appearance>) => void;
  /** Aufgelöster Entwurf (`useAppearancePreview`) */
  preview: AppearancePreview;
  /** Lautstärke 0–1 aus dem Einstellungs-Entwurf; 0 = Töne aus */
  volume: number;
}

/** Bereich „Darstellung“ in den Einstellungen: die Vorschau zeigt den Entwurf sofort. */
export function AppearanceSection({ draft, onChange, preview, volume }: AppearanceSectionProps) {
  const { t } = useTranslation();
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
            <Button
              variant="ghost"
              className="self-start"
              disabled={volume <= 0}
              onClick={() => playTestSequence(preview.sounds, volume)}
            >
              {t('appearance.sounds.test')}
            </Button>
            <p className="text-[12.5px] text-muted">
              {volume <= 0 ? t('appearance.sounds.mutedHint') : t('appearance.sounds.testHint')}
            </p>
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
      <SoundsCard
        value={draft.soundSetId}
        onChange={(soundSetId) => onChange({ soundSetId })}
        volume={volume}
      />
    </>
  );
}
