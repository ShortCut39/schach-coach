import { useDeferredValue, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { decodeText } from '../../chess/decode';
import { detectInput } from '../../chess/detect';
import { useGame } from '../../store/game';
import { useImportDraft } from '../../store/importDraft';
import { useLiveGuard } from '../../store/liveGuard';
import { useNavigation } from '../../store/navigation';
import type { ExplainScope } from '../../llm/selection';
import { analyseAndExplain } from '../../store/pipeline';
import { useSettings } from '../../store/settings';
import { summarizePgn } from '../../chess/pgn';
import { colorOfUser } from '../../online/fetchGames';
import { DropZone } from '../import/DropZone';
import { OnlineImport } from '../import/OnlineImport';
import { ProgressCard } from '../import/ProgressCard';
import { GameList } from '../import/GameList';
import { ValidationMessage } from '../import/ValidationMessage';
import { evaluateImport, loadableSource, type InputTab } from '../import/evaluate';
import { useNativeFileDrop, type FileReadError } from '../import/nativeFileDrop';
import { Button } from '../shared/Button';
import { FieldLabel } from '../shared/FieldLabel';
import { PageHeader } from '../shared/PageHeader';
import { Segmented } from '../shared/Segmented';
import { IconAlert, IconFile } from '../shared/icons';

export function ImportScreen() {
  const { t } = useTranslation();
  const loadGame = useGame((s) => s.load);
  const setScreen = useNavigation((s) => s.setScreen);
  const live = useLiveGuard((s) => s.active);

  const { tab, pgnText, fenText, selected, userColor, fileName, update } = useImportDraft();
  const settingsDepth = useSettings((s) => s.engineDepth);
  const settingsScope = useSettings((s) => s.explainScope);
  const depth = useImportDraft((s) => s.depth) ?? settingsDepth;
  const explainScope = useImportDraft((s) => s.explainScope) ?? settingsScope;
  const resetDraft = useImportDraft((s) => s.reset);
  const [fileError, setFileError] = useState<FileReadError>();
  const texts: Record<InputTab, string> = { pgn: pgnText, fen: fenText };

  const inputTab: InputTab = tab === 'fen' ? 'fen' : 'pgn';
  const deferredText = useDeferredValue(texts[inputTab]);
  const evaluation = useMemo(
    () => evaluateImport(inputTab, deferredText, selected),
    [inputTab, deferredText, selected],
  );
  const source = loadableSource(evaluation);
  const games = evaluation.kind === 'pgn' ? evaluation.games : [];

  const textareaId = useId();
  const statusId = useId();
  const depthId = useId();
  const scopeId = useId();

  const textKey = { pgn: 'pgnText', fen: 'fenText' } as const;

  function switchTab(target: InputTab) {
    // Text in den passenden Tab mitnehmen
    update({ [textKey[inputTab]]: '', [textKey[target]]: texts[inputTab], tab: target });
  }

  function loadFileContent(name: string, bytes: ArrayBuffer) {
    const content = decodeText(bytes);
    const target: InputTab = detectInput(content) === 'fen' ? 'fen' : 'pgn';
    update({
      [textKey[target]]: content,
      selected: 0,
      fileName: name,
      tab: target,
      onlineUser: null,
    });
    setFileError(undefined);
  }

  /** Datei aus dem Auswahldialog oder einem HTML5-Drop (Browser-Modus) */
  async function handleFile(file: File) {
    try {
      loadFileContent(file.name, await file.arrayBuffer());
    } catch {
      setFileError('unreadable');
    }
  }

  /** In der Desktop-App: Datei irgendwo auf dem Import-Screen abgelegt */
  const nativeDropActive = useNativeFileDrop((result) => {
    if (result.ok) loadFileContent(result.name, result.bytes);
    else setFileError(result.error);
  });

  /** Farbe des Nutzers in Partie `index` erkennen (nur nach Online-Import mit Benutzername) */
  function userColorIn(text: string, index: number, username: string | null) {
    if (!username) return undefined;
    const game = summarizePgn(text)[index];
    return game ? colorOfUser(game.headers, username) : undefined;
  }

  function loadOnline(pgn: string, label: string, username: string) {
    const color = userColorIn(pgn, 0, username);
    update({
      pgnText: pgn,
      tab: 'pgn',
      selected: 0,
      fileName: label,
      onlineUser: username,
      ...(color ? { userColor: color } : {}),
    });
    setFileError(undefined);
  }

  function selectGame(index: number) {
    const color = userColorIn(pgnText, index, useImportDraft.getState().onlineUser);
    update({ selected: index, ...(color ? { userColor: color } : {}) });
  }

  function reset() {
    resetDraft();
    setFileError(undefined);
  }

  function analyse() {
    if (!source) return;
    loadGame(source, userColor);
    void analyseAndExplain(source, depth, explainScope);
    setScreen('analyse');
  }

  const tabOptions = [
    { value: 'pgn', label: t('import.tabs.pgn') },
    { value: 'fen', label: t('import.tabs.fen') },
    { value: 'datei', label: t('import.tabs.datei') },
  ] as const;
  const depthOptions = [
    { value: 14, label: t('import.depth.fast', { depth: 14 }) },
    { value: 20, label: t('import.depth.standard', { depth: 20 }) },
    { value: 26, label: t('import.depth.thorough', { depth: 26 }) },
  ];
  if (!depthOptions.some((o) => o.value === settingsDepth)) {
    depthOptions.push({
      value: settingsDepth,
      label: t('import.depth.setting', { depth: settingsDepth }),
    });
    depthOptions.sort((a, b) => a.value - b.value);
  }
  const colorOptions = [
    { value: 'w', label: t('common.white') },
    { value: 'b', label: t('common.black') },
  ] as const;

  return (
    <main id="main" className="mx-auto flex w-full max-w-[1280px] flex-col gap-5 px-5 pt-7 pb-10">
      <PageHeader title={t('import.title')} subtitle={t('import.subtitle')} />

      <div className="flex flex-wrap items-start gap-5">
        <section
          aria-label={t('import.inputLabel')}
          className="flex min-w-0 flex-[1.5_1_560px] flex-col gap-4 rounded-panel border border-border bg-panel px-5 pt-[18px] pb-5"
        >
          <Segmented
            variant="tabs"
            label={t('import.tabsLabel')}
            options={tabOptions}
            value={tab}
            onChange={(value) => update({ tab: value })}
            idPrefix="import-tab"
          />

          {tab === 'datei' ? (
            <div role="tabpanel" aria-labelledby="import-tab-datei" className="flex flex-col gap-4">
              <p className="text-body">{t('import.fileTabText')}</p>
              <DropZone onFile={handleFile} active={nativeDropActive} />
            </div>
          ) : (
            <div role="tabpanel" aria-labelledby={`import-tab-${tab}`}>
              <div className="flex items-baseline justify-between gap-3">
                <FieldLabel htmlFor={textareaId}>
                  {tab === 'pgn' ? t('import.pgnLabel') : t('import.fenLabel')}
                </FieldLabel>
                {fileName && (
                  <span className="mb-1.5 inline-flex min-w-0 items-center gap-1.5 font-mono text-[11.5px] text-muted">
                    <IconFile />
                    <span className="truncate">{t('import.fileLoaded', { name: fileName })}</span>
                  </span>
                )}
              </div>
              <textarea
                id={textareaId}
                value={texts[tab]}
                onChange={(event) => update({ [textKey[tab]]: event.target.value, selected: 0 })}
                rows={tab === 'pgn' ? 11 : 3}
                spellCheck={false}
                autoComplete="off"
                placeholder={
                  tab === 'pgn' ? t('import.pgnPlaceholder') : t('import.fenPlaceholder')
                }
                aria-describedby={statusId}
                aria-invalid={
                  (evaluation.kind === 'pgn' || evaluation.kind === 'fen') && !evaluation.result.ok
                }
                className="w-full resize-y rounded-control border border-border-input bg-bg p-3.5 font-mono text-[13px] leading-[1.7] text-body placeholder:text-faint"
              />
              <ValidationMessage id={statusId} evaluation={evaluation} onSwitchTab={switchTab} />
            </div>
          )}

          {fileError && (
            <p role="alert" className="flex items-center gap-2 text-[13px] font-medium text-danger">
              <IconAlert />
              {t(`import.errors.file.${fileError}`)}
            </p>
          )}

          <div className="flex flex-wrap gap-x-7 gap-y-4">
            <div>
              <FieldLabel id="user-color-label">{t('import.userColor')}</FieldLabel>
              <Segmented
                variant="light"
                label={t('import.userColor')}
                options={colorOptions}
                value={userColor}
                onChange={(value) => update({ userColor: value })}
              />
            </div>
            <div className="flex-[1_1_220px]">
              <FieldLabel htmlFor={scopeId}>{t('import.explainScope')}</FieldLabel>
              <select
                id={scopeId}
                value={explainScope}
                onChange={(event) => update({ explainScope: event.target.value as ExplainScope })}
                className="min-h-[46px] w-full rounded-control border border-border-input bg-bg px-3 font-medium text-text"
              >
                {(['errorsAndMyGood', 'errorsOnly', 'all'] as const).map((scope) => (
                  <option key={scope} value={scope}>
                    {t(`explainScope.${scope}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-[0_1_220px]">
              <FieldLabel htmlFor={depthId}>{t('import.depth.label')}</FieldLabel>
              <select
                id={depthId}
                value={depth}
                onChange={(event) => update({ depth: Number(event.target.value) })}
                className="min-h-[46px] w-full rounded-control border border-border-input bg-bg px-3 font-medium text-text"
              >
                {depthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={analyse} disabled={!source || live}>
              {t('import.analyse')}
            </Button>
            {live && <span className="text-[13px] text-live-text">{t('liveLock.short')}</span>}
            <Button variant="secondary" onClick={reset}>
              {t('import.reset')}
            </Button>
          </div>
        </section>

        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          {tab !== 'datei' && <DropZone onFile={handleFile} active={nativeDropActive} />}

          {games.length > 1 && (
            <GameList
              games={games}
              selected={evaluation.kind === 'pgn' ? evaluation.selected : 0}
              onSelect={selectGame}
            />
          )}

          <ProgressCard />

          <OnlineImport onLoaded={loadOnline} />
        </div>
      </div>
    </main>
  );
}
