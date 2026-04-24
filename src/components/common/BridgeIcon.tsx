"use client";

import type { CSSProperties } from "react";

// Compact brand glyphs — rounded speech bubble for Signal, speech bubble with
// phone for WhatsApp. Deliberately simplified so the chat list reads clean at
// 12–14 px; rendered with reduced opacity to feel secondary to the room name.
const SIGNAL_PATH =
  "M12 2a10 10 0 100 20 10 10 0 000-20zm0 3.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zm0 2a4.5 4.5 0 100 9 4.5 4.5 0 000-9z";
const WHATSAPP_PATH =
  "M12 2a10 10 0 00-8.89 14.54L2 22l5.61-1.11A10 10 0 1012 2zm4.25 13.75c-.2.55-1.14 1.04-1.55 1.1-.4.04-.9.06-1.45-.09-.33-.11-.75-.26-1.3-.48a11 11 0 01-4.06-3.58c-.3-.44-.81-1.19-.81-2.27 0-1.07.55-1.58.75-1.8.2-.22.43-.27.58-.27h.42c.14 0 .33-.05.51.39.18.47.62 1.63.68 1.76.06.12.1.26.02.41-.08.16-.12.26-.24.41-.12.15-.25.33-.36.44-.12.12-.24.26-.1.5.14.24.63 1.03 1.35 1.68.93.83 1.7 1.08 1.95 1.2.24.12.37.1.5-.06l.75-.93c.17-.23.33-.2.54-.12.22.08 1.36.65 1.6.77.24.12.4.18.46.27.05.09.05.56-.15 1.1z";

type Props = {
  type: "signal" | "whatsapp";
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export function BridgeIcon({ type, size = 12, className, style }: Props) {
  const color = type === "signal" ? "#3A76F0" : "#25D366";
  const label = type === "signal" ? "Signal" : "WhatsApp";
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color}
      className={className}
      style={{ opacity: 0.7, flexShrink: 0, ...style }}
    >
      <title>{label}</title>
      <path d={type === "signal" ? SIGNAL_PATH : WHATSAPP_PATH} />
    </svg>
  );
}
