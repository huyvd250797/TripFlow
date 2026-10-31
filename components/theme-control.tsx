"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "system" | "light" | "dark";
const choices = [
  { id: "light", label: "Sáng", Icon: Sun },
  { id: "dark", label: "Tối", Icon: Moon },
  { id: "system", label: "Thiết bị", Icon: Monitor },
] as const;

function applyTheme(preference: Theme) {
  const dark =
    preference === "dark" ||
    (preference === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0d1722" : "#0B6873");
}

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const refresh = () => {
      let preference =
        document.documentElement.dataset.themePreference || "system";
      try {
        preference = localStorage.getItem("tripflow:theme") || preference;
      } catch {}
      const value: Theme =
        preference === "light" || preference === "dark" ? preference : "system";
      setTheme(value);
      applyTheme(value);
    };
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    refresh();
    window.addEventListener("tripflow-theme", refresh);
    window.addEventListener("storage", refresh);
    system.addEventListener("change", refresh);
    return () => {
      window.removeEventListener("tripflow-theme", refresh);
      window.removeEventListener("storage", refresh);
      system.removeEventListener("change", refresh);
    };
  }, []);
  const choose = (value: Theme) => {
    setTheme(value);
    applyTheme(value);
    try {
      localStorage.setItem("tripflow:theme", value);
    } catch {}
    window.dispatchEvent(new Event("tripflow-theme"));
  };
  const selected = choices.find((choice) => choice.id === theme)!;
  if (compact) {
    const Icon = selected.Icon;
    return (
      <button
        className="icon-btn theme-compact"
        aria-label={`Giao diện: ${selected.label}. Chuyển chế độ`}
        title={`Giao diện: ${selected.label}`}
        onClick={() =>
          choose(
            theme === "system"
              ? "light"
              : theme === "light"
                ? "dark"
                : "system",
          )
        }
      >
        <Icon size={19} />
      </button>
    );
  }
  return (
    <div className="theme-options" role="group" aria-label="Chế độ giao diện">
      {choices.map(({ id, label, Icon }) => (
        <button
          type="button"
          key={id}
          aria-pressed={theme === id}
          className={theme === id ? "active" : ""}
          onClick={() => choose(id)}
        >
          <Icon size={16} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
