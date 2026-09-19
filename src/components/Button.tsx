import type { ComponentPropsWithRef } from 'react';
import { cn } from '../lib/cn';

type Variant = 'primary' | 'secondary' | 'dark' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'border-black bg-yellow text-black shadow-hard hover:bg-yellow-dark',
  secondary: 'border-black bg-white text-black shadow-hard hover:bg-yellow-light',
  dark: 'border-black bg-black text-white shadow-[5px_5px_0_0_#F2B705] hover:bg-gray',
  ghost: 'border-transparent bg-transparent text-black shadow-none hover:bg-yellow-light',
};

const SIZE: Record<Size, string> = {
  sm: 'min-h-10 rounded-xl px-3 text-sm',
  md: 'min-h-12 rounded-2xl px-5 text-base',
  lg: 'min-h-14 rounded-2xl px-6 text-lg',
};

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'primary', size = 'md', className, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 border-3 font-bold leading-none',
        'transition-[transform,box-shadow,background-color] duration-100 ease-out',
        'active:translate-x-[3px] active:translate-y-[3px] active:shadow-hard-xs',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:active:translate-x-0 disabled:active:translate-y-0',
        VARIANT[variant],
        SIZE[size],
        variant === 'ghost' && 'active:shadow-none',
        className,
      )}
      {...props}
    />
  );
}
