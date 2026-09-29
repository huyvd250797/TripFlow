"use client";

import { useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

type Point = { x: number; y: number };
type Gesture =
  | { mode: "pinch"; distance: number; scale: number }
  | { mode: "pan"; point: Point; offset: Point }
  | null;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const touchDistance = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

export function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const gesture = useRef<Gesture>(null);

  const setZoom = (next: number) => {
    const value = clamp(next, 1, 5);
    setScale(value);
    if (value === 1) setOffset({ x: 0, y: 0 });
  };

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2) {
      gesture.current = {
        mode: "pinch",
        distance: Math.max(1, touchDistance(event.touches[0], event.touches[1])),
        scale,
      };
      return;
    }
    if (event.touches.length === 1 && scale > 1) {
      gesture.current = {
        mode: "pan",
        point: { x: event.touches[0].clientX, y: event.touches[0].clientY },
        offset,
      };
    }
  };

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length >= 2 && gesture.current?.mode === "pinch") {
      event.preventDefault();
      const distance = Math.max(1, touchDistance(event.touches[0], event.touches[1]));
      setZoom(gesture.current.scale * (distance / gesture.current.distance));
      return;
    }
    if (event.touches.length === 1 && gesture.current?.mode === "pan" && scale > 1) {
      event.preventDefault();
      const maxPan = 360 * scale;
      setOffset({
        x: clamp(gesture.current.offset.x + event.touches[0].clientX - gesture.current.point.x, -maxPan, maxPan),
        y: clamp(gesture.current.offset.y + event.touches[0].clientY - gesture.current.point.y, -maxPan, maxPan),
      });
    }
  };

  const endGesture = () => {
    gesture.current = null;
  };

  return (
    <div
      className="media-zoom-stage"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={endGesture}
      onTouchCancel={endGesture}
      onDoubleClick={() => setZoom(scale > 1 ? 1 : 2)}
    >
      <img
        className="media-viewer-media media-zoom-image"
        src={src}
        alt={alt}
        draggable={false}
        style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
      />
      <div className="media-zoom-controls" aria-label="Điều khiển phóng to ảnh">
        <button type="button" aria-label="Thu nhỏ ảnh" onClick={() => setZoom(scale - 0.5)} disabled={scale <= 1}>
          <Minus size={17} />
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" aria-label="Phóng to ảnh" onClick={() => setZoom(scale + 0.5)} disabled={scale >= 5}>
          <Plus size={17} />
        </button>
        <button type="button" aria-label="Đặt lại ảnh" onClick={() => setZoom(1)} disabled={scale === 1 && offset.x === 0 && offset.y === 0}>
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
