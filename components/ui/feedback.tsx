"use client";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Info,
  TriangleAlert,
  LoaderCircle,
  X,
} from "lucide-react";

export type ToastTone = "success" | "info" | "warning";
export type ToastMessage = { id: string; message: string; tone: ToastTone };

export function BusyIndicator() {
  return <LoaderCircle size={18} className="tf-busy-icon" aria-hidden="true" />;
}

export function Toast({
  notice,
  onDismiss,
}: {
  notice: ToastMessage | null;
  onDismiss: () => void;
}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!notice || paused) return;
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [notice?.id, paused, onDismiss]);
  const Icon =
    notice?.tone === "warning"
      ? TriangleAlert
      : notice?.tone === "info"
        ? Info
        : CheckCircle2;
  return (
    <div
      className="tf-toast-region"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {notice && (
        <div
          key={notice.id}
          className={`tf-toast ${notice.tone}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setPaused(false);
          }}
        >
          <Icon size={21} aria-hidden="true" />
          <div>
            <strong>
              {notice.tone === "info"
                ? "Thông tin"
                : notice.tone === "warning"
                  ? "Cần chú ý"
                  : "Hoàn tất"}
            </strong>
            <p>{notice.message}</p>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              setPaused(false);
              onDismiss();
            }}
            aria-label="Đóng thông báo"
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  );
}
