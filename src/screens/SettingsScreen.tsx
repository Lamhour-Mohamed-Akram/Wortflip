import { ChoiceGroup, type Choice } from '../components/ChoiceGroup';
import { BadgeIcon, CodeIcon, ExternalLinkIcon, KeyboardIcon, SparkleIcon, WarningIcon } from '../components/Icons';
import { InstallCard } from '../components/InstallCard';
import { LevelPicker } from '../components/LevelPicker';
import { ResetButton } from '../components/ResetButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { Window } from '../components/Window';
import { CANDIDATE_SOURCES, dataset, type VocabularySource } from '../data';
import { SESSION_SIZES } from '../learning/storage';
import type { SessionSize } from '../learning/types';
import { pluralize } from '../lib/format';
import { useApp } from '../state/AppContext';
import type { Tab } from '../hooks/useTab';
import { Button } from '../components/Button';
import { groupByTheme } from '../data/custom';
import { COMMUNITY_ENABLED } from '../community/config';
import { AUTHOR } from '../author';

const SIZE_CHOICES: readonly Choice<SessionSize>[] = SESSION_SIZES.map((size) => ({
  value: size,
  label: String(size),
  hint: 'Karten',
}));

const preparedSources = CANDIDATE_SOURCES.filter((candidate) => !dataset.sources.some((s) => s.id === candidate.id));

const SHORTCUTS = [
  { keys: ['Leertaste', 'Enter'], action: 'Karte umdrehen' },
  { keys: ['←'], action: 'Noch lernen' },
  { keys: ['→'], action: 'Kenne ich' },
];

const COMMUNITY_CHOICES: Choice<'off' | 'on'>[] = [
  { value: 'off', label: 'Aus', hint: 'nur eigene' },
  { value: 'on', label: 'An', hint: 'von allen' },
];

const TRANSLATION_CHOICES: Choice<'off' | 'on'>[] = [
  { value: 'off', label: 'Aus', hint: 'nur Deutsch' },
  { value: 'on', label: 'An', hint: 'auf der Rückseite' },
];

