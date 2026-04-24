"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Image as ImageIcon,
  Copy,
  KeyRound,
  Laptop,
  Loader2,
  Monitor,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Avatar } from "@/components/common/Avatar";
import { getClient, setSecretStorageKey } from "@/lib/matrix/client";

type Tab = "profile" | "encryption" | "devices" | "about";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function SettingsDrawer({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50"
                style={{ background: "rgba(0,0,0,0.25)" }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.aside
                initial={{ x: "100%", opacity: 0.5 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0.5 }}
                transition={{ type: "spring", stiffness: 380, damping: 36 }}
                className="fixed right-0 top-0 z-50 flex h-dvh w-[min(440px,100dvw)] flex-col"
                style={{
                  background: "var(--surface)",
                  borderLeft: "1px solid var(--hairline)",
                }}
              >
                <header
                  className="flex items-center gap-3 px-5"
                  style={{ height: 56 }}
                >
                  <Dialog.Title className="text-xl font-medium">
                    Settings
                  </Dialog.Title>
                  <Dialog.Description className="sr-only">
                    Account, encryption, and device settings.
                  </Dialog.Description>
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close"
                      className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface-sunken)]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      <X size={18} strokeWidth={1.75} />
                    </button>
                  </Dialog.Close>
                </header>

                <nav
                  className="flex items-center gap-1 overflow-x-auto px-3 py-2"
                  style={{ borderBottom: "1px solid var(--hairline)" }}
                  role="tablist"
                  aria-label="Settings tabs"
                >
                  <TabButton active={tab === "profile"} onClick={() => setTab("profile")} icon={<User size={14} />}>
                    Profile
                  </TabButton>
                  <TabButton active={tab === "encryption"} onClick={() => setTab("encryption")} icon={<KeyRound size={14} />}>
                    Encryption
                  </TabButton>
                  <TabButton active={tab === "devices"} onClick={() => setTab("devices")} icon={<Laptop size={14} />}>
                    Devices
                  </TabButton>
                  <TabButton active={tab === "about"} onClick={() => setTab("about")} icon={<ShieldCheck size={14} />}>
                    About
                  </TabButton>
                </nav>

                <div className="flex-1 overflow-y-auto p-5">
                  {tab === "profile" && <ProfilePane />}
                  {tab === "encryption" && <EncryptionPane />}
                  {tab === "devices" && <DevicesPane />}
                  {tab === "about" && <AboutPane />}
                </div>
              </motion.aside>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
      style={
        active
          ? {
              background: "color-mix(in oklch, var(--accent-unread) 12%, transparent)",
              color: "var(--accent-unread)",
            }
          : { color: "var(--text-muted)" }
      }
    >
      {icon}
      {children}
    </button>
  );
}

/* ---------- Profile ---------- */

type AnyClientForProfile = {
  getUserId: () => string | null;
  getProfileInfo: (userId: string) => Promise<{ displayname?: string; avatar_url?: string }>;
  setDisplayName: (name: string) => Promise<unknown>;
  setAvatarUrl: (mxc: string) => Promise<unknown>;
  uploadContent: (
    file: File | Blob,
    opts?: { type?: string; name?: string }
  ) => Promise<{ content_uri: string }>;
};

