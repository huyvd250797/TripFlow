"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Dialog({
  open,
  onClose,
  title,
  children,
  description,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <D.Portal>
        <D.Overlay className="dialog-overlay" />
        <D.Content
          className="dialog-content"
          aria-describedby={description ? "dialog-description" : undefined}
        >
          <header className="dialog-header">
            <div>
              <span className="eyebrow">TRIPFLOW</span>
              <D.Title>{title}</D.Title>
              {description && (
                <D.Description id="dialog-description">
                  {description}
                </D.Description>
              )}
            </div>
            <button className="icon-btn" aria-label="Đóng" onClick={onClose}>
              <X size={21} />
            </button>
          </header>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
