"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/common/IconButton";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current = document.documentElement.dataset.theme as "light" | "dark" | undefined;
    setTheme(current ?? "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("matrix:theme", next);
    } catch {}
    setTheme(next);
  }

  return (
    <IconButton label="Toggle theme" onClick={toggle} variant="ghost" size="md">
      {theme === "dark" ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}
    </IconButton>
  );
}
