import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { IconFirst, IconFlip, IconLast, IconNext, IconPrev } from '../shared/icons';

interface BoardControlsProps {
  canBack: boolean;
  canForward: boolean;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onFlip: () => void;
}

function ControlButton(props: {
  label: string;
  shortcut: string;
  keys: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={`${props.label} (${props.shortcut})`}
      aria-keyshortcuts={props.keys}
      disabled={props.disabled}
      onClick={props.onClick}
      className="flex size-hit items-center justify-center rounded-control border border-border-chip bg-panel text-control-text transition enabled:hover:border-border-input enabled:hover:text-text disabled:opacity-40"
    >
      {props.children}
    </button>
  );
}

export function BoardControls(props: BoardControlsProps) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('analyse.controls.label')} className="flex gap-1.5">
      <ControlButton
        label={t('analyse.controls.first')}
        shortcut="Pos1"
        keys="Home"
        disabled={!props.canBack}
        onClick={props.onFirst}
      >
        <IconFirst />
      </ControlButton>
      <ControlButton
        label={t('analyse.controls.prev')}
        shortcut="←"
        keys="ArrowLeft"
        disabled={!props.canBack}
        onClick={props.onPrev}
      >
        <IconPrev />
      </ControlButton>
      <ControlButton
        label={t('analyse.controls.next')}
        shortcut="→"
        keys="ArrowRight"
        disabled={!props.canForward}
        onClick={props.onNext}
      >
        <IconNext />
      </ControlButton>
      <ControlButton
        label={t('analyse.controls.last')}
        shortcut="Ende"
        keys="End"
        disabled={!props.canForward}
        onClick={props.onLast}
      >
        <IconLast />
      </ControlButton>
      <ControlButton
        label={t('analyse.controls.flip')}
        shortcut="F"
        keys="F"
        onClick={props.onFlip}
      >
        <IconFlip />
      </ControlButton>
    </div>
  );
}
