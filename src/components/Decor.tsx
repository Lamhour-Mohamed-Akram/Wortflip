import { SparkleIcon, StarIcon } from './Icons';

/** Playful background shapes. Purely decorative, hidden from assistive tech. */
export function Decor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <SparkleIcon className="animate-float absolute -left-1 top-8 size-12 text-yellow-dark" strokeWidth={2} />
      <StarIcon className="absolute right-6 top-20 size-7 fill-yellow text-black" strokeWidth={2} />
      <span className="absolute -right-6 top-44 size-20 rounded-full border-3 border-black bg-yellow-light" />
      <span className="absolute -left-4 bottom-40 h-8 w-16 rotate-[-12deg] rounded-full border-3 border-black bg-yellow" />
      <SparkleIcon className="absolute bottom-24 right-10 size-6 text-black" strokeWidth={2.5} />
      <StarIcon className="animate-float absolute bottom-10 left-1/2 size-5 fill-yellow-dark text-black [animation-delay:1.5s]" strokeWidth={2} />
    </div>
  );
}
