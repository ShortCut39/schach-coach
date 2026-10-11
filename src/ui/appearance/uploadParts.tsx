import { useTranslation } from 'react-i18next';
import { IconAlert } from '../shared/icons';

/** Warum eine Datei abgelehnt wurde (Einlesen, Inhaltsprüfung, Dekodieren) */
export type FileReason =
  | 'tooLarge'
  | 'empty'
  | 'type'
  | 'svgUnsafe'
  | 'unreadable'
  | 'broken'
  | 'tooManyFiles'
  | 'unsupported'
  | 'tooLong';

export interface FileProblem {
  name: string;
  reason: FileReason;
}

/** Hinweis in jedem Upload-Dialog */
export function UploadPrivacyNote() {
  const { t } = useTranslation();
  return (
    <p className="rounded-control border border-info-border bg-info-bg px-3 py-2 text-[13px] text-info-text">
      {t('appearance.upload.privacy')}
    </p>
  );
}

/** Liste abgelehnter Dateien mit verständlichem Grund */
export function FileProblems({ problems }: { problems: FileProblem[] }) {
  const { t } = useTranslation();
  if (problems.length === 0) return null;
  return (
    <ul role="alert" className="flex flex-col gap-1.5">
      {problems.map((problem, index) => (
        <li key={`${problem.name}-${index}`} className="flex items-start gap-2 text-[13px]">
          <span className="mt-0.5 shrink-0 text-danger">
            <IconAlert />
          </span>
          <span>
            <span className="font-mono font-medium break-all">{problem.name}</span>:{' '}
            {t(`appearance.reasons.${problem.reason}`)}
          </span>
        </li>
      ))}
    </ul>
  );
}
