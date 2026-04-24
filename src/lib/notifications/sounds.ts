"use client";

// Synthesized iPhone-style notification tones via Web Audio API.
// No binary assets — two short sine-wave chirps, 150–220ms total.

let ctxPromise: Promise<AudioContext> | null = null;

function getCtx(): Promise<AudioContext> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (ctxPromise) return ctxPromise;
  const AC =
    (window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as Window & { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return Promise.reject(new Error("AudioContext unavailable"));
  const ctx = new AC();
  ctxPromise = Promise.resolve(ctx);
  return ctxPromise;
}

async function tone(freq: number, startOffset: number, duration: number, gain: number): Promise<void> {
  const ctx = await getCtx();
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      /* iOS needs a user gesture; give up silently */
    }
  }
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + startOffset;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

const MUTE_KEY = "matrix:sounds:muted";

export function areSoundsMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundsMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (muted) window.localStorage.setItem(MUTE_KEY, "1");
    else window.localStorage.removeItem(MUTE_KEY);
  } catch {
    /* ignore */
  }
}

// Incoming: two rising sine notes, ~220ms total. Evokes the iMessage ping
// without copying the Apple Tri-tone sample.
export function playIncomingSound(): void {
  if (areSoundsMuted()) return;
  void tone(880, 0, 0.13, 0.16);
  void tone(1320, 0.09, 0.14, 0.14);
}

// Sent: short descending pluck, ~140ms. Evokes the iMessage whoosh.
export function playSentSound(): void {
  if (areSoundsMuted()) return;
  void tone(1000, 0, 0.06, 0.12);
  void tone(600, 0.04, 0.1, 0.1);
}
