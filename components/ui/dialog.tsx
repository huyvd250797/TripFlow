"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, useRef } from "react";
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
