"use client";
import type { Bundle } from "@/lib/types";
import { preparationProgress } from "@/lib/preparation";
export function PreparationSummary({
  bundle,
  onOpen,
}: {
  bundle: Bundle;
  onOpen: () => void;
}) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: bundle.trip.timezone,
  }).format(new Date());
  const p = preparationProgress(bundle.checklist || [], today);
  return (
    <button
      className="preparation-glance panel"
      onClick={onOpen}
      aria-label="Mở chuẩn bị chuyến đi"
    >
      <span>
        <b>Chuẩn bị chuyến đi</b>
        <small>
          {p.total
            ? `${p.complete}/${p.total} mục · ${p.overdue} quá hạn · ${p.unassigned} chưa phân công`
            : "Tạo checklist hoặc dùng mẫu hành lý"}
        </small>
      </span>
      <span aria-hidden="true">→</span>
    </button>
  );
}
