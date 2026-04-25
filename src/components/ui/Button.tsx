"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "md" | "sm" | "icon";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
};

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 font-medium transition-[transform,opacity,background,border-color,color] active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_oklch,var(--accent-unread)_50%,transparent)]";

const sizeMap: Record<Size, string> = {
  md: "h-9 rounded-xl px-3.5 text-sm",
  sm: "h-8 rounded-lg px-2.5 text-xs gap-1.5",
  icon: "h-8 w-8 rounded-lg p-0",
};

const variantClass: Record<Variant, string> = {
  primary: "text-white",
  secondary: "border hover:bg-[var(--surface-sunken)]",
  danger: "border hover:bg-[var(--surface-sunken)]",
  ghost: "hover:bg-[var(--surface-sunken)]",
};

const variantStyle: Record<Variant, CSSProperties> = {
  primary: { background: "var(--accent-unread)" },
  secondary: { borderColor: "var(--border)", color: "var(--text)" },
  danger: {
    borderColor: "color-mix(in oklch, var(--accent-danger) 30%, transparent)",
    color: "var(--accent-danger)",
  },
  ghost: { color: "var(--text-muted)" },
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    iconLeft,
    iconRight,
    children,
    className,
    style,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  const cls = [base, sizeMap[size], variantClass[variant], className ?? ""].join(" ").trim();
  const mergedStyle: CSSProperties = { ...variantStyle[variant], ...style };
  const spinSize = size === "sm" ? 12 : 14;

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cls}
      style={mergedStyle}
      {...rest}
    >
      {loading ? <Loader2 size={spinSize} className="animate-spin" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});
