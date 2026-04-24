const HOUR_MIN_FMT = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
const DAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" });
const DATE_FMT = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" });

function validTs(ts: unknown): ts is number {
  return typeof ts === "number" && Number.isFinite(ts) && Math.abs(ts) < 8.64e15;
}

export function formatTime(ts: number): string {
  if (!validTs(ts)) return "";
  return HOUR_MIN_FMT.format(ts);
}

export function formatDayLabel(ts: number): string {
  if (!validTs(ts)) return "";
  const now = new Date();
  const d = new Date(ts);
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((dayStart(now) - dayStart(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return DAY_FMT.format(ts);
  return DATE_FMT.format(ts);
}

export function formatSidebarTime(ts: number): string {
  if (!validTs(ts)) return "";
  const now = Date.now();
  const diffMs = now - ts;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);
  if (diffMin < 1) return "Now";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay === 1) return "Yesterday";
  const d = new Date(ts);
  const nowDate = new Date(now);
  const sameWeek =
    diffDay < 7 &&
    d.getDay() <= nowDate.getDay();
  if (sameWeek) return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(ts);
  return new Intl.DateTimeFormat(undefined, { month: "numeric", day: "numeric" }).format(ts);
}

export function sameMinute(a: number, b: number, windowMin = 5): boolean {
  if (!validTs(a) || !validTs(b)) return false;
  return Math.abs(a - b) < windowMin * 60_000;
}