export function SettingsScreen({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { state, dispatch, persistent } = useApp();
  const { settings } = state;
  const reviewedCount = Object.keys(state.progress).length;
  const ownCount = state.customWords.length + Object.values(state.themeLinks).flat().length;
  const ownThemes = new Set([...groupByTheme(state.customWords).map((g) => g.theme), ...Object.keys(state.themeLinks)]).size;

  return (
    <div className="px-5 pb-6 pt-5">
      <ScreenHeader eyebrow="Wortflip" title="Einstellungen" />

      <InstallCard className="mb-4" />

      <Window title="Lernen">
        <LevelPicker
          name="settings-level"
          value={settings.levels}
          onChange={(levels) => dispatch({ type: 'settings/levels', levels })}
        />
        <div className="mt-4">
          <ChoiceGroup
            name="settings-size"
            legend="Karten pro Runde"
            options={SIZE_CHOICES}
            value={settings.sessionSize}
            onChange={(sessionSize) => dispatch({ type: 'settings/sessionSize', sessionSize })}
          />
        </div>
        <p className="mt-3 text-xs leading-snug text-gray">
          Eine laufende Runde wird nach einer Änderung neu zusammengestellt. Dein Lernfortschritt bleibt erhalten.
        </p>
        <div className="mt-4">
          <ChoiceGroup
            name="settings-translation"
            legend="Englische Übersetzung"
            options={TRANSLATION_CHOICES}
            value={settings.showTranslation ? 'on' : 'off'}
            onChange={(value) => dispatch({ type: 'settings/showTranslation', showTranslation: value === 'on' })}
          />
        </div>
        <p className="mt-3 text-xs leading-snug text-gray">
          Zeigt auf der Rückseite eine kurze englische Übersetzung aus dem Wiktionary. Schalte sie aus, wenn du ganz auf Deutsch denken willst.
        </p>
        {COMMUNITY_ENABLED && (
          <>
            <div className="mt-4">
              <ChoiceGroup
                name="settings-community"
                legend="Themen aus der Community"
                options={COMMUNITY_CHOICES}
                value={settings.showCommunity ? 'on' : 'off'}
                onChange={(value) => dispatch({ type: 'settings/showCommunity', showCommunity: value === 'on' })}
              />
            </div>
            <p className="mt-3 text-xs leading-snug text-gray">
              Themen, die andere Lernende geteilt haben, erscheinen in der Wortliste und beim Lernen. Sie sind mit KI erstellt und nicht geprüft.
            </p>
          </>
        )}
      </Window>

      <Window title="Eigene Wörter" className="mt-4">
        <p className="text-sm leading-snug">
          Lass dir von einer KI Wörter zu deinem Thema schreiben und lerne sie hier wie alle anderen, mit Übersetzung.
        </p>
        <p className="mt-2 text-xs text-gray">
          {ownCount === 0
            ? 'Noch keine eigenen Wörter.'
            : `${pluralize(ownCount, 'Wort', 'Wörter')} in ${pluralize(ownThemes, 'Thema', 'Themen')}.`}
        </p>
        <Button variant="secondary" className="mt-4 w-full" onClick={() => onNavigate('eigene')}>
          <SparkleIcon size={18} />
          {ownCount === 0 ? 'Wörter mit KI hinzufügen' : 'Eigene Wörter verwalten'}
        </Button>
      </Window>

      <Window title="Daten" className="mt-4">
        <p className="text-sm leading-snug">
          Dein Lernfortschritt wird nur lokal in deinem Browser gespeichert: ohne Konto, ohne Tracking. Nur Themen, die du teilst, gehen an die Community.
        </p>
        {!persistent && (
          <p className="mt-2 flex items-start gap-2 rounded-xl border-2 border-black bg-yellow-light p-2 text-xs font-bold">
            <WarningIcon size={18} className="mt-0.5 shrink-0" />
            Dein Browser erlaubt kein Speichern. Der Fortschritt geht beim Neuladen verloren.
          </p>
        )}
        <p className="mt-2 text-xs text-gray">
          Gespeichert: {pluralize(reviewedCount, 'Wort', 'Wörter')} mit Lernstand, {pluralize(state.stats.totalReviews, 'Antwort', 'Antworten')}.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <ResetButton mode="progress" className="w-full" />
          <ResetButton mode="all" variant="dark" className="w-full" />
        </div>
        <p className="mt-2 text-xs leading-snug text-gray">
          „Fortschritt zurücksetzen“ behält Level, Rundengröße und eigene Wörter. „Alles löschen“ entfernt auch die eigenen Wörter und bringt dich zurück zum Start.
        </p>
      </Window>

      <Window title="Datenquellen" className="mt-4">
        <h3 className="font-black">{dataset.name}</h3>
        <p className="text-xs text-gray">
          Version {dataset.version} · {pluralize(dataset.items.length, 'Eintrag', 'Einträge')}
        </p>
        <p className="mt-2 text-sm leading-snug">{dataset.origin}</p>

        {dataset.sources.length > 0 && (
          <>
            <h4 className="mt-4 font-mono text-[11px] font-bold uppercase tracking-wider text-gray">Verwendete Quellen</h4>
            <ul className="mt-2 flex flex-col gap-2">
              {dataset.sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </ul>
          </>
        )}

        {preparedSources.length > 0 && (
          <>
            <h4 className="mt-4 font-mono text-[11px] font-bold uppercase tracking-wider text-gray">Vorbereitete Quellen</h4>
            <p className="mt-1 text-xs leading-snug text-gray">
              Für einen größeren Wortschatz sind diese freien Quellen vorgesehen. Die aktuellen Einträge stammen <b>nicht</b> daraus.
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {preparedSources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </ul>
          </>
        )}
      </Window>

      <Window title="Über" className="mt-4">
        <p className="text-sm leading-snug">
          Wortflip {__APP_VERSION__} · Karteikarten für deutschen Wortschatz. Alle Erklärungen sind auf einfachem Deutsch; eine englische Übersetzung lässt sich in den Einstellungen einblenden.
        </p>
        <div className="mt-4 rounded-xl border-2 border-black bg-yellow-light p-3">
          <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-gray">Gemacht von</p>
          <p className="mt-0.5 text-lg font-black leading-tight">{AUTHOR.name}</p>
          <p className="text-xs text-gray">{AUTHOR.role}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={AUTHOR.github}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-black bg-white font-bold shadow-hard-xs transition-colors hover:bg-yellow"
            >
              <CodeIcon size={18} />
              GitHub
            </a>
            <a
              href={AUTHOR.linkedin}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-black bg-white font-bold shadow-hard-xs transition-colors hover:bg-yellow"
            >
              <BadgeIcon size={18} />
              LinkedIn
            </a>
          </div>
        </div>
        <h4 className="mt-4 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-gray">
          <KeyboardIcon size={16} /> Tastatur
        </h4>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {SHORTCUTS.map(({ keys, action }) => (
            <li key={action} className="flex items-center gap-2">
              <span className="flex gap-1">
                {keys.map((key) => (
                  <kbd key={key} className="rounded-md border-2 border-black bg-white px-1.5 py-0.5 font-mono text-[11px] font-bold shadow-hard-xs">
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="text-gray">{action}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs leading-snug text-gray">
          Gebaut mit React, TypeScript, Vite und Tailwind CSS. Schriften: Rubik und Space Mono (SIL Open Font License).
        </p>
      </Window>

    </div>
  );
}

function SourceCard({ source }: { source: VocabularySource }) {
  return (
    <li className="rounded-xl border-2 border-black bg-white p-3 shadow-hard-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black leading-tight">{source.name}</p>
          <p className="mt-0.5 text-xs text-gray">
            Lizenz:{' '}
            <a href={source.licenseUrl} target="_blank" rel="noreferrer" className="font-bold text-black underline decoration-2 underline-offset-2">
              {source.license}
            </a>
          </p>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`${source.name} öffnen`}
          className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-black bg-yellow-light"
        >
          <ExternalLinkIcon size={18} />
        </a>
      </div>
      {source.note && <p className="mt-2 text-xs leading-snug text-gray">{source.note}</p>}
    </li>
  );
}
