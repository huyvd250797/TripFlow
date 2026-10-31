"use client";
import { useEffect } from "react";
export function ModuleSkeleton({
  label = "Đang tải nội dung",
}: {
  label?: string;
}) {
  useEffect(
    () => () => {
      window.dispatchEvent(new Event("tripflow:module-ready"));
    },
    [],
  );
  return (
    <section
      className="module-skeleton"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span>{label}…</span>
      <i />
      <i />
      <i />
    </section>
  );
}
