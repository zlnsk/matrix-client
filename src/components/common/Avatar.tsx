"use client";

import { cn } from "@/lib/utils/cn";
import { hueFromString, initialsFromName } from "@/lib/utils/avatar";
import { useMedia } from "@/hooks/useMedia";

type Props = {
  name: string;
  src?: string | null;
  size?: number;
  unread?: boolean;
  className?: string;
};

export function Avatar({ name, src, size = 44, unread = false, className }: Props) {
  const resolved = useMedia(src, Math.max(size * 2, 64), Math.max(size * 2, 64));
  const hue = hueFromString(name);
  const bg = `linear-gradient(135deg, hsl(${hue} 65% 58%), hsl(${(hue + 40) % 360} 60% 45%))`;
  const ring = unread
    ? {
        padding: 2,
        background:
          "conic-gradient(from 0deg, #2563eb, #4f46e5, #7c3aed, #ec4899, #f59e0b, #10b981, #2563eb)",
        animation: "ring-rotate 20s linear infinite",
        borderRadius: "9999px",
      }
    : undefined;
  const innerSize = unread ? size - 4 : size;
  return (
    <div
      className={cn("relative flex-shrink-0", className)}
      style={{ width: size, height: size, ...ring }}
    >
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: 9999,
          background: resolved ? "var(--surface-sunken)" : bg,
          color: "#fff",
          fontSize: Math.max(12, size * 0.36),
          fontWeight: 600,
          letterSpacing: "-0.02em",
          boxShadow: "inset 0 0 0 1px color-mix(in oklch, #000 6%, transparent)",
        }}
      >
        {resolved ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolved}
            alt={name}
            width={innerSize}
            height={innerSize}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span>{initialsFromName(name)}</span>
        )}
      </div>
    </div>
  );
}
