"use client";

import { useEffect, useState } from "react";
import { resolveMediaUrl, type EncryptedFileInfo } from "@/lib/matrix/media";

export type UseMediaOpts = {
  encryptedFile?: EncryptedFileInfo;
  mimeType?: string;
};

export function useMedia(
  src: string | null | undefined,
  width = 96,
  height = 96,
  opts?: UseMediaOpts
): string | null {
  const [url, setUrl] = useState<string | null>(() =>
    opts?.encryptedFile ? null : passthrough(src) ?? null
  );

  const encKey = opts?.encryptedFile
    ? `${opts.encryptedFile.url}|${opts.encryptedFile.iv}`
    : null;

  useEffect(() => {
    if (!opts?.encryptedFile) {
      const direct = passthrough(src);
      if (direct !== undefined) {
        setUrl(direct);
        return;
      }
    }
    const mxc = opts?.encryptedFile?.url ?? src;
    if (!mxc) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    const p = resolveMediaUrl(
      mxc,
      width,
      height,
      "crop",
      opts?.encryptedFile
        ? { encryptedFile: opts.encryptedFile, mimeType: opts.mimeType }
        : undefined
    );
    if (!p) {
      setUrl(null);
      return;
    }
    setUrl(null);
    p.then((u) => {
      if (!cancelled) setUrl(u);
    }).catch(() => {
      if (!cancelled) setUrl(null);
    });
    return () => {
      cancelled = true;
    };
  }, [src, width, height, encKey, opts?.mimeType]);

  return url;
}

function passthrough(src: string | null | undefined): string | null | undefined {
  if (src == null) return null;
  if (/^(https?:|blob:|data:)/.test(src)) return src;
  if (src.startsWith("mxc://")) return undefined;
  return null;
}
