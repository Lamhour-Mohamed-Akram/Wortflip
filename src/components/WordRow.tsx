import { useState, type ReactNode } from 'react';
import { headword, WORD_TYPE_LABELS, type VocabularyItem } from '../data';
import { isDue } from '../learning/scheduler';
import type { WordProgress } from '../learning/types';
import { cn } from '../lib/cn';
import { Chip } from './Chip';
import { CheckIcon, ChevronDownIcon } from './Icons';
import { WordDetails } from './WordDetails';

interface Status {
  label: string;
  variant: 'outline' | 'yellow' | 'solid';
}

export function learningStatus(progress: WordProgress | undefined, now: number): Status {
  if (!progress) return { label: 'Neu', variant: 'outline' };
  if (progress.status === 'mastered') return { label: 'Gemeistert', variant: 'solid' };
  return { label: isDue(progress, now) ? 'Fällig' : 'Lernen', variant: 'yellow' };
}

interface WordRowProps {
  item: VocabularyItem;
  progress: WordProgress | undefined;
  now: number;
  /** Badge shown before the word, e.g. the number of misses. */
  leading?: ReactNode;
  /** Extra chips after level and word type. */
  chips?: ReactNode;
  showStatus?: boolean;
}

/** One expandable row of a word list: headword, chips, and the full details on tap. */
export function WordRow({ item, progress, now, leading, chips, showStatus = true }: WordRowProps) {
  const [open, setOpen] = useState(false);
  const status = learningStatus(progress, now);
  return (
    <li className="rounded-2xl border-3 border-black bg-white shadow-hard-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-2xl p-3 text-left outline-offset-[-3px]"
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-black leading-tight">{headword(item)}</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            <Chip variant="solid">{item.level}</Chip>
            <Chip variant="outline">{WORD_TYPE_LABELS[item.type]}</Chip>
            {chips}
            {showStatus && (
              <Chip variant={status.variant}>
                {status.label === 'Gemeistert' && <CheckIcon size={10} strokeWidth={4} />}
                {status.label}
              </Chip>
            )}
          </span>
        </span>
        <ChevronDownIcon size={22} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t-2 border-black px-3 py-3">
          <WordDetails item={item} compact />
        </div>
      )}
    </li>
  );
}