function ProfilePane() {
  const client = getClient() as unknown as AnyClientForProfile | null;
  const userId = client?.getUserId() ?? "";
  const [displayName, setDisplayName] = useState("");
  const [avatarMxc, setAvatarMxc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!client || !userId) return;
    let cancelled = false;
    client
      .getProfileInfo(userId)
      .then((p) => {
        if (cancelled) return;
        setDisplayName(p.displayname ?? "");
        setAvatarMxc(p.avatar_url ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [client, userId]);

  async function uploadAvatar(file: File) {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      const res = await client.uploadContent(file, { type: file.type, name: file.name });
      await client.setAvatarUrl(res.content_uri);
      setAvatarMxc(res.content_uri);
      setSavedAt(Date.now());
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      await client.setDisplayName(displayName.trim());
      setSavedAt(Date.now());
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar name={displayName || userId} src={avatarMxc ?? undefined} size={64} />
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-60"
            style={{ border: "1px solid var(--border)", color: "var(--text)" }}
          >
            <ImageIcon size={14} strokeWidth={1.8} />
            Change picture
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAvatar(f);
              e.target.value = "";
            }}
          />
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            JPG, PNG, GIF — up to a few MB.
          </span>
        </div>
      </div>

      <Field label="Display name">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How others see you"
          className="input"
        />
      </Field>
      <Field label="Matrix ID">
        <div className="font-mono text-sm" style={{ color: "var(--text-muted)" }}>
          {userId}
        </div>
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveName}
          disabled={busy}
          className="inline-flex h-9 items-center justify-center rounded-xl px-3 text-sm font-medium text-white transition-[transform,opacity] active:scale-[0.98] disabled:opacity-60"
          style={{ background: "var(--accent-unread)" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Save"}
        </button>
        {savedAt > 0 && Date.now() - savedAt < 4_000 && (
          <span className="inline-flex items-center gap-1 text-sm" style={{ color: "var(--accent-success)" }}>
            <Check size={14} strokeWidth={2.2} />
            Saved
          </span>
        )}
        {error && <ErrorPill text={error} />}
      </div>

      <Style />
    </section>
  );
}

/* ---------- Encryption ---------- */

type KeyBackupInfo = { version?: string; algorithm?: string };
type RestoreResult = { imported?: number; total?: number };
type ActiveBackup = { backupInfo?: KeyBackupInfo; trustInfo?: { trusted?: boolean } };

type GeneratedKey = {
  privateKey: Uint8Array;
  encodedPrivateKey?: string;
  keyInfo?: unknown;
};

type CryptoApiSubset = {
  getKeyBackupInfo?: () => Promise<KeyBackupInfo | null>;
  getActiveSessionBackupVersion?: () => Promise<string | null>;
  checkKeyBackupAndEnable?: () => Promise<ActiveBackup | null>;
  storeSessionBackupPrivateKey?: (key: Uint8Array, version: string) => Promise<void>;
  loadSessionBackupPrivateKeyFromSecretStorage?: () => Promise<void>;
  restoreKeyBackup?: (opts?: Record<string, unknown>) => Promise<RestoreResult>;
  isKeyBackupTrusted?: (info: KeyBackupInfo) => Promise<{ trusted?: boolean }>;
  bootstrapSecretStorage?: (opts: {
    setupNewKeyBackup?: boolean;
    setupNewSecretStorage?: boolean;
    createSecretStorageKey?: () => Promise<GeneratedKey>;
  }) => Promise<void>;
  bootstrapCrossSigning?: (opts: {
    setupNewCrossSigning?: boolean;
    authUploadDeviceSigningKeys?: (makeRequest: (authData: Record<string, unknown> | null) => Promise<unknown>) => Promise<unknown>;
  }) => Promise<void>;
  getCrossSigningStatus?: () => Promise<{ publicKeysOnDevice: boolean; privateKeysInSecretStorage: boolean; privateKeysCachedLocally: { masterKey: boolean; selfSigningKey: boolean; userSigningKey: boolean } }>;
  isCrossSigningReady?: () => Promise<boolean>;
  createRecoveryKeyFromPassphrase?: (password?: string) => Promise<GeneratedKey>;
  deleteKeyBackupVersion?: (version: string) => Promise<void>;
  resetKeyBackup?: () => Promise<void>;
};

type AnyClientForCrypto = {
  getUserId: () => string | null;
  getDeviceId: () => string | null;
  getCrypto: () => CryptoApiSubset | null;
};

type BackupState = "checking" | "absent" | "untrusted" | "trusted";

function EncryptionPane() {
  const client = getClient() as unknown as AnyClientForCrypto | null;
  const [recovery, setRecovery] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backupState, setBackupState] = useState<BackupState>("checking");
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [crossSigningReady, setCrossSigningReady] = useState<boolean | null>(null);

  const refreshBackupState = async () => {
    if (!client) return;
    const crypto = client.getCrypto();
    if (!crypto?.getKeyBackupInfo) {
      setBackupState("absent");
      return;
    }
    try {
      const ready = await crypto.isCrossSigningReady?.().catch(() => false);
      setCrossSigningReady(ready ?? false);
    } catch {
      setCrossSigningReady(false);
    }
    try {
      const info = await crypto.getKeyBackupInfo();
      if (!info?.version) {
        setBackupState("absent");
        setServerVersion(null);
        return;
      }
      setServerVersion(info.version);
      const active = await crypto.getActiveSessionBackupVersion?.().catch(() => null);
      setActiveVersion(active ?? null);
      const trust = await crypto.isKeyBackupTrusted?.(info).catch(() => undefined);
      const trusted = Boolean(trust?.trusted) && active === info.version;
      setBackupState(trusted ? "trusted" : "untrusted");
    } catch {
      setBackupState("absent");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshBackupState();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  async function trustExisting() {
    if (!client) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const crypto = client.getCrypto();
      if (!crypto?.checkKeyBackupAndEnable) throw new Error("Encryption is not initialized.");
      const active = await crypto.checkKeyBackupAndEnable();
      if (active?.backupInfo?.version) {
        setStatus(`Now backing up to version ${active.backupInfo.version}.`);
        await refreshBackupState();
      } else {
        setStatus("Backup not trusted. Restore with your recovery key first.");
      }
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!client) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const crypto = client.getCrypto();
      if (!crypto?.restoreKeyBackup || !crypto.loadSessionBackupPrivateKeyFromSecretStorage || !crypto.getKeyBackupInfo) {
        throw new Error("Encryption is not initialized.");
      }
      const info = await crypto.getKeyBackupInfo();
      if (!info?.version) throw new Error("No key backup found on the server.");

      const { decodeRecoveryKey } = await import("matrix-js-sdk/lib/crypto-api/recovery-key");
      let decoded: Uint8Array;
      try {
        decoded = decodeRecoveryKey(recovery.trim());
      } catch {
        throw new Error("That recovery key isn't valid. Check spacing and try again.");
      }

      // Stage the SSSS key so the SDK can fetch the actual backup decryption key from secret storage.
      setSecretStorageKey(decoded);

      // Fetch the backup decryption key from SSSS and store it in the crypto store.
      await crypto.loadSessionBackupPrivateKeyFromSecretStorage();

      const result = await crypto.restoreKeyBackup({});
      const imported = result?.imported ?? 0;
      const total = result?.total ?? 0;

      let trustMsg = "";
      try {
        const active = await crypto.checkKeyBackupAndEnable?.();
        if (active?.backupInfo?.version) {
          trustMsg = ` Now backing up to ${active.backupInfo.version}.`;
        }
      } catch {
        /* enable failed */
      }

      setStatus(`Restored ${imported}${total ? ` of ${total}` : ""} keys.${trustMsg}`);
      setRecovery("");
      await refreshBackupState();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSecretStorageKey(null);
      setBusy(false);
    }
  }

  async function bootstrapCrossSigningWithAuth() {
    if (!client) return;
    const crypto = client.getCrypto();
    if (!crypto?.bootstrapCrossSigning) {
      setError("Encryption is not initialized.");
      return;
    }
    const recoveryInput = window.prompt("Enter your recovery key to unlock secret storage:");
    if (!recoveryInput) return;
    const password = window.prompt("Enter your account password to upload cross-signing keys:");
    if (!password) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    try {
      const { decodeRecoveryKey } = await import("matrix-js-sdk/lib/crypto-api/recovery-key");
      let decoded: Uint8Array;
      try {
        decoded = decodeRecoveryKey(recoveryInput.trim());
      } catch {
        throw new Error("That recovery key isn't valid. Check spacing and try again.");
      }
      setSecretStorageKey(decoded);
      const userId = client.getUserId?.() ?? "";
      const localpart = userId.replace(/^@/, "").split(":")[0];
      await crypto.bootstrapCrossSigning({
        setupNewCrossSigning: true,
        authUploadDeviceSigningKeys: async (makeRequest) => {
          await makeRequest({
            type: "m.login.password",
            identifier: { type: "m.id.user", user: localpart },
            password,
          });
        },
      });
      setStatus("Cross-signing set up. Your device is now trusted.");
      await refreshBackupState();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSecretStorageKey(null);
      setBusy(false);
    }
  }

  async function generateNewRecoveryKey() {
    if (!client) return;
    const confirmed = confirm(
      "Generate a new recovery key? This replaces the server key backup. Historical encrypted messages may become unreadable unless you still have the session keys on another device. The old recovery phrase will stop working."
    );
    if (!confirmed) return;
    setBusy(true);
    setStatus(null);
    setError(null);
    setNewRecoveryKey(null);
    setCopiedKey(false);
    try {
      const crypto = client.getCrypto();
      if (!crypto?.bootstrapSecretStorage || !crypto.createRecoveryKeyFromPassphrase) {
        throw new Error("This SDK build can't reset the recovery key.");
      }

      const priorVersion = serverVersion;
      const generated = await crypto.createRecoveryKeyFromPassphrase();
      const display = generated.encodedPrivateKey;
      if (!display) throw new Error("Failed to encode the new recovery key.");
      if (generated.privateKey) setSecretStorageKey(generated.privateKey);

      if (crypto.bootstrapCrossSigning) {
        try {
          const userId = client.getUserId?.() ?? "";
          const localpart = userId.replace(/^@/, "").split(":")[0];
          await crypto.bootstrapCrossSigning({
            setupNewCrossSigning: true,
            authUploadDeviceSigningKeys: async (makeRequest) => {
              await makeRequest({
                type: "m.login.password",
                identifier: { type: "m.id.user", user: localpart },
                password: window.prompt("Enter your account password to upload cross-signing keys:") ?? "",
              });
            },
          });
        } catch {
          /* continue */
        }
      }

      await crypto.bootstrapSecretStorage({
        setupNewSecretStorage: true,
        setupNewKeyBackup: true,
        createSecretStorageKey: async () => generated,
      });

      if (priorVersion && crypto.deleteKeyBackupVersion) {
        try {
          await crypto.deleteKeyBackupVersion(priorVersion);
        } catch {
          /* best-effort */
        }
      }

      setNewRecoveryKey(display);
      setStatus("New recovery key created. Save it NOW — this is the only time it will be shown.");
      await refreshBackupState();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setSecretStorageKey(null);
      setBusy(false);
    }
  }

  async function copyNewKey() {
    if (!newRecoveryKey) return;
    try {
      await navigator.clipboard.writeText(newRecoveryKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function resetCryptoStore() {
    if (!confirm("Wipe local crypto state? You'll lose access to historical E2EE messages until you restore from backup or verify another device. Sign-in is preserved.")) return;
    const dbs = await (indexedDB as unknown as { databases?: () => Promise<{ name?: string }[]> })
      .databases?.()
      .catch(() => []);
    if (!dbs) return;
    await Promise.all(
      dbs
        .map((d) => d.name)
        .filter((n): n is string => typeof n === "string" && /matrix.*crypto|crypto.*store/i.test(n))
        .map(
          (name) =>
            new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(name);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
            })
        )
    );
    setStatus("Crypto store cleared. Reload the app to re-initialize.");
  }

  const pillBg: Record<BackupState, string> = {
    trusted: "color-mix(in oklch, var(--accent-success) 18%, transparent)",
    untrusted: "color-mix(in oklch, var(--accent-warning) 22%, transparent)",
    absent: "color-mix(in oklch, var(--text) 8%, transparent)",
    checking: "color-mix(in oklch, var(--text) 8%, transparent)",
  };
  const pillFg: Record<BackupState, string> = {
    trusted: "var(--accent-success)",
    untrusted: "var(--accent-warning)",
    absent: "var(--text-muted)",
    checking: "var(--text-muted)",
  };
  const pillLabel: Record<BackupState, string> = {
    trusted: "trusted",
    untrusted: "not trusted",
    absent: "no backup",
    checking: "checking",
  };

  return (
    <section className="space-y-6">
      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--surface-sunken)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} strokeWidth={2} style={{ color: "var(--accent-unread)" }} />
          <span className="text-sm font-medium">Key backup</span>
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: pillBg[backupState], color: pillFg[backupState] }}
          >
            {pillLabel[backupState]}
          </span>
        </div>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
          {backupState === "trusted"
            ? `This device is uploading new message keys to backup version ${activeVersion ?? "?"}.`
            : backupState === "untrusted"
            ? `Server has backup version ${serverVersion ?? "?"} but this device has not trusted it. Restore with your recovery key, then keys upload automatically.`
            : backupState === "absent"
            ? "No key backup is set up on the server. Generate one in Element to enable cross-device decryption."
            : "Paste your recovery key (sometimes called Security Phrase) to restore your message keys on this device. Generated in another client like Element when you set up secure backup."}
        </p>
        {backupState === "untrusted" && (
          <button
            type="button"
            onClick={trustExisting}
            disabled={busy}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--accent-unread)" }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Try to trust existing key"}
          </button>
        )}
        {crossSigningReady !== true ? (
          <button
            type="button"
            onClick={bootstrapCrossSigningWithAuth}
            disabled={busy}
            className="mt-3 inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--accent-unread)" }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : "Set up cross-signing"}
          </button>
        ) : (
          <p className="mt-2 text-xs" style={{ color: "var(--accent-success)" }}>
            <Check size={12} className="inline" /> Cross-signing is active — this device is trusted.
          </p>
        )}
      </div>

      <Field label="Recovery key or phrase">
        <textarea
          rows={3}
          value={recovery}
          onChange={(e) => setRecovery(e.target.value)}
          placeholder="EsTb 1234 5678 …"
          className="input font-mono"
          spellCheck={false}
          autoComplete="off"
          style={{ resize: "vertical", minHeight: 76 }}
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={restore}
          disabled={busy || recovery.trim().length === 0}
          className="inline-flex h-9 items-center justify-center rounded-xl px-3 text-sm font-medium text-white transition-[transform,opacity] active:scale-[0.98] disabled:opacity-60"
          style={{ background: "var(--accent-unread)" }}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : "Restore keys"}
        </button>
        {status && (
          <span className="inline-flex items-center gap-1 text-sm" style={{ color: "var(--accent-success)" }}>
            <Check size={14} strokeWidth={2.2} />
            {status}
          </span>
        )}
        {error && <ErrorPill text={error} />}
      </div>

      <div style={{ borderTop: "1px solid var(--hairline)" }} className="pt-5">
        <h3 className="text-base font-medium" style={{ color: "var(--text)" }}>
          Trouble?
        </h3>
        <p className="mt-1.5 text-sm" style={{ color: "var(--text-muted)" }}>
          If the app keeps failing to start crypto (account mismatch, schema errors), you can wipe
          the local crypto store. Your sign-in stays — only message keys are removed.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={generateNewRecoveryKey}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--accent-unread)" }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} strokeWidth={2} />}
            <span>Generate new recovery key</span>
          </button>
          <button
            type="button"
            onClick={resetCryptoStore}
            className="inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-medium hover:bg-[var(--surface-sunken)]"
            style={{ border: "1px solid color-mix(in oklch, var(--accent-danger) 30%, transparent)", color: "var(--accent-danger)" }}
          >
            Reset local crypto state
          </button>
        </div>
        {newRecoveryKey && (
          <div
            className="mt-3 rounded-xl p-3"
            style={{
              background: "var(--surface-sunken)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={14} style={{ color: "var(--accent-warning)" }} />
              <span className="text-sm font-medium">Save this recovery key somewhere safe</span>
            </div>
            <pre
              className="mt-2 whitespace-pre-wrap break-all rounded-lg p-2 font-mono text-sm"
              style={{ background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-subtle)" }}
            >
              {newRecoveryKey}
            </pre>
            <button
              type="button"
              onClick={copyNewKey}
              className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium hover:bg-[var(--surface-sunken)]"
              style={{ border: "1px solid var(--border-subtle)", color: "var(--text)" }}
            >
              {copiedKey ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedKey ? "Copied" : "Copy"}</span>
            </button>
          </div>
        )}
      </div>

      <Style />
    </section>
  );
}

/* ---------- Devices ---------- */

type DeviceInfo = {
  device_id: string;
  display_name?: string | null;
  last_seen_ip?: string | null;
  last_seen_ts?: number | null;
};

type AnyClientForDevices = {
  getDeviceId: () => string | null;
  getDevices: () => Promise<{ devices: DeviceInfo[] }>;
  deleteDevice: (id: string, auth?: Record<string, unknown>) => Promise<unknown>;
  deleteMultipleDevices?: (ids: string[], auth?: Record<string, unknown>) => Promise<unknown>;
};

function DevicesPane() {
  const client = getClient() as unknown as AnyClientForDevices | null;
  const [devices, setDevices] = useState<DeviceInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ownId = client?.getDeviceId() ?? null;

  const refresh = async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.getDevices();
      const list = res?.devices ?? [];
      list.sort((a, b) => (b.last_seen_ts ?? 0) - (a.last_seen_ts ?? 0));
      setDevices(list);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function removeDevice(id: string) {
    if (!client) return;
    if (id === ownId) {
      if (!confirm("Sign out this device? You will be returned to the login screen.")) return;
    } else {
      if (!confirm("Sign out this device? Its messages will keep working until it next contacts the homeserver.")) return;
    }
    setRemovingId(id);
    setError(null);
    try {
      await client.deleteDevice(id);
      await refresh();
    } catch (err) {
      const msg = messageOf(err);
      setError(
        /interactive auth|401|Unauthorized/i.test(msg)
          ? "Your homeserver requires re-authentication to remove devices. Sign out and back in, then try again."
          : msg
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-medium" style={{ color: "var(--text)" }}>
          Active sessions
        </h3>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium hover:bg-[var(--surface-sunken)]"
          style={{ color: "var(--text-muted)" }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : "Refresh"}
        </button>
      </div>

      {error && <ErrorPill text={error} />}

      {!devices && loading && (
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          Loading…
        </div>
      )}

      {devices && devices.length === 0 && !loading && (
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          No devices reported.
        </div>
      )}

      <ul className="space-y-2">
        {devices?.map((d) => {
          const isOwn = d.device_id === ownId;
          const lastSeen = d.last_seen_ts ? new Date(d.last_seen_ts).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "Unknown";
          const Icon = pickDeviceIcon(d.display_name ?? "");
          return (
            <li
              key={d.device_id}
              className="flex items-start gap-3 rounded-xl p-3"
              style={{
                background: isOwn ? "color-mix(in oklch, var(--accent-unread) 6%, var(--surface-sunken))" : "var(--surface-sunken)",
              }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: "var(--surface)", border: "1px solid var(--border-subtle)" }}
              >
                <Icon size={16} strokeWidth={1.8} style={{ color: "var(--text-muted)" }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">
                    {d.display_name?.trim() || "Unnamed device"}
                  </span>
                  {isOwn && (
                    <span
                      className="rounded-full px-2 py-0.5 text-[10.5px] font-medium"
                      style={{
                        background: "color-mix(in oklch, var(--accent-unread) 18%, transparent)",
                        color: "var(--accent-unread)",
                      }}
                    >
                      this device
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-xs" style={{ color: "var(--text-faint)" }}>
                  {d.device_id}
                </div>
                <div className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                  Last seen {lastSeen}
                  {d.last_seen_ip ? ` · ${d.last_seen_ip}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void removeDevice(d.device_id)}
                disabled={removingId === d.device_id}
                aria-label="Sign out device"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--surface)]"
                style={{ color: "var(--accent-danger)" }}
              >
                {removingId === d.device_id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} strokeWidth={1.8} />}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function pickDeviceIcon(displayName: string) {
  const n = displayName.toLowerCase();
  if (/iphone|ipad|android|mobile|phone/.test(n)) return Smartphone;
  if (/web|browser|chrome|safari|firefox|matrix web/.test(n)) return Monitor;
  return Laptop;
}

/* ---------- About ---------- */

type AnyClientForAbout = {
  getUserId: () => string | null;
  getDeviceId: () => string | null;
  baseUrl?: string;
  getHomeserverUrl?: () => string;
};

function AboutPane() {
  const client = getClient() as unknown as AnyClientForAbout | null;
  const userId = client?.getUserId() ?? "";
  const deviceId = client?.getDeviceId() ?? "";
  const homeserver = client?.getHomeserverUrl?.() ?? client?.baseUrl ?? "";

  return (
    <section className="space-y-4 text-sm">
      <Row label="Matrix ID" value={userId} mono />
      <Row label="Device ID" value={deviceId} mono />
      <Row label="Homeserver" value={homeserver} mono />
      <Row label="Client" value="Matrix Web · v0.1.0" />
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div
        className={mono ? "font-mono text-sm break-all" : "text-sm"}
        style={{ color: "var(--text)" }}
      >
        {value}
      </div>
    </div>
  );
}

/* ---------- shared bits ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function ErrorPill({ text }: { text: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
      style={{
        background: "color-mix(in oklch, var(--accent-danger) 10%, transparent)",
        color: "var(--accent-danger)",
        border: "1px solid color-mix(in oklch, var(--accent-danger) 30%, transparent)",
      }}
    >
      <AlertCircle size={12} strokeWidth={2.2} />
      {text}
    </span>
  );
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Something went wrong.";
}

function Style() {
  return (
    <style jsx>{`
      :global(.input) {
        width: 100%;
        background: var(--surface-sunken);
        color: var(--text);
        border: 1px solid var(--border-subtle);
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 14px;
        outline: none;
        transition: box-shadow 160ms var(--ease-out);
      }
      :global(.input:focus) {
        box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent-unread) 40%, transparent);
        border-color: color-mix(in oklch, var(--accent-unread) 60%, var(--border));
      }
    `}</style>
  );
}
