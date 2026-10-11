import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BUILTIN_PIECE_SETS, DEFAULT_PIECE_SET } from '../../appearance/pieces';
import { useAppearance, type CustomSet } from '../../appearance/store';
import { MAX_CUSTOM_SETS } from '../../appearance/validate';
import { Button } from '../shared/Button';
import { SettingsCard } from '../shared/SettingsCard';
import { CustomSetActions } from './CustomSetActions';
import { PieceUploadDialog } from './PieceUploadDialog';
import { PresetTile, TileBadge, TileGrid } from './PresetTile';
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

function CustomPieceTile({ set, active }: { set: CustomSet; active: boolean }) {
  const { t } = useTranslation();
  const select = useAppearance((s) => s.select);
  const urls = useCustomPreview(set, PREVIEW);
  const name = set.name || t('appearance.untitled');
  return (
    <PresetTile
      label={name}
      active={active}
      disabled={set.broken}
      onSelect={() => void select('pieces', set.id)}
      preview={<PiecePreview urls={urls} />}
      badge={
        set.broken ? (
          <TileBadge tone="danger">{t('appearance.broken')}</TileBadge>
        ) : (
          <TileBadge>{t('appearance.own')}</TileBadge>
        )
      }
    >
      <CustomSetActions set={set} displayName={name} />
    </PresetTile>
  );
}

/** Karte „Figuren“: Voreinstellungen, eigene Sätze, Hochladen */
export function PiecesCard() {
  const { t } = useTranslation();
  const pieceSetId = useAppearance((s) => s.pieceSetId);
  const custom = useAppearance((s) => s.custom.pieces);
  const select = useAppearance((s) => s.select);
  const reset = useAppearance((s) => s.reset);
  const [uploading, setUploading] = useState(false);
  const full = custom.length >= MAX_CUSTOM_SETS;

  return (
    <SettingsCard
      id="darstellung-figuren"
      title={t('appearance.pieces.title')}
      subtitle={t('appearance.pieces.subtitle')}
    >
      <TileGrid label={t('appearance.presets')}>
        {BUILTIN_PIECE_SETS.map((set) => (
          <PresetTile
            key={set.id}
            label={set.name}
            active={pieceSetId === set.id}
            onSelect={() => void select('pieces', set.id)}
            preview={<PiecePreview urls={set.urls} />}
            badge={
              set.id === DEFAULT_PIECE_SET ? (
                <TileBadge>{t('appearance.default')}</TileBadge>
              ) : undefined
            }
          />
        ))}
      </TileGrid>

      <div>
        <h3 className="mb-2 text-[13.5px] font-semibold">{t('appearance.customSets')}</h3>
        {custom.length === 0 ? (
          <p className="text-[13px] text-muted">{t('appearance.noCustom')}</p>
        ) : (
          <TileGrid label={t('appearance.customSets')}>
            {custom.map((set) => (
              <CustomPieceTile key={set.id} set={set} active={pieceSetId === set.id} />
            ))}
          </TileGrid>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="ghost" disabled={full} onClick={() => setUploading(true)}>
          {t('appearance.addCustom')}
        </Button>
        <Button
          variant="secondary"
          className="min-h-hit"
          disabled={pieceSetId === DEFAULT_PIECE_SET}
          onClick={() => void reset('pieces')}
        >
          {t('appearance.reset')}
        </Button>
        {full && (
          <span className="text-[12.5px] text-muted">
            {t('appearance.saveErrors.limit', { max: MAX_CUSTOM_SETS })}
          </span>
        )}
      </div>
      {uploading && <PieceUploadDialog onClose={() => setUploading(false)} />}
    </SettingsCard>
  );
}
