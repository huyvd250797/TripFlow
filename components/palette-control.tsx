"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { Check, RotateCcw } from "lucide-react";
import {
  PALETTES,
  PALETTE_KEY,
  applyPalette,
  normalizeHex,
  paletteValues,
  resolvePalette,
  type AppPalette,
} from "../lib/app-palette";

export function PaletteControl() {
  const [selected, setSelected] = useState<AppPalette>(PALETTES[0]);
  const [start, setStart] = useState("#084E59");
  const [end, setEnd] = useState("#15909A");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const restore = () => {
      let value: unknown = null;
      try {
        value = JSON.parse(localStorage.getItem(PALETTE_KEY) || "null");
      } catch {}
      const p = applyPalette(value);
      setSelected(p);
      setStart(p.start);
      setEnd(p.end);
    };
    restore();
    window.addEventListener("storage", restore);

    return () => {
      window.removeEventListener("storage", restore);
    };
  }, []);
  const choose = (value: AppPalette) => {
    const p = applyPalette(value);
    setSelected(p);
    setStart(p.start);
    setEnd(p.end);
    try {
      if (p.id === "default") localStorage.removeItem(PALETTE_KEY);
      else localStorage.setItem(PALETTE_KEY, JSON.stringify(p));
      setMessage(
        p.id === "default"
          ? "Đã khôi phục màu mặc định."
          : "Đã lưu màu giao diện trên thiết bị này.",
      );
    } catch {
      setMessage(
        "Đã áp dụng. Thiết bị đang chặn lưu màu, lựa chọn có thể mất khi mở lại.",
      );
    }
  };
  const valid = !!normalizeHex(start) && !!normalizeHex(end);
  const preview = paletteValues(resolvePalette({ id: "custom", start, end }));
  return (
    <div className="palette-control">
      <div className="palette-heading">
        <h4>Màu ứng dụng</h4>
        <button
          type="button"
          className="btn secondary small"
          onClick={() => choose(PALETTES[0])}
        >
          <RotateCcw size={15} />
          Mặc định
        </button>
      </div>
      <div
        className="palette-presets"
        role="group"
        aria-label="Bảng màu ứng dụng"
      >
        {PALETTES.map((p) => (
          <button
            type="button"
            className="palette-choice"
            key={p.id}
            aria-pressed={selected.id === p.id}
            onClick={() => choose(p)}
          >
            <span
              className="palette-swatch"
              style={{
                background: `linear-gradient(135deg, ${paletteValues(p)["--palette-start"]}, ${paletteValues(p)["--palette-end"]})`,
              }}
            >
              {selected.id === p.id && <Check size={20} />}
            </span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <details
        className="palette-custom"
        open={selected.id === "custom" || undefined}
      >
        <summary>
          Tùy chỉnh gradient{" "}
          {selected.id === "custom" && <span>· Đang dùng</span>}
        </summary>
        <div className="palette-fields">
          {[
            { label: "Màu bắt đầu", value: start, set: setStart },
            { label: "Màu kết thúc", value: end, set: setEnd },
          ].map(({ label, value, set }) => (
            <div className="palette-field" key={label}>
              <label>
                {label}
                <span className="palette-color-row">
                  <input
                    type="color"
                    aria-label={`${label} · chọn màu`}
                    value={normalizeHex(value) || "#084E59"}
                    onChange={(e) => {
                      set(e.target.value);
                      setMessage("");
                    }}
                  />
                  <input
                    type="text"
                    aria-label={`${label} · mã HEX`}
                    value={value}
                    maxLength={7}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => {
                      set(e.target.value);
                      setMessage("");
                    }}
                    aria-invalid={!normalizeHex(value)}
                  />
                </span>
              </label>
            </div>
          ))}
        </div>
        <div className="palette-preview" style={preview as CSSProperties}>
          <span>Xem trước</span>
          <strong>Hành trình của bạn</strong>
          <span>Gradient theo phong cách TripFlow</span>
        </div>
        <p className="palette-hint">
          Màu quá sáng được cân chỉnh để chữ luôn dễ đọc.
        </p>
        {!valid && (
          <p className="palette-error" role="alert">
            Nhập mã màu gồm # và 6 ký tự HEX, ví dụ #084E59.
          </p>
        )}
        <div className="palette-actions">
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              setStart(selected.start);
              setEnd(selected.end);
              setMessage("");
            }}
          >
            Hủy
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={!valid}
            onClick={() =>
              choose({ id: "custom", name: "Tùy chỉnh", start, end })
            }
          >
            <Check size={16} />
            Lưu màu
          </button>
        </div>
      </details>
      <div className="palette-feedback" role="status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}
