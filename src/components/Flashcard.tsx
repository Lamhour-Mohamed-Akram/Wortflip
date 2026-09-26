import { headword, WORD_TYPE_LABELS, type VocabularyItem } from '../data';
import { Chip } from './Chip';
import { ArrowLeftIcon, ArrowRightIcon, FlipIcon } from './Icons';
import { WordDetails } from './WordDetails';

export function FlashcardFront({ item }: { item: VocabularyItem }) {
  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex items-center gap-2">
        <Chip variant="solid">{item.level}</Chip>
        {item.theme && (
          <Chip variant="yellow" className="min-w-0 max-w-[45%] truncate">
            {item.theme}
          </Chip>
        )}
        <Chip variant="outline" className="ml-auto">
          {WORD_TYPE_LABELS[item.type]}
        </Chip>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 text-center">
        {item.article && <span className="font-mono text-xl font-bold text-gray">{item.article}</span>}
        <span
          lang="de"
          className="w-full text-balance text-[clamp(2.1rem,11vw,3rem)] font-black leading-[1.05] tracking-tight [overflow-wrap:anywhere] hyphens-none"
        >
          {item.word}
        </span>
      </div>
      <p className="flex items-center justify-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-gray">
        <FlipIcon size={14} />
        Tippen zum Umdrehen
      </p>
    </div>
  );
}

export function FlashcardBack({ item }: { item: VocabularyItem }) {
  return (
    <div className="flex min-h-[22rem] flex-col p-5 short:min-h-[19rem] short:p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xl font-black leading-tight">{headword(item)}</span>
        <Chip variant="solid" className="mt-0.5 shrink-0">
          {item.level}
        </Chip>
      </div>
      <div className="mt-3 flex-1 short:mt-2">
        <WordDetails item={item} showCredits={false} />
      </div>
      <p className="mt-3 flex items-center justify-between short:mt-2 font-mono text-[11px] font-bold uppercase tracking-wider text-gray">
        <span className="flex items-center gap-1">
          <ArrowLeftIcon size={14} /> Noch lernen
        </span>
        <span className="flex items-center gap-1">
          Kenne ich <ArrowRightIcon size={14} />
        </span>
      </p>
    </div>
  );
}
