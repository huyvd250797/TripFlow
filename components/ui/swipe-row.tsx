"use client";
import { useRef, useState, type ReactNode } from "react";
import { Pencil, Trash2 } from "lucide-react";
export function SwipeRow({
  children,
  className,
  onEdit,
  onDelete,
  actions,
}: {
  children: ReactNode;
  className?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  actions?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <article
      className={`${className || ""} swipe-row ${open ? "swipe-open" : ""}`}
      onPointerDown={(e) => {
        if (
          e.pointerType !== "mouse" &&
          (onEdit || onDelete || actions) &&
          !(e.target as HTMLElement).closest("button,a,input,select,summary")
        )
          start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        const s = start.current;
        if (!s) return;
        const dx = e.clientX - s.x,
          dy = e.clientY - s.y;
        if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
          start.current = null;
          return;
        }
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.6) {
          setOpen(dx < 0);
          start.current = null;
        }
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      onPointerCancel={() => {
        start.current = null;
      }}
    >
      {children}
      {open && (
        <div className="swipe-actions" aria-label="Thao tác nhanh">
          {actions || (
            <>
              <button
                className="btn secondary"
                onClick={() => {
                  setOpen(false);
                  onEdit?.();
                }}
              >
                <Pencil size={16} />
                Sửa
              </button>
              <button
                className="btn danger-btn"
                onClick={() => {
                  setOpen(false);
                  onDelete?.();
                }}
              >
                <Trash2 size={16} />
                Xóa
              </button>
            </>
          )}
          <button className="text-btn" onClick={() => setOpen(false)}>
            Đóng
          </button>
        </div>
      )}
    </article>
  );
}
