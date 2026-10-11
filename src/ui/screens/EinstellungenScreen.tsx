import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { currentLocale, supportedLanguages } from '../../i18n';
import { testConnection } from '../../llm/client';
import { getFetch } from '../../llm/http';
import { LLM_PRESETS, type LlmPresetId } from '../../llm/presets';
import { LlmError } from '../../llm/types';
import { useAnalysis } from '../../store/analysis';
import { useApiKey } from '../../store/apiKey';
import { autoPoolSize, restartEngines, useEngine } from '../../store/engine';
import { playSound } from '../../play/sound';
import { formatNumber } from '../format';
import { getSecretStorage } from '../../store/persistence';
import {
  DEFAULT_THRESHOLDS,
  pickSettings,
  settingsSchema,
  useSettings,
  type Settings,
} from '../../store/settings';
import { CategoryIcon } from '../shared/CategoryIcon';
import { Button } from '../shared/Button';
import { FieldLabel } from '../shared/FieldLabel';
import { SelectField, TextField, Toggle, inputClass } from '../shared/form';
import { IconAlert, IconCheck } from '../shared/icons';
import { Segmented } from '../shared/Segmented';
import { SettingsCard } from '../shared/SettingsCard';
import { LichessCard } from '../play/LichessCard';
import {
  effectiveDraft,
  pickAppearance,
  useAppearance,
  type Appearance,
} from '../../appearance/store';
import { AppearanceSection } from '../appearance/AppearanceSection';

const sections = [
  'ki',
  'engine',
  'analyse',
  'training',
  'spielen',
  'lichess',
  'oberflaeche',
  'darstellung',
] as const;
type Section = (typeof sections)[number];

