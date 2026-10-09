import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent font-bold text-[15px] px-7 min-h-12 enabled:hover:brightness-110',
  secondary:
    'border border-border-input bg-transparent text-text font-semibold px-5 min-h-12 enabled:hover:bg-button-secondary',
  ghost:
    'border border-border-input bg-button-secondary text-text font-semibold px-5 min-h-hit enabled:hover:brightness-125',
};

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded-control transition disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
