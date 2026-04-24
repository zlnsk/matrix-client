"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type Props = {
  src: string | null;
  alt?: string;
  onClose: () => void;
};

export function ImageViewer({ src, alt, onClose }: Props) {
  const [zoomed, setZoomed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!src) {
      setZoomed(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [src, onClose]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoomed || !scrollRef.current) return;
    // Only primary-button (or touch/pen)
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const el = scrollRef.current;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* some browsers refuse on non-primary */
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: el.scrollLeft,
      startScrollTop: el.scrollTop,
      moved: false,
    };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const el = scrollRef.current;
    if (!d || !el || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) d.moved = true;
    el.scrollLeft = d.startScrollLeft - dx;
    el.scrollTop = d.startScrollTop - dy;
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    try {
      scrollRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    // Keep dragRef set for the brief moment the click event fires, so the
    // image's onClick can suppress the zoom toggle when this was a drag.
    setDragging(false);
    const wasDrag = d.moved;
    if (wasDrag) {
      // Clear after click phase; otherwise a future click won't toggle.
      window.setTimeout(() => {
        dragRef.current = null;
      }, 0);
    } else {
      dragRef.current = null;
    }
  };

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          key="viewer"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
          style={{
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}
        >
          <button
            type="button"
            aria-label="Close image"
            onClick={onClose}
            className="absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-white"
            style={{
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.18)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <X size={18} strokeWidth={2} />
          </button>
          <motion.div
            ref={scrollRef}
            onClick={(e) => {
              e.stopPropagation();
              if (zoomed && !dragRef.current?.moved) setZoomed(false);
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            className="relative flex max-h-full max-w-full"
            style={{
              maxHeight: "calc(100dvh - 4rem)",
              maxWidth: "calc(100dvw - 2rem)",
              overflow: zoomed ? "auto" : "hidden",
              cursor: zoomed ? (dragging ? "grabbing" : "grab") : "default",
              touchAction: zoomed ? "none" : "auto",
              userSelect: "none",
              WebkitUserSelect: "none",
              alignItems: "safe center",
              justifyContent: "safe center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt ?? ""}
              draggable={false}
              onClick={(e) => {
                e.stopPropagation();
                if (dragRef.current?.moved) return;
                setZoomed((z) => !z);
              }}
              className="block rounded-xl shadow-2xl"
              style={{
                maxHeight: zoomed ? "none" : "calc(100dvh - 4rem)",
                maxWidth: zoomed ? "none" : "calc(100dvw - 2rem)",
                width: zoomed ? "auto" : undefined,
                height: zoomed ? "auto" : undefined,
                objectFit: "contain",
                background: "rgba(0,0,0,0.25)",
                cursor: zoomed ? (dragging ? "grabbing" : "grab") : "zoom-in",
                pointerEvents: dragging ? "none" : "auto",
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
