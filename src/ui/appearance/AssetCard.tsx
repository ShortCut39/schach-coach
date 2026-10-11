import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppearance, type CustomSet } from '../../appearance/store';
import type { AssetKind } from '../../appearance/types';
import { MAX_CUSTOM_SETS } from '../../appearance/validate';
import { Button } from '../shared/Button';
import { SettingsCard } from '../shared/SettingsCard';
import { CustomSetActions } from './CustomSetActions';
import { PresetTile, TileBadge, TileGrid } from './PresetTile';

export interface PresetEntry {
  id: string;
  label: string;
  preview: ReactNode;
  /** Knöpfe unter der Kachel, z. B. „Anhören“ */
  actions?: ReactNode;
}

interface AssetCardProps {
  kind: AssetKind;
  id: string;
  title: string;
  subtitle: string;
  presets: readonly PresetEntry[];
  defaultId: string;
  /** Vorschau eines eigenen Satzes (darf Dateien nachladen) */
  customPreview: (set: CustomSet) => ReactNode;
  /** Upload-Dialog; `onClose` schließt ihn, `onCreated` wählt den neuen Satz im Entwurf */
  dialog: (onClose: () => void, onCreated: (id: string) => void) => ReactNode;
  /** Gewählter Satz im Entwurf (gespeichert wird erst mit „Speichern“) */
  activeId: string;
  onSelect: (id: string) => void;
  /** Zusätzliche Knöpfe unter eigenen Sätzen (z. B. „Bearbeiten“, „Anhören“) */
  customActions?: (set: CustomSet) => ReactNode;
  /** Zusätzliche Einstellungen der Karte (z. B. Koordinaten) */
  children?: ReactNode;
}

/**
 * Gemeinsames Gerüst der Karten „Figuren“, „Brett“ und „Töne“: Raster der Voreinstellungen,
 * eigene Sätze (umbenennen, löschen), „Eigenen Satz hinzufügen“ und „Zurücksetzen“.
 * Ein Klick wählt im Entwurf (die Vorschau zeigt ihn); übernommen wird mit „Speichern“.
 * Hochladen, Umbenennen und Löschen ändern die Dateien dagegen sofort.
 */
export function AssetCard({
  kind,
  id,
  title,
  subtitle,
  presets,
  defaultId,
  customPreview,
  dialog,
  activeId,
  onSelect,
  customActions,
  children,
}: AssetCardProps) {
  const { t } = useTranslation();
  const custom = useAppearance((s) => s.custom[kind]);
  const [adding, setAdding] = useState(false);
  const full = custom.length >= MAX_CUSTOM_SETS;

  return (
    <SettingsCard id={id} title={title} subtitle={subtitle}>
      <TileGrid label={t('appearance.presets')}>
        {presets.map((preset) => (
          <PresetTile
            key={preset.id}
            label={preset.label}
            active={activeId === preset.id}
            onSelect={() => onSelect(preset.id)}
            preview={preset.preview}
            badge={
              preset.id === defaultId ? <TileBadge>{t('appearance.default')}</TileBadge> : undefined
            }
          >
            {preset.actions}
          </PresetTile>
        ))}
      </TileGrid>

      <div>
        <h3 className="mb-2 text-[13.5px] font-semibold">{t('appearance.customSets')}</h3>
        {custom.length === 0 ? (
          <p className="text-[13px] text-muted">{t('appearance.noCustom')}</p>
        ) : (
          <TileGrid label={t('appearance.customSets')}>
            {custom.map((set) => {
              const name = set.name || t('appearance.untitled');
              return (
                <PresetTile
                  key={set.id}
                  label={name}
                  active={activeId === set.id}
                  disabled={set.broken}
                  onSelect={() => onSelect(set.id)}
                  preview={customPreview(set)}
                  badge={
                    set.broken ? (
                      <TileBadge tone="danger">{t('appearance.broken')}</TileBadge>
                    ) : (
                      <TileBadge>{t('appearance.own')}</TileBadge>
                    )
                  }
                >
                  {!set.broken && customActions?.(set)}
                  <CustomSetActions set={set} displayName={name} />
                </PresetTile>
              );
            })}
          </TileGrid>
        )}
      </div>

      {children}

      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="ghost" disabled={full} onClick={() => setAdding(true)}>
          {t('appearance.addCustom')}
        </Button>
        <Button
          variant="secondary"
          className="min-h-hit"
          disabled={activeId === defaultId}
          onClick={() => onSelect(defaultId)}
        >
          {t('appearance.reset')}
        </Button>
        {full && (
          <span className="text-[12.5px] text-muted">
            {t('appearance.saveErrors.limit', { max: MAX_CUSTOM_SETS })}
          </span>
        )}
      </div>
      {adding &&
        dialog(
          () => setAdding(false),
          (created) => {
            setAdding(false);
            onSelect(created);
          },
        )}
    </SettingsCard>
  );
}
