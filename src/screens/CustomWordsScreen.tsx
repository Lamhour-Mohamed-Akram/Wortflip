import { useEffect, useMemo, useRef, useState } from 'react';
import { reportTopic } from '../community/api';
import { containsBadWord } from '../community/badwords';
import { COMMUNITY_ENABLED } from '../community/config';
import { deviceId } from '../community/device';
import type { CommunityTopic } from '../community/types';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { ChoiceGroup, type Choice } from '../components/ChoiceGroup';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CrossIcon, ShareIcon, SparkleIcon, TargetIcon, WarningIcon } from '../components/Icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { Window } from '../components/Window';
import { LEVELS, LEVEL_HINTS, type Level } from '../data';
import {
  buildPrompt,
  exportCustomWords,
  exportFileName,
  isCustomId,
  NO_THEME,
  ownTopicGroups,
  MAX_THEME_LENGTH,
  parseCustomWords,
  PROMPT_COUNTS,
  type ParseResult,
  type PromptCount,
  type ThemeGroup,
} from '../data/custom';
import type { Tab } from '../hooks/useTab';
import { buildSelectionSession } from '../learning/session';
import { pluralize } from '../lib/format';
import { useApp } from '../state/AppContext';

const DRAFT_KEY = 'wortflip.custom-draft.v1';

interface Draft {
  level: Level;
  theme: string;
  count: PromptCount;
  /** 0 = wizard closed, 1 to 5 = the current step. Remembered so the trip to the AI can be resumed. */
  step: number;
}

/** Level, topic and count survive a reload: the learner leaves for the AI and comes back later. */
function readDraft(fallbackLevel: Level): Draft {
  const draft: Draft = { level: fallbackLevel, theme: '', count: 30, step: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Draft> | null;
    if (raw && typeof raw === 'object') {
      if (LEVELS.includes(raw.level as Level)) draft.level = raw.level as Level;
      if (typeof raw.theme === 'string') draft.theme = raw.theme.slice(0, MAX_THEME_LENGTH);
      if (PROMPT_COUNTS.includes(raw.count as PromptCount)) draft.count = raw.count as PromptCount;
      if (typeof raw.step === 'number' && raw.step >= 0 && raw.step <= 5) draft.step = raw.step;
    }
  } catch {
    // no storage: the defaults are fine
  }
  return draft;
}

function writeDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

/** Cards per topic round; a bigger topic continues in the next round. */
const ROUND_MAX = 30;

const LEVEL_CHOICES: readonly Choice<Level>[] = LEVELS.map((level) => ({
  value: level,
  label: level,
  hint: LEVEL_HINTS[level],
}));
const COUNT_CHOICES: readonly Choice<PromptCount>[] = PROMPT_COUNTS.map((count) => ({ value: count, label: String(count) }));

const FIELD = 'w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm leading-snug outline-offset-2 placeholder:text-gray';
const LABEL = 'font-mono text-[11px] font-bold uppercase tracking-wider text-gray';

/** "Thema lernen (12 Karten)" or "Thema lernen (30 von 45 Karten)". */
function roundLabel(total: number): string {
  return total > ROUND_MAX ? `Thema lernen (${ROUND_MAX} von ${total} Karten)` : `Thema lernen (${pluralize(total, 'Karte', 'Karten')})`;
}

