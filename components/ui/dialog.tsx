"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useId, useRef, useEffect, useLayoutEffect } from "react";
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
  const compact = /(?:dialog-compact|app-update-dialog)/.test(className || "");
  const swipeStart = useRef<{ x: number; y: number; at: number } | null>(null);
  const motion = useRef<HTMLDivElement | null>(null);
  const overlay = useRef<HTMLDivElement | null>(null);
  const animation = useRef<Animation | null>(null);
  const springBack = () => {
    const node = motion.current;
    if (!node || !node.isConnected) return;
    const from = node.style.transform || "translateY(0)";
    node.style.transform = "translateY(0)";
    animation.current = node.animate(
      [{ transform: from }, { transform: "translateY(0)" }],
      {
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 180,
        easing: "cubic-bezier(.2,.8,.2,1)",
      },
    );
  };
  const beginDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (
      busy ||
      compact ||
      !matchMedia("(max-width: 760px)").matches ||
      (event.target as HTMLElement).closest("button,input,select,textarea,a")
    )
      return;
    animation.current?.cancel();
    swipeStart.current = {
      x: event.clientX,
      y: event.clientY,
      at: performance.now(),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: React.PointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    if (start && motion.current)
      motion.current.style.transform = `translateY(${Math.max(0, event.clientY - start.y)}px)`;
  };
  const endDrag = (event: React.PointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const distance = Math.max(0, event.clientY - start.y),
      velocity = distance / Math.max(1, performance.now() - start.at);
    if (
      Math.abs(event.clientX - start.x) < 100 &&
      (distance > 80 || (distance > 24 && velocity > 0.6))
    )
      requestClose();
    requestAnimationFrame(springBack);
  };
  useLayoutEffect(() => {
    if (!open) return;
    window.dispatchEvent(new Event("tripflow:sync-viewport"));
    const frame = requestAnimationFrame(() => {
      if (motion.current)
        motion.current.dataset.enterMotion =
          !compact &&
          matchMedia("(max-width: 760px)").matches &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "slide-up"
            : "none";
      if (
        !compact &&
        matchMedia("(max-width: 760px)").matches &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        animation.current =
          motion.current?.animate(
            [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
            { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" },
          ) || null;
    });
    return () => {
      cancelAnimationFrame(frame);
      const node = motion.current;
      if (
        !node?.isConnected ||
        compact ||
        !matchMedia("(max-width: 760px)").matches ||
        matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        return;
      // Callers may unmount a form immediately after save, cancel or Back.
      // Retain an inert visual snapshot until its slide-out completes.
      const bounds = node.getBoundingClientRect();
      const layer = document.createElement("div");
      layer.className = "dialog-viewport dialog-exit-layer";
      layer.setAttribute("aria-hidden", "true");
      layer.inert = true;
      const shade = overlay.current?.cloneNode(true) as HTMLElement | undefined;
      if (shade) {
        shade.removeAttribute("data-state");
        layer.append(shade);
        shade.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: 220,
          fill: "forwards",
        });
      }
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
      clone.querySelectorAll('[role="dialog"]').forEach((el) => {
        el.removeAttribute("role");
        el.removeAttribute("aria-modal");
      });
      Object.assign(clone.style, {
        position: "fixed",
        left: `${bounds.x}px`,
        top: `${bounds.y}px`,
        bottom: "auto",
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        maxHeight: "none",
        transform: "translateY(0)",
      });
      layer.append(clone);
      document.body.append(layer);
      const exit = clone.animate(
        [
          { transform: "translateY(0)" },
          {
            transform: `translateY(${Math.max(bounds.height, window.innerHeight - bounds.y) + 20}px)`,
          },
        ],
        { duration: 220, easing: "cubic-bezier(.4,0,1,1)", fill: "forwards" },
      );
      void exit.finished.finally(() => layer.remove());
    };
  }, [open, compact]);
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
    window.dispatchEvent(new Event("tripflow:sync-viewport"));
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
        <D.Overlay className="dialog-overlay" ref={overlay} />
        <div
          className="dialog-viewport"
          data-presentation={compact ? "compact" : "sheet"}
        >
          <div
            className="dialog-motion"
            ref={motion}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={() => {
              swipeStart.current = null;
              springBack();
            }}
          >
            <D.Content
              className={`dialog-content${className ? ` ${className}` : ""}`}
              data-presentation={compact ? "compact" : "sheet"}
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
                setTimeout(() => {
                  if (
                    !document.querySelector('[role="dialog"]') &&
                    target?.isConnected
                  )
                    target.focus({ preventScroll: true });
                }, 240);
              }}
            >
              {!compact && (
                <div
                  className="sheet-grip"
                  aria-hidden="true"
                  onPointerDown={beginDrag}
                >
                  <span />
                </div>
              )}
              <header className="dialog-header" onPointerDown={beginDrag}>
                <button
                  type="button"
                  className="icon-btn"
                  aria-label="Đóng"
                  disabled={busy}
                  onClick={requestClose}
                >
                  <X size={21} />
                </button>
                <div>
                  <span className="eyebrow">TRIPFLOW</span>
                  <D.Title>{title}</D.Title>
                  {description && (
                    <D.Description id={descriptionId}>
                      {description}
                    </D.Description>
                  )}
                </div>
              </header>
              {children}
            </D.Content>
          </div>
        </div>
      </D.Portal>
    </D.Root>
  );
}
