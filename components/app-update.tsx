"use client";
import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, ShieldCheck } from "lucide-react";
import { Dialog } from "./ui/dialog";
import { VERSION } from "@/lib/types";
import {
  isNewerVersion,
  prepareAppUpdate,
  updateBlockReason,
} from "@/lib/update-safety";

export function AppUpdate() {
  const [available, setAvailable] = useState(false),
    [open, setOpen] = useState(false);
  const [latest, setLatest] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [reason, setReason] = useState("");
  const registration = useRef<ServiceWorkerRegistration | null>(null);
  const accepted = useRef(false),
    reloading = useRef(false),
    version = useRef("");
  const dismissed = useRef("");
  const lastCheck = useRef(0);
  const checkRef = useRef<() => Promise<void>>(async () => {});
  const reload = () => {
    if (reloading.current) return;
    reloading.current = true;
    window.location.reload(); // Normal network-first navigation, no hard reload or manual restart.
  };
  useEffect(() => {
    let disposed = false,
      stopInstalling: (() => void) | undefined;
    const announce = (candidate = "") => {
      if (disposed) return;
      const key = candidate || "waiting-worker";
      if (candidate) {
        version.current = candidate;
        setLatest(candidate);
      }
      setAvailable(true);
      window.dispatchEvent(new Event("tripflow:update-available"));
      if (dismissed.current !== key) setOpen(true);
    };
    const updateSafety = () => setReason(updateBlockReason());
    updateSafety();
    window.addEventListener("tripflow:update-safety", updateSafety);
    const watch = (reg: ServiceWorkerRegistration) => {
      registration.current = reg;
      window.dispatchEvent(new Event("tripflow:worker-ready"));
      if (reg.waiting && navigator.serviceWorker.controller)
        announce(version.current);
      const installing = () => {
        const worker = reg.installing;
        if (!worker) return;
        const state = () => {
          if (
            worker.state === "installed" &&
            navigator.serviceWorker.controller
          )
            announce(version.current);
        };
        worker.addEventListener("statechange", state);
        state();
      };
      reg.addEventListener("updatefound", installing);
      installing();
      stopInstalling = () => reg.removeEventListener("updatefound", installing);
    };
    const check = async () => {
      if (
        !navigator.onLine ||
        document.visibilityState === "hidden" ||
        Date.now() - lastCheck.current < 15000
      )
        return;
      lastCheck.current = Date.now();
      try {
        const response = await fetch(`/api/version?t=${Date.now()}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (response.ok) {
          const data = await response.json();
          if (isNewerVersion(String(data.version || ""), VERSION))
            announce(data.version);
        }
      } catch {
        /* Optional version check must not interrupt travel or sign-in. */
      }
      try {
        await registration.current?.update();
      } catch {}
      if (registration.current?.waiting && navigator.serviceWorker.controller)
        announce(version.current);
    };
    checkRef.current = check;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((reg) => {
          if (!disposed) {
            watch(reg);
            void check();
          }
        })
        .catch(() => void check());
    } else void check();
    const controller = () => {
      if (accepted.current) {
        reload();
        return;
      }
      // First install claims a page too. Other tabs never reload without their user's consent.
      if (version.current || registration.current?.waiting)
        announce(version.current);
    };
    navigator.serviceWorker?.addEventListener("controllerchange", controller);
    const resume = () => void check();
    const manual = () => {
      setOpen(true);
      void check();
    };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("tripflow:show-update", manual);
    const timer = setInterval(resume, 60000);
    return () => {
      disposed = true;
      stopInstalling?.();
      clearInterval(timer);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("tripflow:show-update", manual);
      window.removeEventListener("tripflow:update-safety", updateSafety);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        controller,
      );
    };
  }, []);
  const apply = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!navigator.onLine)
        throw new Error(
          "Cần kết nối mạng để tải phiên bản mới. Dữ liệu offline vẫn được giữ trên máy.",
        );
      await prepareAppUpdate();
      // Probe the new HTML first; if the network/deploy is unavailable, leave this page intact.
      const shell = await fetch("/", {
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!shell.ok)
        throw new Error("Chưa tải được phiên bản mới. Vui lòng thử lại sau.");
      await shell.text();
      try {
        await registration.current?.update();
      } catch {}
      await prepareAppUpdate();
      accepted.current = true;
      const waiting = registration.current?.waiting;
      if (waiting) {
        waiting.postMessage({ type: "SKIP_WAITING" });
        // Some browsers omit/delay controllerchange. A bounded fallback performs the same normal reload.
        setTimeout(() => {
          if (accepted.current && !reloading.current) reload();
        }, 5000);
      } else reload();
    } catch (e) {
      accepted.current = false;
      setError(
        e instanceof Error
          ? e.message
          : "Cập nhật chưa thành công. Hãy thử lại.",
      );
      setBusy(false);
    }
  };
  if (!available) return null;
  return (
    <>
      {!open && (
        <button className="app-update-pill" onClick={() => setOpen(true)}>
          <Download size={16} />
          Có phiên bản mới
        </button>
      )}
      {open && (
        <Dialog
          open
          title="TripFlow có phiên bản mới"
          className="app-update-dialog dialog-sheet"
          busy={busy}
          onClose={() => {
            if (!busy) {
              dismissed.current = latest || "waiting-worker";
              setOpen(false);
            }
          }}
        >
          <div className="dialog-body update-dialog-body">
            <div className="update-icon">
              <Download size={28} />
            </div>
            <h3>
              {latest ? `TripFlow V${latest}` : "Bản cập nhật đã sẵn sàng"}
            </h3>
            <p>
              Cập nhật ngay tại đây để sử dụng phiên bản mới. Không cần tải lại
              cứng hoặc đóng mở ứng dụng.
            </p>
            <p className="hint">
              <ShieldCheck size={16} /> Dữ liệu đã lưu và các thao tác offline
              chờ đồng bộ được giữ lại.
            </p>
            {reason && (
              <p className="notice warning" role="status">
                {reason}
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="dialog-footer">
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => {
                dismissed.current = latest || "waiting-worker";
                setOpen(false);
              }}
            >
              Để sau
            </button>
            <button
              className="btn primary"
              disabled={busy || !!reason}
              aria-busy={busy}
              onClick={() => void apply()}
            >
              <RefreshCw size={17} className={busy ? "spin" : ""} />
              {busy ? "Đang cập nhật…" : "Cập nhật"}
            </button>
          </footer>
        </Dialog>
      )}
    </>
  );
}
