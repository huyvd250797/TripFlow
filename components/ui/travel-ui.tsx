"use client";
import { ArrowUpRight, Compass, Plus } from "lucide-react";
export function download(name: string, content: string, type: string) {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}

export function openPrintableReport(name: string, content: string) {
  const u = URL.createObjectURL(
    new Blob([content], { type: "text/html;charset=utf-8" }),
  );
  const opened = window.open(u + "#print", "_blank");
  if (!opened) download(name, content, "text/html;charset=utf-8");
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}

export function Link({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <a className="link" href={url} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}

export function Empty({
  title,
  text,
  onAdd,
  label = "Thêm mới",
}: {
  title: string;
  text: string;
  onAdd?: () => void;
  label?: string;
}) {
  return (
    <div className="empty">
      <Compass size={40} />
      <h3>{title}</h3>
      <p>{text}</p>
      {onAdd && (
        <button className="btn primary" onClick={onAdd}>
          <Plus size={17} />
          {label}
        </button>
      )}
    </div>
  );
}

export function Bar({
  value,
  max,
  over = false,
}: {
  value: number;
  max: number;
  over?: boolean;
}) {
  return (
    <div className={`bar ${over ? "over" : ""}`}>
      <span
        style={{
          width: `${Math.max(0, Math.min(100, max ? (value / max) * 100 : 0))}%`,
        }}
      />
    </div>
  );
}
