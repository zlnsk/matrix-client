"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MatrixClient } from "matrix-js-sdk";
import { getClient, restoreClient, logout } from "@/lib/matrix/client";
import { attachSync } from "@/lib/matrix/sync";
import { attachNotifications, maybePromptOnFirstRun } from "@/lib/notifications";
import { useApp } from "@/lib/store";
import { attachOutboxDrainer } from "@/lib/matrix/outboxDrain";
import { listAll as listOutbox, subscribeOutbox } from "@/lib/matrix/outbox";
import { clearSession, wipeMatrixStorage } from "@/lib/matrix/session";

/**
 * Boot the Matrix client from persisted session on mount. Redirects to /login
 * if no session exists. Attaches the sync → Zustand bridge while mounted.
 */
export function useMatrixBoot(): { client: MatrixClient | null; booted: boolean } {
  const router = useRouter();
  const [client, setClient] = useState<MatrixClient | null>(getClient());
  const [booted, setBooted] = useState(Boolean(getClient()));

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (navigator.onLine === false) useApp.getState().setConnection("offline");
    const onOnline = () => useApp.getState().setConnection("online");
    const onOffline = () => useApp.getState().setConnection("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let detachSync2: (() => void) | null = null;
    let detachNotif: (() => void) | null = null;
    let detachOutbox: (() => void) | null = null;
    let detachOutboxSub: (() => void) | null = null;
    const state = useApp.getState();

    let refreshVersion = 0;
    const refreshOutbox = async () => {
      const v = ++refreshVersion;
      try {
        const all = await listOutbox();
        if (v !== refreshVersion) return;
        useApp.getState().setOutbox(all);
      } catch {
        /* IDB unavailable — ignore */
      }
    };

    const finishBoot = (c: MatrixClient) => {
      detachSync2 = attachSync(c);
      detachNotif = attachNotifications(c);
      detachOutbox = attachOutboxDrainer(c);
      detachOutboxSub = subscribeOutbox(() => void refreshOutbox());
      void refreshOutbox();
      maybePromptOnFirstRun();
      state.setStatus("ready");
      state.setSession({
        userId: c.getUserId(),
        homeserver: (c as unknown as { baseUrl?: string }).baseUrl ?? null,
      });

      // Runtime safety net: if the server invalidates our token while the app
      // is running (e.g. device deleted), the SDK emits Session.logged_out.
      // Force a clean logout so the user can re-authenticate.
      const onLoggedOut = () => {
        console.warn("[matrix] Session invalidated at runtime — forcing logout");
        void logout().then(() => {
          if (!disposed) router.replace("/login");
        });
      };
      (c as unknown as { on?: (ev: string, fn: (...args: unknown[]) => void) => void }).on?.(
        "Session.logged_out",
        onLoggedOut
      );
    };

    (async () => {
      // If a singleton already exists, its token may have gone stale since the
      // last mount (e.g. device was deleted in another tab). Validate before reuse.
      if (getClient()) {
        const c = getClient()!;
        try {
          const hs = (c as unknown as { baseUrl?: string }).baseUrl ?? "";
          const res = await fetch(hs + "/_matrix/client/v3/account/whoami", {
            headers: {
              Authorization:
                "Bearer " + (c as unknown as { getAccessToken: () => string }).getAccessToken(),
            },
          });
          if (!res.ok && res.status === 401) {
            await logout();
            if (!disposed) router.replace("/login");
            if (!disposed) setBooted(true);
            return;
          }
        } catch {
          /* offline — continue boot with existing singleton */
        }
        finishBoot(c);
        if (!disposed) {
          setClient(c);
          setBooted(true);
        }
        return;
      }

      state.setStatus("starting");
      const c = await restoreClient();
      if (disposed) return;
      if (!c) {
        router.replace("/login");
        setBooted(true);
        return;
      }

      // Validate token before booting — old deleted devices cause M_UNKNOWN_TOKEN
      try {
        const hs = (c as unknown as { baseUrl?: string }).baseUrl ?? "";
        const res = await fetch(hs + "/_matrix/client/v3/account/whoami", {
          headers: {
            Authorization:
              "Bearer " + (c as unknown as { getAccessToken: () => string }).getAccessToken(),
          },
        });
        if (!res.ok && res.status === 401) {
          await logout();
          if (!disposed) router.replace("/login");
          if (!disposed) setBooted(true);
          return;
        }
      } catch {
        /* offline — continue boot */
      }

      finishBoot(c);
      if (!disposed) {
        setClient(c);
        setBooted(true);
      }
    })();

    return () => {
      disposed = true;
      detachSync2?.();
      detachNotif?.();
      detachOutbox?.();
      detachOutboxSub?.();
    };
  }, [router]);

  return { client, booted };
}
