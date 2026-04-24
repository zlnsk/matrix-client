import type { RoomItem } from "@/components/rooms/RoomListItem";
import type { BubbleProps } from "@/components/timeline/Bubble";
import type { Reaction } from "@/components/reactions/ReactionRow";

const now = Date.now();
const m = (n: number) => now - n * 60_000;
const h = (n: number) => now - n * 3_600_000;
const d = (n: number) => now - n * 86_400_000;

export const mockRooms: RoomItem[] = [
  {
    id: "r-alma",
    name: "Alma Winters",
    preview: "Of course — I'll send it over tonight ✨",
    timestamp: m(2),
    unread: 3,
    encrypted: true,
  },
  {
    id: "r-design",
    name: "Design Crit",
    preview: "Ilya: the gradient looks better on dark",
    timestamp: m(18),
    unread: 12,
    encrypted: true,
  },
  {
    id: "r-jun",
    name: "Jun Park",
    preview: "👀",
    previewSelf: false,
    timestamp: m(42),
    unread: 1,
    encrypted: true,
  },
  {
    id: "r-fam",
    name: "Family",
    preview: "You: pictures inbound",
    previewSelf: true,
    timestamp: h(4),
    unread: 0,
    encrypted: false,
    muted: true,
  },
  {
    id: "r-lab",
    name: "#matrix-lab",
    preview: "erik: federation is cooking tonight",
    timestamp: h(6),
    unread: 0,
    encrypted: false,
  },
  {
    id: "r-bank",
    name: "Bank Alerts",
    preview: "You spent €42 at SuperBrugsen.",
    timestamp: h(9),
    unread: 0,
    muted: true,
    encrypted: false,
  },
  {
    id: "r-sasha",
    name: "Sasha (tuwunel-ops)",
    preview: "rolled back the migration — all clean",
    timestamp: d(1),
    unread: 0,
    encrypted: true,
  },
  {
    id: "r-launch",
    name: "Launch Room 🚀",
    preview: "Teresa: see pinned checklist",
    timestamp: d(2),
    unread: 0,
    encrypted: false,
  },
];

const reactions1: Reaction[] = [
  { key: "🔥", emoji: "🔥", count: 4, mine: true },
  { key: "❤️", emoji: "❤️", count: 2, mine: false },
];
const reactions2: Reaction[] = [{ key: "🙌", emoji: "🙌", count: 1, mine: false }];

type Message = BubbleProps & {
  isGroupStart: boolean;
  isGroupEnd: boolean;
};

export const mockTimeline: Message[] = [
  {
    id: "m1",
    body: "I pushed the bubble tail fix — gradient now carries through the SVG properly, no seam.",
    timestamp: d(1) + 1000 * 60 * 60 * 10,
    own: false,
    senderName: "Alma Winters",
    isGroupStart: true,
    isGroupEnd: true,
    showTail: true,
    showHeader: true,
    encrypted: true,
  },
  {
    id: "m2",
    body: "Gorgeous. Signal's was bugging me forever.",
    timestamp: d(1) + 1000 * 60 * 60 * 10 + 60_000,
    own: true,
    senderName: "You",
    sendState: "read",
    isGroupStart: true,
    isGroupEnd: false,
    showTail: false,
    showHeader: true,
  },
  {
    id: "m3",
    body: "Also wired up the rainbow sheen on send — single-pass, respects reduced-motion.",
    timestamp: d(1) + 1000 * 60 * 60 * 10 + 90_000,
    own: true,
    senderName: "You",
    sendState: "read",
    isGroupStart: false,
    isGroupEnd: true,
    showTail: true,
    showHeader: false,
    reactions: reactions1,
  },
  {
    id: "m4",
    body: "Allo with Signal's calm. Let me poke holes.",
    timestamp: m(120),
    own: false,
    senderName: "Alma Winters",
    isGroupStart: true,
    isGroupEnd: false,
    showTail: false,
    showHeader: true,
    encrypted: true,
  },
  {
    id: "m5",
    body: "Timestamps are tabular nums, right? Otherwise they'll wiggle.",
    timestamp: m(119),
    own: false,
    senderName: "Alma Winters",
    isGroupStart: false,
    isGroupEnd: true,
    showTail: true,
    showHeader: false,
    encrypted: true,
    reactions: reactions2,
  },
  {
    id: "m6",
    body: "Yep — font-feature tabular-nums on all clocks.",
    timestamp: m(118),
    own: true,
    senderName: "You",
    sendState: "read",
    isGroupStart: true,
    isGroupEnd: true,
    showTail: true,
    showHeader: true,
    replyTo: { senderName: "Alma Winters", body: "Timestamps are tabular nums, right?" },
  },
  {
    id: "m7",
    body: "Of course — I'll send it over tonight ✨",
    timestamp: m(2),
    own: false,
    senderName: "Alma Winters",
    isGroupStart: true,
    isGroupEnd: true,
    showTail: true,
    showHeader: true,
    encrypted: true,
  },
];
