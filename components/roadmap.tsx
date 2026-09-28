"use client";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { NEXT_VERSION, ROADMAP } from "@/lib/roadmap";

export function ProductRoadmap() {
  return (
    <section className="panel roadmap-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LỘ TRÌNH SẢN PHẨM</span>
          <h2>TripFlow roadmap</h2>
        </div>
      </div>
      <div className="product-roadmap">
        {ROADMAP.map((item) => (
          <article className={`roadmap-item ${item.done ? "done" : ""}`} key={item.version}>
            <span className="roadmap-state" aria-hidden="true">
              {item.done ? <CheckCircle2 size={21} /> : <Circle size={21} />}
            </span>
            <div>
              <div className="roadmap-title">
                <b>{item.version}</b>
                <span>{item.title}</span>
                {item.done && <em>✅ Hoàn thành</em>}
              </div>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </div>
      {NEXT_VERSION ? (
        <div className="next-version-card">
          <div>
            <span className="eyebrow">PHIÊN BẢN TIẾP THEO</span>
            <h3>{NEXT_VERSION.version} – {NEXT_VERSION.title}</h3>
            <p>{NEXT_VERSION.description}</p>
          </div>
          <ArrowRight size={24} />
        </div>
      ) : (
        <div className="next-version-card roadmap-complete-card">
          <div>
            <span className="eyebrow">ROADMAP 1.0 HOÀN TẤT</span>
            <h3>V1.0.0 – Stable Production Release</h3>
            <p>
              Toàn bộ roadmap 1.0 đã hoàn thành. Các phiên bản sau V1.0.0 chỉ mở khi có phạm vi sản phẩm mới được chốt.
            </p>
          </div>
          <CheckCircle2 size={24} />
        </div>
      )}
    </section>
  );
}
