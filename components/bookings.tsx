"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Copy, FileText, Ticket, RefreshCw } from "lucide-react";
import {
  BOOKING_KINDS,
  BOOKING_STATUS,
  bookingData,
  type Booking,
  type BookingData,
} from "@/lib/bookings";
import type { Bundle } from "@/lib/types";
import { localTime, utcTime, money } from "@/lib/domain";
import {
  cacheBookings,
  readCachedBookings,
  removeCachedBookings,
} from "@/lib/offline";
import { beginAppWrite, setUpdateBlocker } from "@/lib/update-safety";
import { Dialog } from "./ui/dialog";
import { Empty, Link, download } from "./ui/travel-ui";
import { BusyIndicator } from "./ui/feedback";
export function Bookings({
  bundle,
  userId,
  online,
}: {
  bundle: Bundle;
  userId: string;
  online: boolean;
}) {
  const [rows, setRows] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [cached, setCached] = useState(false),
    [filter, setFilter] = useState("upcoming"),
    [query, setQuery] = useState(""),
    [edit, setEdit] = useState<Booking | null | undefined>(),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const operation = useRef<{ hash: string; id: string; rowId: string } | null>(
    null,
  );
  const writable = bundle.role === "owner" || bundle.role === "editor",
    tid = bundle.trip.id;
  const [zone, setZone] = useState(bundle.trip.timezone);
  useEffect(() => {
    setUpdateBlocker(
      "booking-form",
      edit !== undefined || busy
        ? "Hãy lưu hoặc đóng biểu mẫu đặt chỗ trước khi cập nhật."
        : undefined,
    );
    return () => setUpdateBlocker("booking-form");
  }, [edit, busy]);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!navigator.onLine) {
        setRows((await readCachedBookings<Booking[]>(userId, tid)) || []);
        setCached(true);
        return;
      }
      const res = await fetch(`/api/bookings?trip=${tid}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          await removeCachedBookings(userId, tid);
          setRows([]);
        }
        throw Error(data.error);
      }
      setRows(data.bookings);
      setCached(false);
      await cacheBookings(userId, tid, data.bookings).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được đặt chỗ.");
    } finally {
      setLoading(false);
    }
  }, [userId, tid]);
  useEffect(() => {
    void load();
    const focus = () => {
      if (document.visibilityState !== "hidden") void load();
    };
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    const timer = setInterval(focus, 60000);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
      clearInterval(timer);
    };
  }, [load, online]);
  async function mutate(
    action: "create" | "update" | "delete",
    row: Booking | null,
    data?: BookingData,
  ) {
    if (!navigator.onLine)
      throw Error(
        "Cần mạng để lưu đặt chỗ. Thông tin đã tải vẫn có thể xem offline.",
      );
    const hash = JSON.stringify({
      action,
      rowId: row?.id,
      version: row?.version,
      data,
    });
    if (operation.current?.hash !== hash)
      operation.current = {
        hash,
        id: crypto.randomUUID(),
        rowId: row?.id || crypto.randomUUID(),
      };
    const op = operation.current!;
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: tid,
        id: op.rowId,
        operationId: op.id,
        action,
        version: row?.version,
        data,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw Error(body.error);
    const next =
      action === "delete"
        ? rows.filter((x) => x.id !== row?.id)
        : [...rows.filter((x) => x.id !== body.booking.id), body.booking];
    setRows(next);
    await cacheBookings(userId, tid, next).catch(() => {});
    operation.current = null;
    setMessage(
      action === "delete"
        ? "Đã xóa đặt chỗ/tài liệu."
        : "Đã lưu đặt chỗ/tài liệu.",
    );
  }
  const open = (row: Booking | null) => {
    operation.current = null;
    setError("");
    setZone(row?.payload.timezone || bundle.trip.timezone);
    setEdit(row);
  };
  const visible = rows
    .filter(
      (r) =>
        (filter === "documents"
          ? r.kind === "document"
          : filter === "upcoming"
            ? r.kind !== "document" &&
              ["pending", "confirmed"].includes(r.status)
            : true) &&
        `${r.title} ${r.payload.code} ${r.payload.provider}`
          .toLocaleLowerCase("vi")
          .includes(query.toLocaleLowerCase("vi")),
    )
    .sort((a, b) =>
      (a.payload.start_at || "9999").localeCompare(
        b.payload.start_at || "9999",
      ),
    );
  const field = (name: keyof BookingData, label: string, type = "text") => (
    <label className="field" key={name}>
      <span>{label}</span>
      <input
        name={name}
        type={type}
        maxLength={name === "title" ? 160 : 4000}
        required={name === "title"}
        defaultValue={
          ["start_at", "end_at", "deadline", "cancel_by"].includes(name)
            ? localTime(
                String(edit?.payload[name] || ""),
                edit?.payload.timezone || zone,
              ).slice(0, 16)
            : String(edit?.payload[name] ?? (name === "quantity" ? 1 : ""))
        }
      />
    </label>
  );
  return (
    <section className="panel booking-module">
      <div className="section-heading">
        <div>
          <span className="eyebrow">BOOKINGS & DOCUMENTS</span>
          <h2>Đặt chỗ & tài liệu</h2>
        </div>
        <button
          className="icon-btn"
          aria-label="Tải lại đặt chỗ"
          onClick={() => void load()}
        >
          <RefreshCw size={18} />
        </button>
      </div>
      <p className="hint">
        Mã đặt chỗ, vé và hướng dẫn cho chuyến đi. Liên kết tài liệu ngoài cần
        mạng và quyền truy cập tại nguồn.
      </p>
      <div className="actions">
        {writable && (
          <button
            className="btn primary"
            disabled={!online || busy}
            onClick={() => open(null)}
          >
            <Plus size={17} />
            Thêm đặt chỗ / tài liệu
          </button>
        )}
        <button
          className="btn secondary"
          onClick={() =>
            download(
              `TripFlow-bookings-${tid}.json`,
              JSON.stringify(
                {
                  format: "tripflow-bookings-export-v1",
                  tripId: tid,
                  exportedAt: new Date().toISOString(),
                  bookings: rows,
                },
                null,
                2,
              ),
              "application/json",
            )
          }
        >
          Xuất JSON
        </button>
      </div>
      <div className="booking-filters">
        {[
          ["upcoming", "Sắp sử dụng"],
          ["all", "Tất cả"],
          ["documents", "Tài liệu"],
        ].map(([id, label]) => (
          <button
            className={filter === id ? "active" : ""}
            key={id}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        className="share-input"
        aria-label="Tìm đặt chỗ"
        placeholder="Tìm tên, mã hoặc nhà cung cấp"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {(cached || !online) && (
        <p className="notice warning">
          Đang xem bản đã tải trên thiết bị. Thêm/sửa/xóa cần mạng.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {loading && <p role="status">Đang tải đặt chỗ…</p>}
      <div className="booking-list">
        {visible.map((row) => {
          const d = row.payload;
          const expenses = bundle.expenses.filter(
            (x) => x.budget_id === row.budget_id && !!row.budget_id,
          );
          const paid = expenses.reduce(
            (n, x) => n + (x.kind === "refund" ? -1 : 1) * Number(x.amount),
            0,
          );
          return (
            <article className="booking-card" key={row.id}>
              <div className="section-heading">
                <span className="pill">
                  {row.kind === "document" ? (
                    <FileText size={15} />
                  ) : (
                    <Ticket size={15} />
                  )}{" "}
                  {BOOKING_KINDS[row.kind]}
                </span>
                <span className="pill">{BOOKING_STATUS[row.status]}</span>
              </div>
              <h3>{row.title}</h3>
              {d.provider && <p>{d.provider}</p>}
              {d.code && (
                <button
                  className="booking-code"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(d.code);
                      setMessage("Đã sao chép mã xác nhận.");
                    } catch {
                      setMessage(
                        "Chưa sao chép được. Hãy chọn mã và sao chép thủ công.",
                      );
                    }
                  }}
                >
                  <code>{d.code}</code>
                  <Copy size={16} />
                </button>
              )}
              {d.start_at && (
                <p>
                  <b>{localTime(d.start_at, d.timezone).replace("T", " ")}</b>
                  {d.end_at && (
                    <> → {localTime(d.end_at, d.timezone).replace("T", " ")}</>
                  )}
                  <small> · {d.timezone}</small>
                </p>
              )}
              <details>
                <summary>Chi tiết</summary>
                <dl>
                  {[
                    ["Người đứng tên", d.holder],
                    ["Số lượng", String(d.quantity)],
                    ["Địa điểm", d.location],
                    ["Liên hệ", d.contact],
                    [
                      "Hạn thanh toán",
                      d.deadline && localTime(d.deadline, d.timezone),
                    ],
                    [
                      "Hạn hủy miễn phí",
                      d.cancel_by && localTime(d.cancel_by, d.timezone),
                    ],
                    [
                      "Lịch trình",
                      bundle.items.find((i) => i.id === row.item_id)?.title,
                    ],
                    [
                      "Đặt chỗ liên quan",
                      rows.find((r) => r.id === row.booking_id)?.title,
                    ],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                </dl>
                <p className="prewrap">{d.note}</p>
              </details>
              {row.budget_id && (
                <p className="hint">
                  Dự toán:{" "}
                  {bundle.budgets.find((b) => b.id === row.budget_id)?.title ||
                    "Đã xóa"}{" "}
                  · Đã trả ròng: {money(paid)}. Tổng này thuộc khoản dự toán
                  liên kết.
                </p>
              )}
              <div className="actions">
                {d.url?.startsWith("https://") && (
                  <Link url={d.url}>Mở vé / tài liệu</Link>
                )}
                {d.map_url?.startsWith("https://") && (
                  <Link url={d.map_url}>Maps</Link>
                )}
                {writable && (
                  <>
                    <button
                      className="btn secondary"
                      disabled={busy || !online}
                      onClick={() => open(row)}
                    >
                      Sửa
                    </button>
                    <button
                      className="btn danger-btn"
                      disabled={busy || !online}
                      onClick={async () => {
                        if (!confirm(`Xóa “${row.title}”?`)) return;
                        const finish = beginAppWrite();
                        setBusy(true);
                        try {
                          await mutate("delete", row);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          finish();
                          setBusy(false);
                        }
                      }}
                    >
                      Xóa
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!loading && !visible.length && (
        <Empty
          title="Chưa có dữ liệu phù hợp"
          text="Thêm đặt chỗ hoặc đổi bộ lọc để xem tài liệu."
        />
      )}
      {edit !== undefined && (
        <Dialog
          open
          busy={busy}
          title={edit ? "Sửa đặt chỗ / tài liệu" : "Thêm đặt chỗ / tài liệu"}
          onClose={() => {
            if (
              !busy &&
              confirm("Đóng biểu mẫu đặt chỗ? Nội dung chưa lưu sẽ bị bỏ.")
            )
              setEdit(undefined);
          }}
        >
          <form
            className="editor-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy || !writable) return;
              const form = new FormData(e.currentTarget);
              const finish = beginAppWrite();
              setBusy(true);
              setError("");
              try {
                const raw = Object.fromEntries(form);
                for (const name of [
                  "start_at",
                  "end_at",
                  "deadline",
                  "cancel_by",
                ])
                  raw[name] = raw[name] ? utcTime(String(raw[name]), zone) : "";
                const parsed = bookingData.safeParse({
                  ...raw,
                  timezone: zone,
                });
                if (!parsed.success)
                  throw Error(
                    parsed.error.issues.map((i) => i.message).join(" "),
                  );
                await mutate(edit ? "update" : "create", edit, parsed.data);
                setEdit(undefined);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                finish();
                setBusy(false);
              }
            }}
          >
            <div className="dialog-body form-grid">
              {field("title", "Tên đặt chỗ / tài liệu *")}
              <label className="field">
                <span>Loại</span>
                <select
                  aria-label="Loại"
                  name="kind"
                  defaultValue={edit?.kind || "hotel"}
                >
                  {Object.entries(BOOKING_KINDS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Trạng thái</span>
                <select
                  aria-label="Trạng thái"
                  name="status"
                  defaultValue={edit?.status || "pending"}
                >
                  {Object.entries(BOOKING_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              {field("code", "Mã xác nhận")}
              <label className="field">
                <span>Múi giờ</span>
                <input
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  required
                />
              </label>
              {field("start_at", "Bắt đầu / nhận phòng", "datetime-local")}
              {field("end_at", "Kết thúc / trả phòng", "datetime-local")}
              {field("url", "Link vé / tài liệu HTTPS", "url")}
              <details className="full">
                <summary>Thông tin bổ sung & liên kết</summary>
                <div className="form-grid">
                  {field("provider", "Nhà cung cấp")}
                  {field("holder", "Người đứng tên")}
                  {field("quantity", "Số lượng", "number")}
                  {field("location", "Địa điểm")}
                  {field("map_url", "Link Maps HTTPS", "url")}
                  {field("contact", "Liên hệ")}
                  {field("deadline", "Hạn thanh toán", "datetime-local")}
                  {field("cancel_by", "Hạn hủy miễn phí", "datetime-local")}
                  {field("note", "Ghi chú / hướng dẫn")}
                  {(["item_id", "budget_id", "booking_id"] as const).map(
                    (key) => (
                      <label className="field" key={key}>
                        <span>
                          {key === "item_id"
                            ? "Hoạt động liên quan"
                            : key === "budget_id"
                              ? "Dự toán liên quan"
                              : "Đặt chỗ liên quan (cho tài liệu)"}
                        </span>
                        <select name={key} defaultValue={edit?.[key] || ""}>
                          <option value="">Không liên kết</option>
                          {(key === "item_id"
                            ? bundle.items
                            : key === "budget_id"
                              ? bundle.budgets
                              : rows.filter(
                                  (r) =>
                                    r.kind !== "document" && r.id !== edit?.id,
                                )
                          ).map((r) => (
                            <option value={r.id} key={r.id}>
                              {r.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    ),
                  )}
                </div>
              </details>
              {error && (
                <p className="error full" role="alert">
                  {error}
                </p>
              )}
            </div>
            <footer className="dialog-footer">
              <button
                className="btn secondary"
                type="button"
                disabled={busy}
                onClick={() => setEdit(undefined)}
              >
                Hủy
              </button>
              <button
                className="btn primary"
                disabled={busy || !online || !writable}
                aria-busy={busy}
              >
                {busy && <BusyIndicator />}
                {busy ? "Đang lưu…" : "Lưu đặt chỗ"}
              </button>
            </footer>
          </form>
        </Dialog>
      )}
    </section>
  );
}
