"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, useRef, useEffect } from "react";
let pendingHistoryBack: Promise<void> | null = null;
export function Dialog({
  open,
  onClose,
  title,
  children,
  description,
  className,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  className?: string;
  busy?: boolean;
  children: React.ReactNode;
}) {
  const descriptionId = useId();
  const opener = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const requestClose = () => {
    if (!busy) onClose();
  };
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;
  useEffect(() => {
    if (!open) return;
    let mounted = true,
      armed = false;
    const marker = crypto.randomUUID();
    let state: Record<string, unknown>;
    const back = () => {
      if (history.state?.tripflowDialog === marker) return;
      closeRef.current();
      // A busy form or a cancelled discard confirmation keeps its history guard.
      setTimeout(() => {
        if (mounted && armed) history.pushState(state, "");
      }, 0);
    };
    const arm = () => {
      if (!mounted) return;
      state = { ...history.state, tripflowDialog: marker };
      history.pushState(state, "");
      armed = true;
      window.addEventListener("popstate", back);
    };
    if (pendingHistoryBack) void pendingHistoryBack.then(arm);
    else arm();
    return () => {
      mounted = false;
      window.removeEventListener("popstate", back);
      if (armed && history.state?.tripflowDialog === marker) {
        pendingHistoryBack = new Promise<void>((resolve) => {
          window.addEventListener(
            "popstate",
            () => {
              pendingHistoryBack = null;
              resolve();
            },
            { once: true },
          );
          history.back();
        });
      }
    };
  }, [open]);
  return (
    <D.Root open={open} onOpenChange={(v) => !v && requestClose()}>
      <D.Portal>
        <D.Overlay className="dialog-overlay" />
        <D.Content
          className={`dialog-content${className ? ` ${className}` : ""}`}
          aria-describedby={description ? descriptionId : undefined}
          aria-busy={busy || undefined}
          onCloseAutoFocus={(event) => {
            // Dialogs are opened by programmatic actions rather than Radix Trigger.
            // Keep keyboard navigation in the current screen after the dialog leaves.
            event.preventDefault();
            const target = opener.current?.isConnected
              ? opener.current
              : Array.from(
                  document.querySelectorAll<HTMLElement>(
                    '[aria-current="page"]',
                  ),
                ).find((element) => element.getClientRects().length > 0);
            target?.focus({ preventScroll: true });
          }}
        >
          <header className="dialog-header">
            <div>
              <span className="eyebrow">TRIPFLOW</span>
              <D.Title>{title}</D.Title>
              {description && (
                <D.Description id={descriptionId}>{description}</D.Description>
              )}
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Đóng"
              disabled={busy}
              onClick={requestClose}
            >
              <X size={21} />
            </button>
          </header>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
