import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Button, type ButtonProps } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { RepeatIcon, WarningIcon } from './Icons';

type Mode = 'progress' | 'all';

const COPY: Record<Mode, { label: string; title: string; description: string; confirm: string }> = {
  progress: {
    label: 'Fortschritt zurücksetzen',
    title: 'Fortschritt zurücksetzen?',
    description:
      'Lernstand, Serie und Statistiken werden gelöscht. Level und Rundengröße bleiben erhalten. Das kann nicht rückgängig gemacht werden.',
    confirm: 'Ja, zurücksetzen',
  },
  all: {
    label: 'Alles löschen und neu starten',
    title: 'Wirklich alles löschen?',
    description:
      'Lernstand, Serie, Statistiken und Einstellungen werden gelöscht. Du beginnst wieder ganz von vorn, wie beim ersten Öffnen der App.',
    confirm: 'Ja, alles löschen',
  },
};

interface ResetButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  mode: Mode;
}

/** A reset button together with its confirmation dialog. */
export function ResetButton({ mode, variant = 'secondary', ...props }: ResetButtonProps) {
  const { dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const copy = COPY[mode];

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} {...props}>
        {mode === 'all' ? <RepeatIcon size={20} /> : <WarningIcon size={20} />}
        {copy.label}
      </Button>
      <ConfirmDialog
        open={open}
        title={copy.title}
        description={copy.description}
        confirmLabel={copy.confirm}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          dispatch({ type: mode === 'all' ? 'app/reset-all' : 'progress/reset' });
          setOpen(false);
        }}
      />
    </>
  );
}
