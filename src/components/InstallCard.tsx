import { useEffect, useId, useRef, useState } from 'react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { cn } from '../lib/cn';
import { Button } from './Button';
import { PhoneIcon, PlusSquareIcon, ShareIcon } from './Icons';

interface InstallCardProps {
  className?: string;
  /** Smaller variant for the onboarding and the round summary. */
  compact?: boolean;
}

/**
 * "Add to home screen" in one tap where the browser allows it (Android, Chrome, Edge),
 * short instructions on iPhone/iPad, a hint elsewhere. Hidden once installed.
 */
export function InstallCard({ className, compact = false }: InstallCardProps) {
  const { method, install } = useInstallPrompt();
  const [helpOpen, setHelpOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (method === 'installed') return null;

  const onClick = async () => {
    if (method === 'prompt') {
      setBusy(true);
      try {
        await install();
      } finally {
        setBusy(false);
      }
    } else {
      setHelpOpen(true);
    }
  };

  return (
    <div className={cn('rounded-2xl border-3 border-black bg-yellow p-4 shadow-hard', className)}>
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-black bg-white">
          <PhoneIcon size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black leading-tight">Als App auf den Startbildschirm</p>
          {!compact && (
            <p className="mt-1 text-sm leading-snug">
              Öffnet dann wie eine App, ganz ohne Browserleiste, und funktioniert auch offline.
            </p>
          )}
        </div>
      </div>
      <Button variant="secondary" className="mt-3 w-full" onClick={() => void onClick()} disabled={busy}>
        <PlusSquareIcon size={20} />
        {method === 'prompt' ? 'App installieren' : 'So geht es'}
      </Button>
      <InstallHelpDialog open={helpOpen} method={method} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

function InstallHelpDialog({ open, method, onClose }: { open: boolean; method: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const steps =
    method === 'ios'
      ? [
          <>
            Tippe in Safari unten auf <b>Teilen</b> <ShareIcon size={16} className="inline align-text-bottom" />.
          </>,
          <>
            Wähle <b>Zum Home-Bildschirm</b> <PlusSquareIcon size={16} className="inline align-text-bottom" />.
          </>,
          <>
            Tippe oben rechts auf <b>Hinzufügen</b>. Fertig!
          </>,
        ]
      : [
          <>
            Öffne das Menü deines Browsers (die drei Punkte oder Striche).
          </>,
          <>
            Wähle <b>App installieren</b> oder <b>Zum Startbildschirm hinzufügen</b>.
          </>,
          <>
            Bestätige. Wortflip erscheint dann wie eine App.
          </>,
        ];

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border-3 border-black bg-white p-0 text-black shadow-hard-lg backdrop:bg-black/60 open:animate-pop-in"
    >
      <div className="p-5">
        <h2 id={titleId} className="text-xl font-black leading-tight">
          {method === 'ios' ? 'Auf dem iPhone oder iPad installieren' : 'Als App installieren'}
        </h2>
        <ol className="mt-4 flex flex-col gap-3">
          {steps.map((step, index) => (
            <li key={index} className="flex gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full border-2 border-black bg-yellow font-mono text-xs font-bold">
                {index + 1}
              </span>
              <p className="text-sm leading-snug">{step}</p>
            </li>
          ))}
        </ol>
        <Button className="mt-5 w-full" onClick={onClose} autoFocus>
          Verstanden
        </Button>
      </div>
    </dialog>
  );
}
