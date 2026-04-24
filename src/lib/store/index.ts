"use client";

import { create } from "zustand";
import type { MatrixClient } from "matrix-js-sdk";
import type { RoomItem } from "@/components/rooms/RoomListItem";
import type { TimelineItem } from "@/lib/matrix/model";
import type { OutboxItem } from "@/lib/matrix/outbox";

type Status = "idle" | "starting" | "ready" | "error";

export type AppState = {
  status: Status;
  userId: string | null;
  homeserver: string | null;
  displayNames: Map<string, string>;

  rooms: RoomItem[];
  selectedRoomId: string | null;
  timelines: Record<string, TimelineItem[]>;
  typing: Record<string, string[]>;
  connection: "online" | "offline" | "syncing";
  outbox: Record<string, OutboxItem[]>;
  outboxInFlight: Record<string, true>;
  outboxUploading: Record<string, number>;

  setStatus(s: Status): void;
  setSession(v: { userId: string | null; homeserver: string | null }): void;
  setRooms(rooms: RoomItem[]): void;
  upsertRoom(room: RoomItem): void;
  setTimeline(roomId: string, items: TimelineItem[]): void;
  patchTimeline(roomId: string, id: string, patch: Partial<TimelineItem>): void;
  selectRoom(id: string | null): void;
  setTyping(roomId: string, names: string[]): void;
  setConnection(v: AppState["connection"]): void;
  setDisplayName(userId: string, name: string): void;
  setOutbox(items: OutboxItem[]): void;
  setOutboxInFlight(id: string, on: boolean): void;
  setOutboxUploading(id: string, progress: number | null): void;
  removeOutboxItem(id: string): void;
};

export const useApp = create<AppState>((set) => ({
  status: "idle",
  userId: null,
  homeserver: null,
  displayNames: new Map(),
  rooms: [],
  selectedRoomId: null,
  timelines: {},
  typing: {},
  connection: "online",
  outbox: {},
  outboxInFlight: {},
  outboxUploading: {},

  setStatus: (status) => set({ status }),
  setSession: (v) => set(v),
  setRooms: (rooms) => set({ rooms }),
  upsertRoom: (room) =>
    set((s) => {
      const existing = s.rooms.findIndex((r) => r.id === room.id);
      const next = existing >= 0 ? [...s.rooms] : [...s.rooms, room];
      if (existing >= 0) next[existing] = room;
      next.sort((a, b) => b.timestamp - a.timestamp);
      return { rooms: next };
    }),
  setTimeline: (roomId, items) =>
    set((s) => ({ timelines: { ...s.timelines, [roomId]: items } })),
  patchTimeline: (roomId, id, patch) =>
    set((s) => {
      const list = s.timelines[roomId];
      if (!list) return s;
      const next = list.map((it) => (it.id === id ? { ...it, ...patch } : it));
      return { timelines: { ...s.timelines, [roomId]: next } };
    }),
  selectRoom: (id) => set({ selectedRoomId: id }),
  setTyping: (roomId, names) =>
    set((s) => ({ typing: { ...s.typing, [roomId]: names } })),
  setConnection: (connection) => set({ connection }),
  setDisplayName: (userId, name) =>
    set((s) => {
      const next = new Map(s.displayNames);
      next.set(userId, name);
      return { displayNames: next };
    }),
  setOutbox: (items) =>
    set(() => {
      const grouped: Record<string, OutboxItem[]> = {};
      for (const it of items) {
        (grouped[it.roomId] ??= []).push(it);
      }
      return { outbox: grouped };
    }),
  setOutboxInFlight: (id, on) =>
    set((s) => {
      const next = { ...s.outboxInFlight };
      if (on) next[id] = true;
      else delete next[id];
      return { outboxInFlight: next };
    }),
  removeOutboxItem: (id) =>
    set((s) => {
      const next: Record<string, OutboxItem[]> = {};
      for (const roomId of Object.keys(s.outbox)) {
        const filtered = s.outbox[roomId].filter((it) => it.id !== id);
        if (filtered.length > 0) next[roomId] = filtered;
      }
      const nextInFlight = { ...s.outboxInFlight };
      delete nextInFlight[id];
      const nextUploading = { ...s.outboxUploading };
      delete nextUploading[id];
      return { outbox: next, outboxInFlight: nextInFlight, outboxUploading: nextUploading };
    }),
  setOutboxUploading: (id, progress) =>
    set((s) => {
      const next = { ...s.outboxUploading };
      if (progress == null) delete next[id];
      else next[id] = progress;
      return { outboxUploading: next };
    }),
}));

export type WithClient = { client: MatrixClient };
