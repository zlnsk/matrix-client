"use client";

import { Avatar } from "@/components/common/Avatar";

type Props = { names: string[] };

export function TypingIndicator({ names }: Props) {
  if (names.length === 0) return null;
  const first = names[0] ?? "";
  const label =
    names.length === 1
      ? `${first} is typing`
      : names.length === 2
      ? `${first} and ${names[1]} are typing`
      : `${first} and ${names.length - 1} others are typing`;
  return (
    <div className="mt-2 flex items-end gap-2 pr-10" aria-live="polite">
      <div className="w-9 mr-0 flex-shrink-0">
        <Avatar name={first} size={32} />
      </div>
      <div
        className="relative inline-flex items-center gap-1"
        style={{
          background: "var(--bubble-other-bg)",
          color: "var(--bubble-other-text)",
          padding: "10px 14px",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
          borderBottomLeftRadius: 6,
          boxShadow: "var(--bubble-other-shadow)",
          border: "1px solid var(--border-subtle)",
        }}
        aria-label={label}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: "var(--text-muted)",
              animation: `dot-bounce 1.25s ${i * 0.15}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
