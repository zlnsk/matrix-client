"use client";

/**
 * SVG tail for the last bubble in a consecutive run. The own-side tail uses the
 * same gradient as the bubble fill, so there's no visible seam across the join.
 * Other-side tail uses a solid color pulled from --bubble-other-bg at runtime.
 */
type Props = { side: "own" | "other"; gradientId: string };

export function BubbleTail({ side, gradientId }: Props) {
  const isOwn = side === "own";
  const common: React.CSSProperties = {
    position: "absolute",
    bottom: 0,
    width: 14,
    height: 18,
    pointerEvents: "none",
  };

  if (isOwn) {
    return (
      <svg
        aria-hidden
        width={14}
        height={18}
        viewBox="0 0 14 18"
        style={{ ...common, right: -7 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="50%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        {/* Matches the bubble's bottom-right corner, sweeps down and to the right. */}
        <path
          d="M0 0 Q0 18 14 18 Q6 16 2 6 Q0 4 0 0 Z"
          fill={`url(#${gradientId})`}
        />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden
      width={14}
      height={18}
      viewBox="0 0 14 18"
      style={{ ...common, left: -7 }}
    >
      <path
        d="M14 0 Q14 18 0 18 Q8 16 12 6 Q14 4 14 0 Z"
        fill="var(--bubble-other-bg)"
        stroke="var(--border-subtle)"
        strokeWidth={1}
      />
    </svg>
  );
}
