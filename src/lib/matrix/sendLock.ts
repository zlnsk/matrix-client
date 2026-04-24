"use client";

// Per-MatrixClient mutex so only one Matrix send is in flight at a time.
// matrix-js-sdk 41 + rust-crypto can otherwise assign the same megolm
// message index to two concurrent encryptions, which the bridge rejects as
// "duplicate megolm message index N".

import type { MatrixClient } from "matrix-js-sdk";

const tails = new WeakMap<MatrixClient, Promise<unknown>>();

export function lockedSend<T>(
  client: MatrixClient,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = tails.get(client) ?? Promise.resolve();
  const next = prev.catch(() => undefined).then(fn);
  tails.set(client, next);
  return next;
}