type TestState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; ms: number }
  | { kind: 'error'; message: string };

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function EinstellungenScreen() {
  const { t } = useTranslation();
  const saved = useSettings();
  const keyringAvailable = useApiKey((s) => s.keyringAvailable);
  const saveKey = useApiKey((s) => s.saveFor);
  const loadKey = useApiKey((s) => s.loadFor);

  const [draft, setDraft] = useState<Settings>(() => pickSettings(saved));
  const [keyDraft, setKeyDraft] = useState(() => useApiKey.getState().key);
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<TestState>({ kind: 'idle' });
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [active, setActive] = useState<Section>('ki');
  // Darstellung: Entwurf wie die übrigen Einstellungen, übernommen erst mit „Speichern“
  const appearanceLoaded = useAppearance((s) => s.loaded);
  const customSets = useAppearance((s) => s.custom);
  const [appearanceDraft, setAppearanceDraft] = useState<Appearance>(() =>
    pickAppearance(useAppearance.getState()),
  );
  const [appearanceTouched, setAppearanceTouched] = useState(false);
  const [appearanceSynced, setAppearanceSynced] = useState(appearanceLoaded);
  // Darstellung erst nach dem Öffnen geladen: Entwurf nachziehen, solange nichts geändert wurde
  if (appearanceLoaded && !appearanceSynced) {
    setAppearanceSynced(true);
    if (!appearanceTouched) setAppearanceDraft(pickAppearance(useAppearance.getState()));
  }
  const appearanceEffective = effectiveDraft(appearanceDraft, customSets);
  const engineState = useEngine();
  const autoThreads = autoPoolSize();
  const keyOrigin = useRef(originOf(draft.llm.baseUrl));
  const ids = {
    baseUrl: useId(),
    key: useId(),
    model: useId(),
    depth: useId(),
    multiPv: useId(),
    threads: useId(),
    engineKind: useId(),
    scope: useId(),
    notation: useId(),
    language: useId(),
    t1: useId(),
    t2: useId(),
    t3: useId(),
    volume: useId(),
  };

  const update = (patch: Partial<Settings>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaveState('idle');
  };
  const updateAppearance = (patch: Partial<Appearance>) => {
    setAppearanceDraft((d) => ({ ...d, ...patch }));
    setAppearanceTouched(true);
    setSaveState('idle');
  };
  const keyRequest = useRef(0);

  /**
   * Der Key gehört zu einem Endpunkt: Wechselt der Origin der Base-URL, wird der dort gespeicherte
   * Key geladen (oder keiner). So landet ein Key nie bei einem anderen Server.
   */
  function updateLlm(patch: Partial<Settings['llm']>) {
    const next = { ...draft.llm, ...patch };
    update({ llm: next });
    const origin = originOf(next.baseUrl);
    if (origin === keyOrigin.current) return;
    keyOrigin.current = origin;
    setTest({ kind: 'idle' });
    const request = ++keyRequest.current;
    setKeyDraft('');
    if (!origin) return;
    void getSecretStorage()
      .get(next.baseUrl)
      .catch(() => null)
      .then((key) => {
        if (request === keyRequest.current) setKeyDraft(key ?? '');
      });
  }
  const updateThreshold = (key: keyof Settings['thresholds'], value: string) =>
    update({ thresholds: { ...draft.thresholds, [key]: Number(value) } });

  const urlValid =
    originOf(draft.llm.baseUrl) !== null && /^https?:/.test(draft.llm.baseUrl.trim());
  const thresholdsValid =
    draft.thresholds.inaccuracy > 0 &&
    draft.thresholds.inaccuracy < draft.thresholds.mistake &&
    draft.thresholds.mistake < draft.thresholds.blunder &&
    draft.thresholds.blunder <= 60;
  const trainingValid = Object.values(draft.training).some(Boolean);
  const canSave = thresholdsValid && trainingValid && (urlValid || draft.llm.baseUrl.trim() === '');

  async function runTest() {
    if (!urlValid || !draft.llm.model.trim()) {
      setTest({ kind: 'error', message: t('einstellungen.ki.testNeedsModel') });
      return;
    }
    setTest({ kind: 'running' });
    try {
      const ms = await testConnection(
        { baseUrl: draft.llm.baseUrl, apiKey: keyDraft, model: draft.llm.model },
        getFetch(),
      );
      setTest({ kind: 'ok', ms });
    } catch (error) {
      const code = error instanceof LlmError ? error.code : 'badResponse';
      setTest({ kind: 'error', message: t(`llmErrors.${code}`) });
    }
  }

  async function save() {
    try {
      const valid = settingsSchema.parse(draft);
      const engineChanged = valid.engine !== saved.engine || valid.threads !== saved.threads;
      await saved.save(valid);
      // Neue Engine-Art oder Threads: Pool neu starten (laufende Analyse vorher abbrechen)
      if (engineChanged) {
        useAnalysis.getState().cancel();
        void restartEngines();
      }
      if (urlValid) await saveKey(valid.llm.baseUrl, keyDraft);
      setAppearanceDraft(await useAppearance.getState().saveAll(appearanceEffective));
      setAppearanceTouched(false);
      setSaveState('saved');
    } catch {
      setSaveState('failed');
    }
  }

  async function discard() {
    const current = pickSettings(useSettings.getState());
    keyOrigin.current = originOf(current.llm.baseUrl);
    setDraft(current);
    setAppearanceDraft(pickAppearance(useAppearance.getState()));
    setAppearanceTouched(false);
    setKeyDraft(await loadKey(current.llm.baseUrl));
    setTest({ kind: 'idle' });
    setSaveState('idle');
  }

  function choosePreset(id: LlmPresetId) {
    const preset = LLM_PRESETS.find((p) => p.id === id);
    updateLlm({ preset: id, ...(preset && preset.baseUrl ? { baseUrl: preset.baseUrl } : {}) });
  }

  function jumpTo(section: Section) {
    setActive(section);
    document
      .getElementById(`settings-${section}`)
      ?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  const multiPvOptions = [1, 2, 3, 4, 5];

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-[1240px] flex-wrap items-start gap-6 px-5 pt-7 pb-10"
    >
      <nav
        aria-label={t('einstellungen.sectionsLabel')}
        className="sticky top-5 flex flex-[0_0_220px] flex-col gap-0.5"
      >
        <h1 className="mb-3 text-[26px] font-bold tracking-[-0.01em]">
          {t('einstellungen.title')}
        </h1>
        {sections.map((id) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              type="button"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => jumpTo(id)}
              className={`min-h-hit rounded-small px-3.5 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-accent-bg font-semibold text-accent-text'
                  : 'font-medium text-muted hover:text-text'
              }`}
            >
              {t(`einstellungen.sections.${id}`)}
            </button>
          );
        })}
      </nav>

      <div className="flex min-w-0 flex-[1_1_640px] flex-col gap-[18px]">
        <SettingsCard
          id="ki"
          title={t('einstellungen.sections.ki')}
          subtitle={t('einstellungen.ki.subtitle')}
        >
          <div
            role="group"
            aria-label={t('einstellungen.ki.presetsLabel')}
            className="flex flex-wrap gap-2"
          >
            {LLM_PRESETS.map((preset) => {
              const isActive = draft.llm.preset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => choosePreset(preset.id)}
                  className={`min-h-10 rounded-full border px-3.5 text-[13px] ${
                    isActive
                      ? 'border-border-accent bg-accent-bg font-semibold text-accent-text'
                      : 'border-border-chip font-medium text-line-text hover:text-text'
                  }`}
                >
                  {t(`einstellungen.ki.presets.${preset.id}`)}
                </button>
              );
            })}
          </div>
          <TextField
            id={ids.baseUrl}
            label={t('einstellungen.ki.baseUrl')}
            value={draft.llm.baseUrl}
            onChange={(e) => updateLlm({ baseUrl: e.target.value, preset: 'custom' })}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={draft.llm.baseUrl.trim() !== '' && !urlValid}
            hint={
              draft.llm.baseUrl.trim() !== '' && !urlValid ? (
                <span className="text-danger">{t('llmErrors.invalidUrl')}</span>
              ) : undefined
            }
          />
          <TextField
            id={ids.key}
            label={t('einstellungen.ki.apiKey')}
            type={showKey ? 'text' : 'password'}
            value={keyDraft}
            onChange={(e) => {
              setKeyDraft(e.target.value);
              setSaveState('idle');
            }}
            placeholder={t('einstellungen.ki.apiKeyPlaceholder')}
            spellCheck={false}
            autoComplete="off"
            aside={
              <Button
                variant="secondary"
                className="min-h-[46px] shrink-0 px-4 text-[13.5px]"
                onClick={() => setShowKey((v) => !v)}
              >
                {showKey ? t('einstellungen.ki.hide') : t('einstellungen.ki.show')}
              </Button>
            }
            hint={
              keyringAvailable === false
                ? t('einstellungen.ki.keyringMissing')
                : t('einstellungen.ki.keyringNote')
            }
          />
          <TextField
            id={ids.model}
            label={t('einstellungen.ki.model')}
            value={draft.llm.model}
            onChange={(e) => updateLlm({ model: e.target.value })}
            placeholder={t('einstellungen.ki.modelPlaceholder')}
            spellCheck={false}
            autoComplete="off"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              className="min-h-[46px] px-[22px] text-sm"
              onClick={() => void runTest()}
              disabled={test.kind === 'running'}
            >
              {test.kind === 'running' ? t('einstellungen.ki.testing') : t('einstellungen.ki.test')}
            </Button>
            <span role="status" className="text-[13.5px] font-medium">
              {test.kind === 'ok' && (
                <span className="inline-flex items-center gap-2 text-success">
                  <IconCheck />
                  {t('einstellungen.ki.testOk', {
                    seconds: new Intl.NumberFormat(currentLocale(), {
                      maximumFractionDigits: 1,
                    }).format(test.ms / 1000),
                  })}
                </span>
              )}
              {test.kind === 'error' && (
                <span className="inline-flex items-center gap-2 text-danger">
                  <IconAlert />
                  {test.message}
                </span>
              )}
            </span>
          </div>
        </SettingsCard>

        <SettingsCard
          id="engine"
          title={t('einstellungen.sections.engine')}
          subtitle={t('einstellungen.engine.subtitle')}
        >
          <SelectField
            id={ids.engineKind}
            label={t('einstellungen.engine.kind')}
            value={draft.engine}
            onChange={(e) => update({ engine: e.target.value as Settings['engine'] })}
            hint={
              engineState.nativeUnavailable
                ? t('einstellungen.engine.nativeMissing')
                : engineState.name
                  ? t('einstellungen.engine.running', { name: engineState.name })
                  : undefined
            }
          >
            <option value="native">{t('einstellungen.engine.kindNative')}</option>
            <option value="wasm">{t('einstellungen.engine.kindWasm')}</option>
          </SelectField>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <FieldLabel htmlFor={ids.depth}>{t('einstellungen.engine.depth')}</FieldLabel>
              <span className="font-mono text-[13px] font-semibold text-accent-text">
                {draft.engineDepth}
              </span>
            </div>
            <input
              id={ids.depth}
              type="range"
              min={10}
              max={30}
              value={draft.engineDepth}
              onChange={(e) => update({ engineDepth: Number(e.target.value) })}
              className="min-h-7 w-full accent-accent"
            />
            <div className="flex justify-between text-xs text-faint">
              <span>{t('einstellungen.engine.fast')}</span>
              <span>{t('einstellungen.engine.thorough')}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <SelectField
              id={ids.multiPv}
              label={t('einstellungen.engine.multiPv')}
              className="flex-[1_1_180px]"
              value={draft.multiPv}
              onChange={(e) => update({ multiPv: Number(e.target.value) })}
            >
              {multiPvOptions.map((n) => (
                <option key={n} value={n}>
                  {n === 3
                    ? t('einstellungen.engine.multiPvStandard', { count: n })
                    : t('einstellungen.engine.multiPvOption', { count: n })}
                </option>
              ))}
            </SelectField>
            <SelectField
              id={ids.threads}
              label={t('einstellungen.engine.threads')}
              className="flex-[1_1_180px]"
              value={draft.threads}
              onChange={(e) => update({ threads: Number(e.target.value) })}
            >
              <option value={0}>
                {t('einstellungen.engine.threadsAuto', { count: autoThreads })}
              </option>
              {[1, 2, 4, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {t('einstellungen.engine.threadsOption', { count: n })}
                </option>
              ))}
            </SelectField>
          </div>
        </SettingsCard>

        <SettingsCard
          id="analyse"
          title={t('einstellungen.sections.analyse')}
          subtitle={t('einstellungen.analyse.subtitle')}
        >
          <div>
            <FieldLabel>{t('einstellungen.analyse.level')}</FieldLabel>
            <Segmented
              label={t('einstellungen.analyse.level')}
              value={draft.level}
              onChange={(level) => update({ level })}
              options={(['beginner', 'intermediate', 'club'] as const).map((value) => ({
                value,
                label: t(`einstellungen.analyse.levels.${value}`),
              }))}
            />
          </div>
          <SelectField
            id={ids.scope}
            label={t('einstellungen.analyse.scope')}
            value={draft.explainScope}
            onChange={(e) => update({ explainScope: e.target.value as Settings['explainScope'] })}
          >
            {(['errorsAndMyGood', 'errorsOnly', 'all'] as const).map((scope) => (
              <option key={scope} value={scope}>
                {t(`explainScope.${scope}`)}
              </option>
            ))}
          </SelectField>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <FieldLabel>{t('einstellungen.analyse.thresholds')}</FieldLabel>
              <Button
                variant="secondary"
                className="min-h-9 px-3 text-[12.5px] font-medium text-line-text"
                onClick={() => update({ thresholds: DEFAULT_THRESHOLDS })}
              >
                {t('einstellungen.analyse.reset')}
              </Button>
            </div>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ['inaccuracy', ids.t1],
                  ['mistake', ids.t2],
                  ['blunder', ids.t3],
                ] as const
              ).map(([key, id]) => (
                <div key={key} className="flex-[1_1_150px]">
                  <label htmlFor={id} className="mb-1 flex items-center gap-2 text-[13px]">
                    <CategoryIcon category={key} size={14} decorative />
                    {t(`einstellungen.analyse.${key}`)}
                  </label>
                  <div className="relative">
                    <input
                      id={id}
                      type="number"
                      min={1}
                      max={60}
                      value={draft.thresholds[key]}
                      onChange={(e) => updateThreshold(key, e.target.value)}
                      aria-invalid={!thresholdsValid}
                      className={`${inputClass} pr-8 font-mono text-sm`}
                    />
                    <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 font-mono text-sm text-muted">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {!thresholdsValid && (
              <p role="alert" className="mt-1.5 text-[12.5px] text-danger">
                {t('einstellungen.analyse.thresholdsInvalid')}
              </p>
            )}
            <p className="mt-1.5 text-[12.5px] text-muted">
              {t('einstellungen.analyse.automatic')}
            </p>
          </div>
        </SettingsCard>

        <SettingsCard
          id="training"
          title={t('einstellungen.sections.training')}
          subtitle={t('einstellungen.training.subtitle')}
        >
          <div
            role="group"
            aria-label={t('einstellungen.training.sources')}
            className="flex flex-col gap-1"
          >
            {(
              [
                ['blunders', ['blunder', 'mistake']],
                ['missed', ['miss']],
                ['inaccuracies', ['inaccuracy']],
              ] as const
            ).map(([key, categories]) => (
              <div key={key} className="flex min-h-hit items-center gap-3">
                <span className="flex gap-1" aria-hidden="true">
                  {categories.map((category) => (
                    <CategoryIcon key={category} category={category} size={16} decorative />
                  ))}
                </span>
                <div className="flex-1">
                  <div className="font-semibold">{t(`einstellungen.training.${key}`)}</div>
                  <div className="text-[13px] text-muted">
                    {t(`einstellungen.training.${key}Hint`)}
                  </div>
                </div>
                <Toggle
                  checked={draft.training[key]}
                  onChange={(value) => update({ training: { ...draft.training, [key]: value } })}
                  label={t(`einstellungen.training.${key}`)}
                />
              </div>
            ))}
          </div>
          {!trainingValid && (
            <p role="alert" className="text-[12.5px] text-danger">
              {t('einstellungen.training.noneSelected')}
            </p>
          )}
        </SettingsCard>

        <SettingsCard
          id="spielen"
          title={t('einstellungen.sections.spielen')}
          subtitle={t('einstellungen.spielen.subtitle')}
        >
          <div className="flex min-h-hit items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold">{t('einstellungen.spielen.sounds')}</div>
              <div className="text-[13px] text-muted">{t('einstellungen.spielen.soundsHint')}</div>
            </div>
            <Toggle
              checked={draft.play.sounds}
              onChange={(sounds) => update({ play: { ...draft.play, sounds } })}
              label={t('einstellungen.spielen.sounds')}
            />
          </div>
          <div className="flex min-h-hit items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold">{t('einstellungen.spielen.autoAnalyse')}</div>
              <div className="text-[13px] text-muted">
                {t('einstellungen.spielen.autoAnalyseHint')}
              </div>
            </div>
            <Toggle
              checked={draft.play.autoAnalyse}
              onChange={(autoAnalyse) => update({ play: { ...draft.play, autoAnalyse } })}
              label={t('einstellungen.spielen.autoAnalyse')}
            />
          </div>
          <div className="flex min-h-hit items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold">{t('einstellungen.spielen.chat')}</div>
              <div className="text-[13px] text-muted">{t('einstellungen.spielen.chatHint')}</div>
            </div>
            <Toggle
              checked={draft.play.lichessChat}
              onChange={(lichessChat) => update({ play: { ...draft.play, lichessChat } })}
              label={t('einstellungen.spielen.chat')}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor={ids.volume} className="min-w-[110px] font-semibold">
              {t('einstellungen.spielen.volume')}
            </label>
            <input
              id={ids.volume}
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft.play.volume}
              disabled={!draft.play.sounds}
              onChange={(e) => update({ play: { ...draft.play, volume: Number(e.target.value) } })}
              className="min-w-[160px] flex-1 accent-accent disabled:opacity-45"
            />
            <span className="w-12 text-right font-mono text-[13px] text-muted">
              {formatNumber(draft.play.volume / 100, {
                style: 'percent',
                maximumFractionDigits: 0,
              })}
            </span>
            <Button
              variant="ghost"
              disabled={!draft.play.sounds}
              onClick={() => playSound('move', draft.play.volume / 100)}
            >
              {t('einstellungen.spielen.testSound')}
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard
          id="lichess"
          title={t('einstellungen.sections.lichess')}
          subtitle={t('lichess.subtitle')}
        >
          <LichessCard />
        </SettingsCard>

        <SettingsCard id="oberflaeche" title={t('einstellungen.sections.oberflaeche')}>
          <div className="flex flex-wrap gap-x-7 gap-y-4">
            <div>
              <FieldLabel>{t('einstellungen.darstellung.scheme')}</FieldLabel>
              <Segmented
                label={t('einstellungen.darstellung.scheme')}
                value={draft.colorScheme}
                onChange={(colorScheme) => update({ colorScheme })}
                options={[
                  { value: 'dark', label: t('einstellungen.darstellung.dark') },
                  { value: 'light', label: t('einstellungen.darstellung.light') },
                ]}
              />
            </div>
            <SelectField
              id={ids.notation}
              label={t('einstellungen.darstellung.notation')}
              className="flex-[1_1_220px]"
              value={draft.notation}
              onChange={(e) => update({ notation: e.target.value as Settings['notation'] })}
            >
              <option value="de">{t('einstellungen.darstellung.notationDe')}</option>
              <option value="en">{t('einstellungen.darstellung.notationEn')}</option>
            </SelectField>
          </div>
          <div className="flex min-h-hit items-center gap-3">
            <div className="flex-1">
              <div className="font-semibold">{t('einstellungen.darstellung.arrows')}</div>
              <div className="text-[13px] text-muted">
                {t('einstellungen.darstellung.arrowsHint')}
              </div>
            </div>
            <Toggle
              checked={draft.showArrows}
              onChange={(showArrows) => update({ showArrows })}
              label={t('einstellungen.darstellung.arrows')}
            />
          </div>
          <SelectField
            id={ids.language}
            label={t('einstellungen.darstellung.language')}
            className="max-w-[360px]"
            value={draft.language}
            // Die Notation wechselt mit (D/T/L/S ↔ Q/R/B/N), bleibt danach aber frei einstellbar
            onChange={(e) => {
              const language = e.target.value as Settings['language'];
              update({ language, notation: language });
            }}
            hint={t('einstellungen.darstellung.languageHint')}
          >
            {supportedLanguages.map((language) => (
              <option key={language} value={language} lang={language}>
                {t(`einstellungen.darstellung.languages.${language}`)}
              </option>
            ))}
          </SelectField>
        </SettingsCard>

        <AppearanceSection draft={appearanceEffective} onChange={updateAppearance} />

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <span role="status" className="mr-auto text-[13.5px] font-medium">
            {saveState === 'saved' && (
              <span className="text-success">{t('einstellungen.saved')}</span>
            )}
            {saveState === 'failed' && (
              <span className="text-danger">{t('einstellungen.saveFailed')}</span>
            )}
          </span>
          <Button
            variant="secondary"
            className="min-h-[46px] text-sm"
            onClick={() => void discard()}
          >
            {t('einstellungen.discard')}
          </Button>
          <Button
            variant="primary"
            className="min-h-[46px] px-6 text-sm"
            onClick={() => void save()}
            disabled={!canSave}
          >
            {t('einstellungen.save')}
          </Button>
        </div>
      </div>
    </main>
  );
}
