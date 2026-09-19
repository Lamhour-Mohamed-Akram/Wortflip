import { useEffect, useId, useRef, type MouseEvent } from 'react';
import { Button } from './Button';
import { WarningIcon } from './Icons';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native <dialog>: focus trapping, Escape handling and the top layer come for free. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Abbrechen',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const onBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === ref.current) onCancel();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={onBackdropClick}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border-3 border-black bg-white p-0 text-black shadow-hard-lg backdrop:bg-black/60 open:animate-pop-in"
    >
      <div className="p-5">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-black bg-yellow">
            <WarningIcon size={24} />
          </span>
          <h2 id={titleId} className="text-xl font-black leading-tight">
            {title}
          </h2>
        </div>
        <p id={descId} className="mt-3 text-gray">
          {description}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant="dark" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
