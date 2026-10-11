import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isSoundEvent, SOUND_EVENTS } from '../../appearance/soundMapping';
import { BUILTIN_SOUND_SETS, DEFAULT_SOUND_SET } from '../../appearance/sounds';
import type { CustomSet } from '../../appearance/store';
import { AssetCard } from './AssetCard';
import { playSetById, playTestSequence } from './soundTest';
import { SoundUploadDialog } from './SoundUploadDialog';

const smallButton =
  'min-h-8 self-start rounded-small px-2 text-[12.5px] font-semibold text-muted hover:bg-panel-sub hover:text-text disabled:opacity-45';

/** Lautsprecher mit Schallwellen als Kachel-Vorschau */
function SoundIcon({ caption }: { caption?: string }) {
  return (
    <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-panel-sub text-accent-text">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9h4l5-4v14l-5-4H4z" />
        <path d="M16.5 8.5a5 5 0 0 1 0 7" />
        <path d="M19 6a8.5 8.5 0 0 1 0 12" />
      </svg>
      {caption && <span className="text-[11px] font-medium text-muted">{caption}</span>}
    </span>
  );
}

interface SoundsCardProps {
  value: string;
  onChange: (id: string) => void;
  /** Lautstärke 0–1 aus den Einstellungen (Entwurf); 0 = Töne aus */
  volume: number;
}

/** Karte „Töne“: Ton-Sets, eigene Sets mit einzelnen Plätzen, Anhören */
export function SoundsCard({ value, onChange, volume }: SoundsCardProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<CustomSet | null>(null);
  const muted = volume <= 0;
  const listenButton = (onClick: () => void, name: string) => (
    <button
      type="button"
      className={smallButton}
      disabled={muted}
      aria-label={t('appearance.sounds.listenSet', { name })}
      onClick={onClick}
    >
      {t('appearance.sounds.listen')}
    </button>
  );

  return (
    <>
      <AssetCard
        kind="sounds"
        id="darstellung-toene"
        title={t('appearance.sounds.title')}
        subtitle={t('appearance.sounds.subtitle')}
        defaultId={DEFAULT_SOUND_SET}
        presets={BUILTIN_SOUND_SETS.map((set) => {
          const label = set.nameKey ? t(`appearance.sounds.${set.nameKey}`) : (set.name ?? '');
          return {
            id: set.id,
            label,
            preview: <SoundIcon />,
            actions: listenButton(
              () => playTestSequence({ id: set.id, own: set.sources, fallback: null }, volume),
              label,
            ),
          };
        })}
        customPreview={(set) => (
          <SoundIcon
            caption={t('appearance.sounds.ownCount', {
              count: set.files.filter((f) => isSoundEvent(f.split('.')[0] ?? '')).length,
              total: SOUND_EVENTS.length,
            })}
          />
        )}
        customActions={(set) => (
          <div className="flex flex-wrap gap-1">
            {listenButton(() => void playSetById(set.id, volume), set.name)}
            <button
              type="button"
              className={smallButton}
              aria-label={t('appearance.sounds.editNamed', { name: set.name })}
              onClick={() => setEditing(set)}
            >
              {t('appearance.sounds.edit')}
            </button>
          </div>
        )}
        activeId={value}
        onSelect={onChange}
        dialog={(onClose, onCreated) => (
          <SoundUploadDialog onClose={onClose} onCreated={onCreated} volume={volume} />
        )}
      >
        {muted && <p className="text-[13px] text-muted">{t('appearance.sounds.mutedHint')}</p>}
      </AssetCard>
      {editing && (
        <SoundUploadDialog
          edit={editing}
          volume={volume}
          onClose={() => setEditing(null)}
          onCreated={() => setEditing(null)}
        />
      )}
    </>
  );
}
