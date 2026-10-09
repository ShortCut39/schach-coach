import { useTranslation } from 'react-i18next';

export function VersionBadge({ version }: { version: number }) {
  const { t } = useTranslation();
  return (
    <span className="rounded-full border border-border-accent px-2.5 py-0.5 font-mono text-[11.5px] font-semibold whitespace-nowrap">
      {t('common.version', { version })}
    </span>
  );
}
