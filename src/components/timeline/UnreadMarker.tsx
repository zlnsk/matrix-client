"use client";

export function UnreadMarker({ count }: { count: number }) {
  return (
    <div className="sticky top-2 z-10 my-3 flex items-center gap-2 px-3">
      <div className="flex-1" style={{ height: 1, background: "color-mix(in oklch, var(--accent-unread) 40%, transparent)" }} />
      <span
        className="font-tnum"
        style={{
          fontSize: 11,
          color: "var(--accent-unread)",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {count} Unread
      </span>
      <div className="flex-1" style={{ height: 1, background: "color-mix(in oklch, var(--accent-unread) 40%, transparent)" }} />
    </div>
  );
}
