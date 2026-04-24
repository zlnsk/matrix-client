"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "subtle" | "brand";
};

const sizeMap = { sm: 32, md: 36, lg: 44 } as const;

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, size = "md", variant = "ghost", className, children, ...rest },
  ref
) {
  const px = sizeMap[size];
  const baseClass = "inline-flex items-center justify-center rounded-full transition-[background,color,transform] active:scale-[0.96]";
  const variantStyle: React.CSSProperties =
    variant === "brand"
      ? { background: "var(--accent-unread)", color: "#fff" }
      : variant === "subtle"
      ? { background: "var(--surface-sunken)", color: "var(--text)" }
      : { background: "transparent", color: "var(--text-muted)" };
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(baseClass, className)}
      style={{ width: px, height: px, ...variantStyle }}
      {...rest}
    >
      {children}
    </button>
  );
});
