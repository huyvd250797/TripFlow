"use client";
import { useEffect, useState } from "react";
export function ConnectionStatus({
  online,
  hasError,
}: {
  online: boolean;
  hasError: boolean;
}) {
  const [state, setState] = useState<"checking" | "ready" | "offline">(
    "checking",
  );
  useEffect(() => {
    let cancelled = false;
    let checking = false;
    const check = async () => {
      if (checking) return;
      if (!navigator.onLine) {
        setState("offline");
        return;
      }
      checking = true;
      try {
        const r = await fetch("/api/version", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!cancelled) setState(r.ok ? "ready" : "checking");
      } catch {
        if (!cancelled) setState(navigator.onLine ? "checking" : "offline");
      } finally {
        checking = false;
      }
    };
    void check();
    window.addEventListener("online", check);
    const offline = () => setState("offline");
    window.addEventListener("offline", offline);
    window.addEventListener("focus", check);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", check);
    };
  }, []);
  const value = !online ? "offline" : hasError ? "checking" : state;
  const label =
    value === "ready"
      ? "Kết nối ổn định"
      : value === "offline"
        ? "Offline — không có mạng"
        : "Đang thử kết nối";
  return (
    <span
      className={`connection-dot ${value}`}
      role="status"
      aria-label={label}
      title={label}
    >
      <span className="sr-only">{label}</span>
    </span>
  );
}
