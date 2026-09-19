import { dataset, pluralForm, type VocabularyItem } from '../data';
import { cn } from '../lib/cn';

interface Row {
  label: string;
  value: string;
}

function formRows(item: VocabularyItem): Row[] {
  switch (item.type) {
    case 'noun':
      return [{ label: 'Plural', value: pluralForm(item) ?? 'nur Singular' }];
    case 'verb': {
      const f = item.verbForms;
      if (!f) return [];
      const rows: Row[] = [];
      if (f.thirdPersonPresent) rows.push({ label: 'Präsens', value: f.thirdPersonPresent });
      if (f.preterite) rows.push({ label: 'Präteritum', value: f.preterite });
      if (f.participleII) rows.push({ label: 'Partizip II', value: f.participleII });
      return rows;
    }
    case 'adjective': {
      const f = item.adjectiveForms;
      if (!f) return [];
      const rows: Row[] = [];
      if (f.comparative) rows.push({ label: 'Komparativ', value: f.comparative });
      if (f.superlative) rows.push({ label: 'Superlativ', value: f.superlative });
      return rows;
    }
    default:
      return [];
  }
}

export function WordForms({ item, className }: { item: VocabularyItem; className?: string }) {
  const rows = formRows(item);
  if (rows.length === 0) return null;
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[13px] leading-snug', className)}>
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-gray">{row.label}</dt>
          <dd className="font-bold">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const SECTION_LABEL = 'font-mono text-[11px] font-bold uppercase tracking-wider text-gray';

function sourceName(id: string): string {
  const source = dataset.sources.find((s) => s.id === id);
  return source ? `${source.name} (${source.license})` : id;
}

/** "Wörterbuch: Deutsches Wiktionary (CC BY-SA 4.0) · Beispiel: Tatoeba (CC BY 2.0 FR), Autor: xyz" */
function attribution(item: VocabularyItem): string | null {
  const parts: string[] = [];
  const definitionIds = (item.sourceIds ?? []).filter((id) => id !== item.exampleSource?.sourceId);
  if (definitionIds.length > 0) parts.push(`Wörterbuch: ${definitionIds.map(sourceName).join(', ')}`);
  if (item.exampleSource) {
    const author = item.exampleSource.author ? `, Autor: ${item.exampleSource.author}` : '';
    parts.push(`Beispiel: ${sourceName(item.exampleSource.sourceId)}${author}`);
  }
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Definition, example sentence and grammatical forms. Shared by the card back and the word list. */
export function WordDetails({ item, compact = false }: { item: VocabularyItem; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col', compact ? 'gap-2.5' : 'gap-3.5 short:gap-2.5')}>
      <section>
        <h3 className={SECTION_LABEL}>Bedeutung</h3>
        <p className={cn('mt-0.5 font-medium leading-snug', compact ? 'text-[15px]' : 'text-[17px] short:text-[15px]')}>{item.definitionDe}</p>
      </section>
      <section>
        <h3 className={SECTION_LABEL}>Beispiel</h3>
        <p
          className={cn(
            'mt-1 rounded-xl border-2 border-black bg-yellow-light px-3 py-2 leading-snug',
            compact ? 'text-[14px]' : 'text-[15px] short:text-[14px]',
          )}
        >
          „{item.exampleDe}“
        </p>
      </section>
      <WordForms item={item} />
      {attribution(item) && <p className="font-mono text-[10px] leading-snug text-gray">{attribution(item)}</p>}
    </div>
  );
}