function resultText(
  result: ParseResult,
  linked: number,
): {
  tone: 'ok' | 'warn';
  text: string;
} {
  if (result.error) return { tone: 'warn', text: result.error };
  const parts: string[] = [];
  if (linked > 0) {
    const rest = result.duplicates - linked;
    if (rest > 0) parts.push(`${rest} doppelt`);
  } else if (result.duplicates > 0) {
    const names = result.duplicateWords.slice(0, 8).join(', ') + (result.duplicateWords.length > 8 ? ' ...' : '');
    parts.push(`${result.duplicates} schon vorhanden: ${names}`);
  }
  if (result.invalid > 0) parts.push(`${result.invalid} unvollständig`);
  if (result.offensive > 0) parts.push(`${result.offensive} unpassend`);
  const extra = parts.length > 0 ? ` (${parts.join(', ')} übersprungen)` : '';
  if (linked > 0) {
    const fresh = result.items.length > 0 ? `${pluralize(result.items.length, 'neues Wort', 'neue Wörter')} und ` : '';
    return {
      tone: 'ok',
      text: `${fresh}${pluralize(linked, 'bekanntes Wort', 'bekannte Wörter')} zum Thema hinzugefügt${extra}. Du findest sie oben unter „Deine Wörter“.`,
    };
  }
  if (result.items.length === 0) {
    const hint =
      result.duplicates > 0
        ? ' Diese Wörter sind schon in der App; du findest sie in der Wortliste. Frag die KI nach spezielleren Wörtern zu deinem Thema.'
        : '';
    return { tone: 'warn', text: `Nichts hinzugefügt${extra}.${hint}` };
  }
  return {
    tone: 'ok',
    text: `${pluralize(result.items.length, 'Wort', 'Wörter')} hinzugefügt${extra}. Du findest sie oben unter „Deine Wörter“.`,
  };
}

