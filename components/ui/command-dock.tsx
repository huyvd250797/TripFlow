"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Zap, X } from "lucide-react";
export function CommandDock({
  userId,
  collapsed,
  onCollapse,
  onOpen,
}: {
  userId: string;
  collapsed: boolean;
  onCollapse: (value: boolean) => void;
  onOpen: () => void;
}) {
  const [position, setPosition] = useState<{
      x: number;
      y: number;
      side: "left" | "right";
    } | null>(null),
    [dragging, setDragging] = useState(false);
  const drag = useRef<{
      x: number;
      y: number;
      left: number;
      top: number;
      moved: boolean;
    } | null>(null),
    suppress = useRef(false),
    positionRef = useRef(position);
  positionRef.current = position;
  const size = collapsed ? 26 : 48;
  const bounds = () => ({
    w: window.innerWidth,
    h: window.visualViewport?.height || window.innerHeight,
    top: window.visualViewport?.offsetTop || 0,
  });
  const save = (p: { x: number; y: number; side: "left" | "right" }) => {
    const b = bounds();
    try {
      localStorage.setItem(
        `tripflow:dock-position:${userId}`,
        JSON.stringify({ side: p.side, ratio: (p.y - b.top) / b.h }),
      );
    } catch {}
  };
  useEffect(() => {
    const resize = () => {
      const b = bounds();
      let stored: { side: "left" | "right"; ratio: number } = {
        side: "right",
        ratio: 0.8,
      };
      try {
        const raw = JSON.parse(
          localStorage.getItem(`tripflow:dock-position:${userId}`) || "null",
        );
        if (
          raw &&
          ["left", "right"].includes(raw.side) &&
          Number.isFinite(raw.ratio)
        )
          stored = raw;
      } catch {}
      const p = {
        side: stored.side,
        x: stored.side === "left" ? 4 : Math.max(4, b.w - size - 4),
        y: Math.max(
          b.top + 72,
          Math.min(b.top + b.h - 120 - size, b.top + b.h * stored.ratio),
        ),
      };
      setPosition(p);
    };
    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, [userId, size]);
  const finish = (cancel = false) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d?.moved) return;
    const b = bounds(),
      p = positionRef.current!;
    const side = p.x + size / 2 < b.w / 2 ? "left" : "right";
    const next = {
      ...p,
      side: side as "left" | "right",
      x: side === "left" ? 4 : Math.max(4, b.w - size - 4),
    };
    setPosition(next);
    save(next);
    suppress.current = true;
    window.setTimeout(() => {
      suppress.current = false;
    }, 350);
  };
  return (
    <div
      className={`tf-command-dock ${collapsed ? "is-collapsed" : ""} ${dragging ? "is-dragging" : ""}`}
      data-side={position?.side || "right"}
      style={
        position
          ? { left: position.x, top: position.y, right: "auto", bottom: "auto" }
          : undefined
      }
      onPointerDown={(e) => {
        if (
          e.button !== 0 ||
          (e.target as HTMLElement).closest(".command-fab-close")
        )
          return;
        const r = e.currentTarget.getBoundingClientRect();
        drag.current = {
          x: e.clientX,
          y: e.clientY,
          left: r.left,
          top: r.top,
          moved: false,
        };
        suppress.current = false;
        (e.target as Element).closest("button")?.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const dx = e.clientX - d.x,
          dy = e.clientY - d.y;
        if (Math.hypot(dx, dy) > 6) d.moved = true;
        if (!d.moved) return;
        suppress.current = true;
        setDragging(true);
        const b = bounds();
        setPosition({
          x: Math.max(0, Math.min(b.w - size, d.left + dx)),
          y: Math.max(
            b.top + 72,
            Math.min(b.top + b.h - size - 110, d.top + dy),
          ),
          side: positionRef.current?.side || "right",
        });
      }}
      onPointerUp={() => finish()}
      onPointerCancel={() => finish(true)}
    >
      {collapsed ? (
        <button
          className="command-fab-reveal"
          aria-label="Hiện nút Quick"
          onClick={() => {
            if (!suppress.current) onCollapse(false);
          }}
        >
          {position?.side === "left" ? (
            <ChevronRight size={15} />
          ) : (
            <ChevronLeft size={15} />
          )}
        </button>
      ) : (
        <>
          <button
            className="command-fab-close"
            aria-label="Ẩn nút Quick"
            onClick={() => onCollapse(true)}
          >
            <X size={12} />
          </button>
          <button
            className="command-fab"
            aria-label="Mở TripFlow Command Center"
            title="Kéo để đổi vị trí · Bấm để mở"
            onClick={() => {
              if (!suppress.current) onOpen();
            }}
          >
            <Zap size={22} />
          </button>
        </>
      )}
    </div>
  );
}
