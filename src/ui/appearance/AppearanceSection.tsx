import { useTranslation } from 'react-i18next';
import { BoardView } from '../analyse/BoardView';
import { SettingsCard } from '../shared/SettingsCard';
import { PiecesCard } from './PiecesCard';
import { PREVIEW_FEN, PREVIEW_LAST_MOVE } from './preview';

/** Bereich „Darstellung“ in den Einstellungen: wirkt sofort, ohne „Speichern“. */
export function AppearanceSection() {
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
            />
          </div>
          <div className="flex min-w-[220px] flex-1 flex-col gap-2 text-[13.5px] text-body">
            <p>{t('appearance.preview.text')}</p>
          </div>
        </div>
      </SettingsCard>
      <PiecesCard />
    </>
  );
}
