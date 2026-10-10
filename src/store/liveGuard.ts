import { create } from 'zustand';
import { liveGuardState, onLiveGuardChange, type LiveGuardState } from '../play/liveGuard';

/** Die Fair-Play-Sperre für die Oberfläche (nur Anzeige; durchgesetzt wird sie in play/liveGuard.ts). */
export const useLiveGuard = create<LiveGuardState>()(() => liveGuardState());

onLiveGuardChange((state) => useLiveGuard.setState(state, true));
