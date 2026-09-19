import { useState, type FormEvent } from 'react';
import { Button } from '../components/Button';
import { Decor } from '../components/Decor';
import { ArrowRightIcon, FlipIcon, RepeatIcon, SwipeIcon } from '../components/Icons';
import { Window } from '../components/Window';
import { LevelPicker } from '../components/LevelPicker';
import { Wordmark } from '../components/Wordmark';
import type { Level } from '../data';

const STEPS = [
  {
    Icon: FlipIcon,
    title: 'Tippen',
    text: 'Du siehst ein deutsches Wort. Tippe auf die Karte, um Bedeutung, Beispiel und Formen zu sehen.',
  },
  {
    Icon: SwipeIcon,
    title: 'Wischen',
    text: 'Nach rechts: „Kenne ich“. Nach links: „Noch lernen“. Oder nutze die Tasten unter der Karte.',
  },
  {
    Icon: RepeatIcon,
    title: 'Wiederholen',
    text: 'Schwere Wörter kommen schnell wieder, bekannte Wörter erst nach Tagen. So bleibt alles im Kopf.',
  },
];

export function OnboardingScreen({ onStart }: { onStart: (levels: Level[]) => void }) {
  const [levels, setLevels] = useState<Level[]>(['A1']);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onStart(levels);
  };

  return (
    <div className="relative flex min-h-full flex-col px-5 pb-8 pt-10">
      <Decor />
      <div className="relative">
        <Wordmark size="lg" />
        <h1 className="mt-7 text-[2.35rem] font-black leading-[1.05] tracking-tight text-balance">
          Deutsch lernen:{' '}
          <span className="inline-block rotate-[-1.5deg] rounded-lg border-3 border-black bg-yellow px-2 shadow-hard-sm">
            ein Wisch
          </span>{' '}
          nach dem anderen.
        </h1>
        <p className="mt-4 max-w-sm text-lg text-gray text-balance">
          Karteikarten für den Wortschatz A1 bis B1. Ohne Konto, ohne Server, offline auf deinem Handy.
        </p>
      </div>

      <Window title="So funktioniert's" className="relative mt-7" bodyClassName="p-0">
        <ol>
          {STEPS.map(({ Icon, title, text }, index) => (
            <li key={title} className="flex gap-3 border-b-2 border-black p-4 last:border-b-0">
              <span className="relative grid size-11 shrink-0 place-items-center rounded-xl border-2 border-black bg-yellow-light">
                <Icon size={22} />
                <span className="absolute -left-2 -top-2 grid size-5 place-items-center rounded-full border-2 border-black bg-black font-mono text-[10px] font-bold text-yellow">
                  {index + 1}
                </span>
              </span>
              <div>
                <h2 className="font-black">{title}</h2>
                <p className="mt-0.5 text-sm leading-snug text-gray">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Window>

      <form onSubmit={submit} className="relative mt-7">
        <LevelPicker name="onboarding-level" legend="Welche Level lernst du?" value={levels} onChange={setLevels} />
        <Button type="submit" size="lg" className="mt-5 w-full">
          Los geht's
          <ArrowRightIcon size={22} strokeWidth={3} />
        </Button>
      </form>
    </div>
  );
}
