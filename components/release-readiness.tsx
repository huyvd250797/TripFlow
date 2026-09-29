"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { DATABASE_VERSION, VERSION } from "@/lib/types";

type ServerCheck = { key: string; label: string; ok: boolean };
type ReleaseState = {
  app_version: string;
  channel: string;
  database_version: string | null;
  database_required_version?: string;
  checked_at: string;
  ready: boolean;
  checks: ServerCheck[];
};

export function ReleaseReadiness({ online }: { online: boolean }) {
  const [state, setState] = useState<ReleaseState | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const clientChecks = useMemo(
    () => [
      { label: "Kết nối máy chủ", ok: online },
      { label: "Secure context", ok: typeof window !== "undefined" && window.isSecureContext },
      { label: "IndexedDB offline", ok: typeof window !== "undefined" && "indexedDB" in window },
      { label: "Service Worker", ok: typeof navigator !== "undefined" && "serviceWorker" in navigator },
    ],
    [online],
  );

  const check = useCallback(async () => {
    if (!online) {
      setError("Cần online để xác minh trạng thái Production.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/release", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Không kiểm tra được trạng thái Production.");
      setState(body as ReleaseState);
    } catch (e) {
      setState(null);
      setError(e instanceof Error ? e.message : "Không kiểm tra được trạng thái Production.");
    } finally {
      setLoading(false);
    }
  }, [online]);

  useEffect(() => {
    void check();
  }, [check]);

  const clientReady = clientChecks.every((x) => x.ok);
  const ready = Boolean(
    state?.ready &&
      state.app_version === VERSION &&
      state.database_version === DATABASE_VERSION &&
      clientReady,
  );

  return (
    <section className="panel release-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">STABLE PRODUCTION · APP V{VERSION}</span>
          <h2>Trạng thái Production</h2>
          <p className="muted">
            V1.7.0 bổ sung Planning Board & Timeline Pro, kéo thả đổi ngày, chỉnh giờ nhanh, đồng thời tinh chỉnh Finance mobile và Quick dock dạng kéo để ẩn; database vẫn dùng schema V{DATABASE_VERSION}. Ứng dụng xác minh RLS, dữ liệu tài chính, Live Trip, cộng tác và backup/restore trước khi vận hành.
          </p>
        </div>
        <span className={`status-chip ${ready ? "active" : "deactivated"}`}>
          {ready ? "Production sẵn sàng" : "Cần xử lý"}
        </span>
      </div>

      <div className="release-grid">
        <div className="release-check-group">
          <b>Server & database</b>
          <small>Database {state?.database_version || "chưa xác minh"}</small>
          {(state?.checks || []).map((item) => (
            <div className="release-check" key={item.key}>
              {item.ok ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
              <span>{item.label}</span>
            </div>
          ))}
          {!state && !error && <p className="muted">Đang kiểm tra…</p>}
        </div>
        <div className="release-check-group">
          <b>Thiết bị hiện tại</b>
          <small>Kiểm tra nhanh trên trình duyệt đang mở</small>
          {clientChecks.map((item) => (
            <div className="release-check" key={item.label}>
              {item.ok ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="notice warning release-error">
          <AlertTriangle size={19} />
          <span>{error}</span>
        </div>
      )}

      <div className="actions">
        <button className="btn secondary" disabled={loading || !online} onClick={() => void check()}>
          <RefreshCw size={17} className={loading ? "spin" : ""} />
          {loading ? "Đang kiểm tra…" : "Kiểm tra lại"}
        </button>
        <span className="release-version"><ShieldCheck size={16} /> App {VERSION} · DB {state?.database_version || DATABASE_VERSION} · {state?.channel || "stable"}</span>
      </div>
    </section>
  );
}
