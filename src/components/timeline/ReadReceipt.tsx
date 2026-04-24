"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";

export type SendState = "sending" | "sent" | "read" | "failed";

type Props = { state: SendState; own: boolean; size?: number };

export function ReadReceipt({ state, own, size = 14 }: Props) {
  const color = own
    ? state === "read"
      ? "#53bdeb"
      : state === "failed"
      ? "#fecaca"
      : "rgba(255,255,255,0.75)"
    : state === "read"
      ? "#2196f3"
      : "var(--text-faint)";

  let icon: React.ReactNode = null;
  if (state === "sending") icon = <Clock size={size} strokeWidth={1.75} />;
  else if (state === "sent") icon = <Check size={size} strokeWidth={1.75} />;
  else if (state === "read") icon = <CheckCheck size={size} strokeWidth={2.2} />;
  else if (state === "failed") icon = <AlertCircle size={size} strokeWidth={1.75} />;

  return (
    <span style={{ color, display: "inline-flex", alignItems: "center", lineHeight: 0 }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: "inline-flex" }}
        >
          {icon}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
