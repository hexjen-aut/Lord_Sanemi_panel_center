import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "default" | "ghost";
type Size = "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-orange border-orange text-black font-semibold hover:bg-orange-dark hover:text-white",
  default: "bg-surface-2 border-border-strong text-ink hover:bg-surface-3",
  ghost: "bg-transparent border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink hover:border-border",
};

const SIZES: Record<Size, string> = {
  md: "px-4 py-2 text-sm",
  sm: "px-2.5 py-1 text-xs",
};

export function Button({
  variant = "default",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={`rounded-lg border font-sans transition-colors cursor-pointer ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    />
  );
}
