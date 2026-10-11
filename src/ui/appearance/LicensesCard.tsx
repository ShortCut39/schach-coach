import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { THIRD_PARTY_ASSETS, type ThirdPartyAsset } from '../../appearance/thirdParty';
import { SettingsCard } from '../shared/SettingsCard';

/** Lizenztexte aus `assets/licenses/` (erst beim Aufklappen geladen) */
const licenseTexts = import.meta.glob<string>('../../../assets/licenses/*.txt', {
  query: '?raw',
  import: 'default',
});

function openSource(url: string): void {
  if (isTauri()) void invoke('appearance_open_source', { url }).catch(() => undefined);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

function LicenseText({ file }: { file: string }) {
  const { t } = useTranslation();
  const [text, setText] = useState<string | null>(null);
  const load = licenseTexts[`../../../assets/licenses/${file}`];
  return (
    <details
      className="text-[12.5px]"
      onToggle={(event) => {
        if ((event.target as HTMLDetailsElement).open && text === null && load) {
          void load().then(setText);
        }
      }}
    >
      <summary className="cursor-pointer font-semibold text-accent-text">
        {t('appearance.licenses.showText', { file })}
      </summary>
      <pre className="mt-2 max-h-[320px] overflow-auto rounded-control border border-border bg-panel-sub p-3 font-mono text-[11.5px] whitespace-pre-wrap">
        {text ?? t('appearance.licenses.loading')}
      </pre>
    </details>
  );
}

function AssetTable({ title, assets }: { title: string; assets: readonly ThirdPartyAsset[] }) {
  const { t } = useTranslation();
  return (
    <div>
      <h3 className="mb-2 text-[13.5px] font-semibold">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed text-left text-[13px]">
          <thead className="text-[11.5px] tracking-wide text-muted uppercase">
            <tr>
              <th className="w-[16%] py-1.5 pr-3 font-semibold">{t('appearance.licenses.set')}</th>
              <th className="w-[27%] py-1.5 pr-3 font-semibold">
                {t('appearance.licenses.author')}
              </th>
              <th className="w-[14%] py-1.5 pr-3 font-semibold">
                {t('appearance.licenses.license')}
              </th>
              <th className="py-1.5 font-semibold">{t('appearance.licenses.source')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td className="py-1.5 pr-3 font-medium">{asset.name}</td>
                <td className="py-1.5 pr-3">{asset.author}</td>
                <td className="py-1.5 pr-3">{asset.license}</td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() => openSource(asset.source)}
                    title={asset.source}
                    className="min-h-8 text-left font-mono text-[12px] break-all text-accent-text underline-offset-2 hover:underline"
                  >
                    {asset.source.replace('https://github.com/', '')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** „Lizenzen und Quellen“ der mitgelieferten Sätze (dieselbe Liste wie THIRD_PARTY_ASSETS.md) */
export function LicensesCard() {
  const { t } = useTranslation();
  // Alle Dateien aus assets/licenses (auch der Copyright-Hinweis von Chessnut)
  const files = Object.keys(licenseTexts)
    .map((path) => path.split('/').pop() ?? path)
    .sort();
  return (
    <SettingsCard id="darstellung-lizenzen" title={t('appearance.licenses.title')}>
      <details className="flex flex-col gap-4">
        <summary className="cursor-pointer text-[13.5px] font-semibold text-accent-text">
          {t('appearance.licenses.toggle')}
        </summary>
        <div className="mt-3 flex flex-col gap-5">
          <p className="text-[13px] text-body">{t('appearance.licenses.intro')}</p>
          <AssetTable
            title={t('appearance.pieces.title')}
            assets={THIRD_PARTY_ASSETS.filter((asset) => asset.kind === 'pieces')}
          />
          <AssetTable
            title={t('appearance.sounds.title')}
            assets={THIRD_PARTY_ASSETS.filter((asset) => asset.kind === 'sounds')}
          />
          <ul className="flex flex-col gap-1.5 text-[13px] text-body">
            <li>{t('appearance.licenses.synth')}</li>
            <li>{t('appearance.licenses.notIncluded')}</li>
            <li>{t('appearance.licenses.own')}</li>
          </ul>
          <div className="flex flex-col gap-2">
            {files.map((file) => (
              <LicenseText key={file} file={file} />
            ))}
          </div>
        </div>
      </details>
    </SettingsCard>
  );
}
