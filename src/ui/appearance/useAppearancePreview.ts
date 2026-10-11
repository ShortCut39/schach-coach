import { useEffect, useState } from 'react';
import type { BoardLook } from '../../appearance/boards';
import type { PieceUrls } from '../../appearance/pieces';
import {
  resolveSelection,
  useAppearance,
  type ActiveSounds,
  type Appearance,
  type ResolvedSelection,
} from '../../appearance/store';
import type { AssetKind } from '../../appearance/types';

export interface AppearancePreview {
  pieces: PieceUrls;
  board: BoardLook;
  sounds: ActiveSounds;
  showCoordinates: boolean;
}

/** Aufgelöste Auswahl eines Bereichs im Entwurf; gleich der gespeicherten: deren Werte. */
function useDraftSelection<K extends AssetKind>(
  kind: K,
  id: string,
  savedId: string,
): ResolvedSelection | null {
  const [resolved, setResolved] = useState<{ id: string; selection: ResolvedSelection } | null>(
    null,
  );
  const custom = useAppearance((s) => s.custom[kind]);

  useEffect(() => {
    if (id === savedId) return;
    let cancelled = false;
    let release: (() => void) | undefined;
    void resolveSelection(kind, id).then((result) => {
      if (!result) return;
      if (cancelled) {
        result.release();
        return;
      }
      release = result.release;
      setResolved({ id, selection: result.selection });
    });
    return () => {
      cancelled = true;
      release?.();
    };
  }, [kind, id, savedId, custom]);

  return id !== savedId && resolved?.id === id ? resolved.selection : null;
}

/**
 * Vorschau des Entwurfs in den Einstellungen: zeigt die gewählten (noch nicht gespeicherten)
 * Figuren, das Brett und die Töne. Übernommen wird erst mit „Speichern“.
 */
export function useAppearancePreview(draft: Appearance): AppearancePreview {
  const saved = useAppearance();
  const pieces = useDraftSelection('pieces', draft.pieceSetId, saved.pieceSetId);
  const board = useDraftSelection('boards', draft.boardThemeId, saved.boardThemeId);
  const sounds = useDraftSelection('sounds', draft.soundSetId, saved.soundSetId);
  return {
    pieces: pieces?.kind === 'pieces' ? pieces.value : saved.pieces,
    board: board?.kind === 'boards' ? board.value : saved.board,
    sounds: sounds?.kind === 'sounds' ? sounds.value : saved.sounds,
    showCoordinates: draft.showCoordinates,
  };
}