/** "Eigene Wörter": prompt for any AI, paste the answer, learn the words like all others. */
export function CustomWordsScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { state, dispatch, items, byId, topics, share } = useApp();
  const sharing = share.sharing;
  const shareError = share.error;
  const { customWords, themeLinks, settings, progress, community } = state;
  const [draft] = useState(() => readDraft(settings.levels[0] ?? 'A1'));
  const [level, setLevel] = useState<Level>(draft.level);
  const [theme, setTheme] = useState(draft.theme);
  const [count, setCount] = useState<PromptCount>(draft.count);
  // Coming back from the AI: reopen on the paste step when the prompt had been reached.
  const [step, setStep] = useState(draft.step >= 4 && draft.theme.trim() ? 5 : draft.step);
  useEffect(() => writeDraft({ level, theme, count, step }), [level, theme, count, step]);
  const [copied, setCopied] = useState(false);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<ParseResult | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ThemeGroup | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLInputElement>(null);

  const prompt = useMemo(() => buildPrompt({ level, theme, count }), [level, theme, count]);
  // The learner's topics: added words plus the words they attached to a topic (a word may be in several topics).
  const groups = useMemo(() => ownTopicGroups(customWords, themeLinks, byId), [customWords, themeLinks, byId]);
  const mine = useMemo(() => {
    const seen = new Set<string>();
    return groups.flatMap((g) => g.items).filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
  }, [groups]);
  const communityTopics = useMemo(
    () => [...community.topics].filter((t) => !community.reported.includes(t.id)).sort((a, b) => b.createdAt - a.createdAt),
    [community.topics, community.reported],
  );
  const sharedIds = useMemo(() => new Set(Object.values(community.shared)), [community.shared]);

  function learnTopic(topic: CommunityTopic) {
    const words = topics.byTheme.get(topic.theme) ?? [];
    const session = buildSelectionSession(words, progress, ROUND_MAX, Date.now());
    if (!session) return;
    dispatch({ type: 'session/set', session });
    onNavigate('lernen');
  }

  async function report(topic: CommunityTopic) {
    if (reporting) return;
    setReporting(topic.id);
    dispatch({ type: 'community/report', id: topic.id });
    try {
      await reportTopic(topic.id, deviceId());
    } catch {
      // Hidden locally anyway; the report is not retried.
    } finally {
      setReporting(null);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // No clipboard permission: leave the text selected so it can be copied by hand.
      promptRef.current?.focus();
      promptRef.current?.select();
    }
  }

  function addFromText(text: string, withForm: boolean) {
    const parsed = parseCustomWords(text, {
      ...(withForm ? { level, theme: theme.trim() || undefined } : {}),
      existing: items,
    });
    // The topic: the field above, or the "theme" the AI wrote into the entries.
    const topic = withForm ? theme.trim() || parsed.foundThemes[0] || '' : '';
    if (topic && containsBadWord(topic)) {
      setResult({ ...parsed, items: [], existingIds: [], error: 'Dieser Themenname passt nicht in die App. Wähle bitte einen anderen.' });
      setLinkedCount(0);
      themeRef.current?.focus();
      return;
    }
    if (withForm && !topic && !parsed.error && (parsed.items.length > 0 || parsed.existingIds.length > 0)) {
      setResult({ ...parsed, items: [], existingIds: [], error: 'Kein Thema gefunden. Gib oben ein Thema ein oder lass die KI das Feld "theme" ausfüllen.' });
      setLinkedCount(0);
      themeRef.current?.focus();
      return;
    }
    const withTopic = topic ? parsed.items.map((item) => (item.theme ? item : { ...item, theme: topic })) : parsed.items;
    const linkedNow = topic ? parsed.existingIds.length : 0;
    const changed = withTopic.length > 0 || linkedNow > 0;
    if (changed) {
      dispatch({ type: 'custom/add', items: withTopic, ...(topic ? { theme: topic, linkIds: parsed.existingIds } : {}) });
    }
    setResult(parsed);
    setLinkedCount(linkedNow);
    if (changed && withForm) {
      setAnswer('');
      setStep(0);
    }
    if (changed) window.setTimeout(() => listRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 50);
    // Sharing is automatic: the app shell picks the new topic up as pending and sends it.
  }

  function exportFile() {
    const blob = new Blob([exportCustomWords(mine)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName();
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    addFromText(await file.text(), false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function learnTheme(group: ThemeGroup) {
    // A topic is learned in rounds of at most 30 cards; due and new words come first, so the next round continues.
    const session = buildSelectionSession(group.items, progress, ROUND_MAX, Date.now());
    if (!session) return;
    dispatch({ type: 'session/set', session });
    onNavigate('lernen');
  }

  const [linkedCount, setLinkedCount] = useState(0);
  const feedback = result ? resultText(result, linkedCount) : null;

  const STEP_NAMES = ['Thema', 'Anzahl', 'Level', 'Prompt', 'Antwort'];
  const canContinue = step === 1 ? theme.trim().length > 0 && !containsBadWord(theme) : true;
  const wizard = (
    <Window title={`Schritt ${step} von 5`} className="mt-4">
      <ol className="flex gap-1.5" aria-label="Schritte">
        {STEP_NAMES.map((name, index) => (
          <li
            key={name}
            aria-current={index + 1 === step ? 'step' : undefined}
            className={`h-2 flex-1 rounded-full border-2 border-black ${index + 1 <= step ? 'bg-black' : 'bg-white'}`}
            title={name}
          />
        ))}
      </ol>

      {step === 1 && (
        <label className="mt-4 block">
          <span className="text-lg font-black leading-tight">Worüber willst du lernen?</span>
          <input
            ref={themeRef}
            autoFocus
            type="text"
            value={theme}
            maxLength={MAX_THEME_LENGTH}
            onChange={(e) => setTheme(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canContinue) setStep(2);
            }}
            placeholder="z. B. Beim Arzt, Im Büro, Wohnung suchen"
            className={`${FIELD} mt-2 font-bold`}
          />
          {theme.trim() && containsBadWord(theme) && <span className="mt-2 block text-xs font-bold">Dieser Themenname passt nicht in die App.</span>}
        </label>
      )}
      {step === 2 && (
        <div className="mt-4">
          <ChoiceGroup name="custom-count" legend="Wie viele Wörter? (bis 100)" options={COUNT_CHOICES} value={count} onChange={setCount} columns={5} />
        </div>
      )}
      {step === 3 && (
        <div className="mt-4">
          <ChoiceGroup name="custom-level" legend="Welches Level?" options={LEVEL_CHOICES} value={level} onChange={setLevel} columns={3} />
        </div>
      )}
      {step === 4 && (
        <>
          <label className="mt-4 block">
            <span className={LABEL}>Dein Prompt</span>
            <textarea
              ref={promptRef}
              readOnly
              value={prompt}
              rows={6}
              onFocus={(e) => e.currentTarget.select()}
              className={`${FIELD} mt-1 font-mono text-[12px] leading-snug`}
            />
          </label>
          <Button className="mt-3 w-full" onClick={copyPrompt}>
            {copied ? <CheckIcon size={18} strokeWidth={3.5} /> : <SparkleIcon size={18} />}
            {copied ? 'Kopiert' : 'Prompt kopieren'}
          </Button>
          <p className="mt-3 text-xs leading-snug text-gray">
            Füge den Prompt in ChatGPT, Gemini, Claude oder eine andere KI ein. Kopiere danach die komplette Antwort und komm hierher zurück.
          </p>
        </>
      )}
      {step === 5 && (
        <>
          <label className="mt-4 block">
            <span className={LABEL}>Hier die Antwort der KI einfügen</span>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
              placeholder='[ {"word": "Termin", "type": "noun", ...} ]'
              className={`${FIELD} mt-1 font-mono text-[12px] leading-snug`}
            />
          </label>
          <Button className="mt-3 w-full" variant="dark" disabled={answer.trim().length === 0} onClick={() => addFromText(answer, true)}>
            Prüfen und hinzufügen
          </Button>
          {feedback && feedback.tone === 'warn' && (
            <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border-2 border-black bg-yellow-light p-3 text-sm font-bold leading-snug">
              <WarningIcon size={18} className="mt-0.5 shrink-0" />
              {feedback.text}
            </p>
          )}
          <p className="mt-3 text-xs leading-snug text-gray">
            Geprüft werden Wort, Wortart, Level, Bedeutung und Beispiel. Wörter, die es schon gibt, kommen mit ins Thema.
          </p>
        </>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => setStep(step - 1)}>
          <ArrowLeftIcon size={18} />
          {step === 1 ? 'Abbrechen' : 'Zurück'}
        </Button>
        {step < 5 ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canContinue}>
            {step === 4 ? 'Antwort einfügen' : 'Weiter'}
            <ArrowRightIcon size={18} />
          </Button>
        ) : (
          <span />
        )}
      </div>
    </Window>
  );

  return (
    <div className="px-5 pb-6 pt-5">
      <ScreenHeader eyebrow="Mehr" title="Eigene Wörter">
        <Button variant="ghost" size="sm" onClick={() => onNavigate('einstellungen')} aria-label="Zurück zu Mehr">
          <ArrowLeftIcon size={18} />
          Zurück
        </Button>
      </ScreenHeader>

      {step > 0 ? (
        wizard
      ) : (
        <>
          <p className="mt-3 text-sm leading-snug">
            Ein Thema, ein Prompt für ChatGPT, Gemini oder eine andere KI, die Antwort einfügen: fertig. Die neuen Karten sehen aus wie alle anderen, mit
            Übersetzung, und landen in deinem Lernplan.
          </p>
          <Button className="mt-4 w-full" onClick={() => setStep(1)}>
            <SparkleIcon size={20} />
            Neues Thema hinzufügen
          </Button>
          {feedback && (
            <p
              role="status"
              className={`mt-3 flex items-start gap-2 rounded-xl border-2 border-black p-3 text-sm font-bold leading-snug ${
                feedback.tone === 'ok' ? 'bg-yellow' : 'bg-yellow-light'
              }`}
            >
              {feedback.tone === 'ok' ? (
                <CheckIcon size={18} strokeWidth={3.5} className="mt-0.5 shrink-0" />
              ) : (
                <WarningIcon size={18} className="mt-0.5 shrink-0" />
              )}
              {feedback.text}
            </p>
          )}

          <div ref={listRef} className="scroll-mt-4">
            <Window title="Deine Wörter" className="mt-4">
              {groups.length === 0 ? (
                <p className="text-sm leading-snug text-gray">
                  Noch keine eigenen Wörter. Deine Themen erscheinen hier, sobald du unten eine Antwort einfügst.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {groups.map((group) => (
                    <li key={group.theme} className="rounded-xl border-2 border-black p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black leading-tight">{group.theme}</p>
                          <p className="mt-1 flex flex-wrap gap-1.5">
                            {group.levels.map((l) => (
                              <Chip key={l} variant="solid">
                                {l}
                              </Chip>
                            ))}
                            <Chip variant="outline">{pluralize(group.items.length, 'Wort', 'Wörter')}</Chip>
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(group)} aria-label={`Thema ${group.theme} löschen`}>
                          <CrossIcon size={16} strokeWidth={3} />
                        </Button>
                      </div>
                      <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => learnTheme(group)}>
                        <TargetIcon size={16} />
                        {roundLabel(group.items.length)}
                      </Button>
                      {COMMUNITY_ENABLED &&
                        group.theme !== NO_THEME &&
                        (community.shared[group.theme] ? (
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-bold">
                            <CheckIcon size={14} strokeWidth={3.5} />
                            Mit allen geteilt
                          </p>
                        ) : (
                          <Button variant="ghost" size="sm" className="mt-2 w-full" disabled={sharing !== null} onClick={share.retry}>
                            <ShareIcon size={16} />
                            {sharing === group.theme ? 'Wird geteilt' : 'Mit allen teilen'}
                          </Button>
                        ))}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button variant="secondary" size="sm" disabled={mine.length === 0} onClick={exportFile}>
                  <ShareIcon size={16} />
                  Exportieren
                </Button>
                <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                  Importieren
                </Button>
                <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importFile(e.target.files?.[0])} />
              </div>
              <p className="mt-3 text-xs leading-snug text-gray">
                Eigene Wörter liegen nur auf diesem Gerät. Exportiere die Datei, um sie zu sichern oder auf ein anderes Gerät zu bringen.
              </p>
              {shareError && (
                <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border-2 border-black bg-yellow-light p-3 text-sm font-bold leading-snug">
                  <WarningIcon size={18} className="mt-0.5 shrink-0" />
                  {shareError}
                </p>
              )}
              {COMMUNITY_ENABLED && (
                <p className="mt-3 text-xs leading-snug text-gray">
                  Neue Themen werden automatisch mit der Community geteilt: Andere Lernende sehen sie in ihrer Wortliste. Prüfe die Antwort der KI, bevor du sie
                  einfügst. Bist du offline, wird das Thema geteilt, sobald die Verbindung zurück ist.
                </p>
              )}
            </Window>
          </div>

          {COMMUNITY_ENABLED && settings.showCommunity && (
            <Window title="Aus der Community" className="mt-4">
              {communityTopics.length === 0 ? (
                <p className="text-sm leading-snug text-gray">
                  Noch keine geteilten Themen{community.syncedAt === null ? ' (oder gerade offline)' : ''}. Teile dein erstes!
                </p>
              ) : (
                <ul className="flex flex-col gap-3" aria-label="Community-Themen">
                  {communityTopics.map((topic) => (
                    <li key={topic.id} className="rounded-xl border-2 border-black p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black leading-tight">{topic.theme}</p>
                          <p className="mt-1 flex flex-wrap gap-1.5">
                            <Chip variant="solid">{topic.level}</Chip>
                            <Chip variant="outline">{pluralize(topic.items.length, 'Wort', 'Wörter')}</Chip>
                            {sharedIds.has(topic.id) && <Chip variant="yellow">Von dir</Chip>}
                          </p>
                        </div>
                        {!sharedIds.has(topic.id) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={reporting !== null}
                            onClick={() => void report(topic)}
                            aria-label={`Thema ${topic.theme} melden`}
                          >
                            Melden
                          </Button>
                        )}
                      </div>
                      <Button variant="secondary" size="sm" className="mt-3 w-full" onClick={() => learnTopic(topic)}>
                        <TargetIcon size={16} />
                        {roundLabel((topics.byTheme.get(topic.theme) ?? []).length)}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs leading-snug text-gray">Mit KI erstellt und nicht geprüft. Nach drei Meldungen verschwindet ein Thema für alle.</p>
            </Window>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Thema „${confirmDelete?.theme ?? ''}“ löschen?`}
        description={`${pluralize(confirmDelete?.items.length ?? 0, 'Wort', 'Wörter')} und der zugehörige Lernstand werden entfernt.`}
        confirmLabel="Löschen"
        onConfirm={() => {
          if (confirmDelete)
            dispatch({
              type: 'custom/removeTheme',
              theme: confirmDelete.theme,
              ids: confirmDelete.items.filter((item) => isCustomId(item.id)).map((item) => item.id),
            });
          setConfirmDelete(null);
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
