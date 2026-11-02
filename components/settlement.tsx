"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  CheckCircle2,
  RefreshCw,
  Undo2,
  Wallet,
} from "lucide-react";
import type { Bundle } from "@/lib/types";
import { money, dateLabel, localTime } from "@/lib/domain";
import {
  cacheSettlement,
  readCachedSettlement,
  removeCachedSettlement,
  listQueue,
} from "@/lib/offline";
import { beginAppWrite, setUpdateBlocker } from "@/lib/update-safety";
import { transferSuggestions, type SettlementData } from "@/lib/settlement";
import { Dialog } from "./ui/dialog";

type Form = {
  action:
    | "transfer"
    | "fund_return"
    | "reimbursement"
    | "reversal"
    | "close"
    | "reopen";
  revision: number;
  data: Record<string, string | number>;
};
const kinds: Record<string, string> = {
  paid: "Thanh toán cá nhân",
  share: "Phần chịu thực chi",
  contribution: "Đóng quỹ",
  return: "Trả quỹ",
  reimbursement: "Hoàn ứng",
  sent: "Đã chuyển",
  received: "Đã nhận",
  transfer: "Chuyển tiền",
  reversal: "Hủy chuyển tiền",
  close: "Chốt quyết toán",
  reopen: "Mở lại quyết toán",
};
export function Settlement({
  bundle,
  userId,
  online,
}: {
  bundle: Bundle;
  userId: string;
  online: boolean;
}) {
  const tid = bundle.trip.id,
    qc = useQueryClient();
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState("people"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [form, setForm] = useState<Form | null>(null),
    [dirty, setDirty] = useState(false),
    [search, setSearch] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null),
    operation = useRef<{ hash: string; id: string } | null>(null);
  const query = useQuery({
    queryKey: ["settlement", userId, tid],
    networkMode: "always",
    staleTime: 10000,
    retry: false,
    refetchInterval: open ? 15000 : 30000,
    queryFn: async ({ signal }) => {
      const queued = (await listQueue(userId)).filter(
        (x) => x.tripId === tid,
      ).length;
      if (!navigator.onLine) {
        const data = await readCachedSettlement<SettlementData>(userId, tid);
        return {
          data,
          cached: true,
          queued,
          error: data ? "" : "Chưa có bản quyết toán đã tải trên thiết bị này.",
        };
      }
      try {
        const response = await fetch(`/api/settlement?trip=${tid}`, {
          cache: "no-store",
          signal,
        });
        const data = await response.json();
        if (!response.ok) {
          if ([401, 403].includes(response.status)) {
            await removeCachedSettlement(userId, tid);
            return {
              data: undefined,
              cached: true,
              queued,
              error: data.error || "Không còn quyền xem quyết toán.",
            };
          }
          throw Error(data.error);
        }
        await cacheSettlement(userId, tid, data).catch(() => {});
        return {
          data: data as SettlementData,
          cached: false,
          queued,
          error: "",
        };
      } catch (e) {
        if (signal.aborted) throw e;
        const data = await readCachedSettlement<SettlementData>(userId, tid);
        return {
          data,
          cached: true,
          queued,
          error: e instanceof Error ? e.message : "Không tải được quyết toán.",
        };
      }
    },
  });
  const s = query.data?.data,
    cached = query.data?.cached ?? true,
    queued = query.data?.queued || 0;
  const writable = bundle.role === "owner" || bundle.role === "editor",
    canWrite =
      writable &&
      online &&
      !cached &&
      !busy &&
      !query.isFetching &&
      queued === 0;
  useEffect(() => {
    void query.refetch({ cancelRefetch: false });
  }, [online, bundle.expenses, bundle.budgets, bundle.participants]);
  useEffect(() => {
    setUpdateBlocker(
      "settlement-form",
      dirty || busy
        ? "Lưu hoặc đóng biểu mẫu quyết toán trước khi cập nhật."
        : undefined,
    );
    return () => setUpdateBlocker("settlement-form");
  }, [dirty, busy]);
  const today = localTime(new Date().toISOString(), bundle.trip.timezone).slice(
    0,
    10,
  );
  const close = () => {
    if (busy) return;
    if (dirty && !confirm("Bỏ nội dung quyết toán chưa lưu?")) return;
    setOpen(false);
    setForm(null);
    setDirty(false);
  };
  const start = (
    action: Form["action"],
    data: Record<string, string | number> = {},
  ) => {
    if (!s || !canWrite) return;
    if (dirty && !confirm("Bỏ nội dung chưa lưu?")) return;
    setForm({
      action,
      revision: s.revision,
      data: { occurred_on: today, note: "", receipt_url: "", ...data },
    });
    setDirty(false);
    setMessage("");
    bodyRef.current?.scrollTo({ top: 0 });
  };
  const update = (key: string, value: string) => {
    setForm((f) => (f ? { ...f, data: { ...f.data, [key]: value } } : null));
    setDirty(true);
  };
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !canWrite) return;
    setBusy(true);
    setMessage("");
    const end = beginAppWrite();
    const payload = { tripId: tid, ...form },
      hash = JSON.stringify(payload);
    if (operation.current?.hash !== hash)
      operation.current = { hash, id: crypto.randomUUID() };
    try {
      if ((await listQueue(userId)).some((x) => x.tripId === tid))
        throw Error(
          "Còn thao tác chưa đồng bộ. Hoàn tất đồng bộ rồi mở lại quyết toán.",
        );
      const r = await fetch("/api/settlement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, operationId: operation.current.id }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (r.status === 409) {
          setForm(null);
          setDirty(false);
          await query.refetch();
        }
        throw Error(data.error || "Không lưu được quyết toán.");
      }
      operation.current = null;
      setForm(null);
      setDirty(false);
      setMessage("Đã ghi nhận. Công nợ đã được cập nhật.");
      await Promise.all([
        query.refetch(),
        qc.invalidateQueries({ queryKey: ["trip-fund", userId, tid] }),
        qc.invalidateQueries({ queryKey: ["trip", userId, tid] }),
      ]);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Không lưu được. Thử lại cùng nội dung để tránh ghi trùng.",
      );
    } finally {
      setBusy(false);
      end();
    }
  };
  const who = (id: string | null) =>
    s?.rows.find((x) => x.id === id)?.name || "Người tham gia đã xóa";
  const totalDue =
      s?.rows.reduce((n, x) => n + Math.max(0, -x.balance), 0) || 0,
    totalReceive = s?.rows.reduce((n, x) => n + Math.max(0, x.balance), 0) || 0;
  const ready =
    !!s &&
    !s.issues.length &&
    s.fund_balance === 0 &&
    s.unpaid === 0 &&
    s.rows.every((x) => x.balance === 0);
  const reversed = new Set(
    s?.history.filter((x) => x.reverses_id).map((x) => x.reverses_id),
  );
  const suggestions = s && !s.issues.length ? transferSuggestions(s.rows) : [];
  const back = () => {
    if (busy) return;
    if (dirty && !confirm("Bỏ nội dung chưa lưu?")) return;
    setForm(null);
    setDirty(false);
  };
  const formLabels: Record<Form["action"], string> = {
    transfer: "Ghi nhận chuyển tiền",
    fund_return: "Trả tiền quỹ dư",
    reimbursement: "Hoàn ứng từ quỹ",
    reversal: "Hủy giao dịch chuyển tiền",
    close: "Chốt quyết toán",
    reopen: "Mở lại quyết toán",
  };
  return (
    <section
      className="panel settlement-panel"
      aria-label="Công nợ & quyết toán"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">ĐỐI CHIẾU NHÓM</span>
          <h2>Công nợ & quyết toán</h2>
          <p className="muted">
            {s?.closed_at
              ? "Đã chốt quyết toán"
              : "Theo thực chi và các giao dịch đã xác nhận"}
          </p>
        </div>
        <button
          className="btn secondary"
          onClick={() => {
            setOpen(true);
            void query.refetch();
          }}
        >
          <ArrowRightLeft size={16} />
          Quyết toán
        </button>
      </div>
      <div className="settlement-kpis">
        <div>
          <span>Còn phải trả</span>
          <strong>{s ? money(totalDue) : "—"}</strong>
        </div>
        <div>
          <span>Còn được nhận</span>
          <strong>{s ? money(totalReceive) : "—"}</strong>
        </div>
        <div>
          <span>Quỹ còn lại</span>
          <strong>{s ? money(s.fund_balance) : "—"}</strong>
        </div>
      </div>
      {query.data?.error && (
        <p className="notice warning" role="status">
          {query.data.error}
        </p>
      )}
      {cached && s && (
        <p className="hint">
          Bản đã tải · {new Date(s.generated_at).toLocaleString("vi-VN")} · Chỉ
          xem khi chưa kết nối.
        </p>
      )}
      {!!s?.issues.length && (
        <p className="hint">
          Có {s.issues.length} mục cần kiểm tra trước khi quyết toán.
        </p>
      )}
      <Dialog
        open={open}
        onClose={close}
        title="Công nợ & quyết toán"
        description="Đề xuất chưa làm giảm công nợ. Chỉ ghi nhận khi tiền đã thực sự được chuyển."
        className="settlement-dialog"
        busy={busy}
      >
        <div
          className="dialog-body settlement-body"
          ref={bodyRef}
          aria-busy={busy || query.isFetching}
        >
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          {query.data?.error && (
            <p className="notice warning" role="alert">
              {query.data.error}
            </p>
          )}
          {cached && (
            <p className="notice warning">
              Đang xem bản đã tải. Kết nối và tải lại để ghi nhận giao dịch.
            </p>
          )}
          {queued > 0 && (
            <p className="notice warning">
              Còn {queued} thao tác chưa đồng bộ. Công nợ dưới đây là bản trên
              server; hãy đồng bộ trước khi ghi nhận hoặc chốt.
            </p>
          )}
          {!s ? (
            <p role="status">
              {query.isFetching
                ? "Đang tải quyết toán…"
                : "Chưa có dữ liệu quyết toán."}
            </p>
          ) : form ? (
            <form
              id="settlement-form"
              onSubmit={save}
              className="settlement-form"
            >
              <h3>{formLabels[form.action]}</h3>
              {form.action === "transfer" && (
                <>
                  <p>
                    <b>{who(String(form.data.from_id))}</b> →{" "}
                    <b>{who(String(form.data.to_id))}</b>
                  </p>
                  <p className="hint">
                    Đây là ghi sổ tiền đã chuyển; app không thực hiện chuyển
                    tiền ngân hàng.
                  </p>
                  <label>
                    Người chuyển
                    <select
                      value={String(form.data.from_id)}
                      onChange={(e) => update("from_id", e.target.value)}
                      disabled={busy}
                    >
                      {s.rows
                        .filter((x) => x.balance < 0)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name} · còn trả {money(-x.balance)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Người nhận
                    <select
                      value={String(form.data.to_id)}
                      onChange={(e) => update("to_id", e.target.value)}
                      disabled={busy}
                    >
                      {s.rows
                        .filter((x) => x.balance > 0)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name} · còn nhận {money(x.balance)}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              {form.action === "fund_return" && (
                <p>
                  Quỹ → <b>{who(String(form.data.participant_id))}</b>. Ghi vào
                  sổ quỹ hiện có, không tạo thêm chi phí.
                </p>
              )}
              {form.action === "reimbursement" && (
                <p>
                  Hoàn ứng cho khoản:{" "}
                  <b>
                    {
                      s.advances.find((x) => x.id === form.data.expense_id)
                        ?.title
                    }
                  </b>
                  . Không cộng lại vào thực chi.
                </p>
              )}
              {["transfer", "fund_return", "reimbursement"].includes(
                form.action,
              ) && (
                <>
                  <label>
                    Số tiền đã chuyển (VNĐ)
                    <input
                      aria-label="Số tiền đã chuyển (VNĐ)"
                      required
                      inputMode="numeric"
                      value={
                        form.data.amount === ""
                          ? ""
                          : new Intl.NumberFormat("vi-VN").format(
                              Number(form.data.amount || 0),
                            )
                      }
                      onChange={(e) =>
                        update("amount", e.target.value.replace(/\D/g, ""))
                      }
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Ngày chuyển
                    <input
                      aria-label="Ngày chuyển"
                      type="date"
                      required
                      value={String(form.data.occurred_on || "")}
                      onChange={(e) => update("occurred_on", e.target.value)}
                      disabled={busy}
                    />
                  </label>
                  <label>
                    Chứng từ (link HTTPS, tùy chọn)
                    <input
                      type="url"
                      maxLength={2000}
                      value={String(form.data.receipt_url || "")}
                      onChange={(e) => update("receipt_url", e.target.value)}
                      disabled={busy}
                    />
                  </label>
                </>
              )}
              {form.action === "close" && (
                <p>
                  Chốt khi tất cả số dư thành viên và quỹ bằng 0, không còn dự
                  toán chưa thanh toán đủ hoặc khoản thiếu thông tin. Các thay
                  đổi tài chính sau đó cần mở lại quyết toán.
                </p>
              )}
              <label>
                {["reversal", "reopen"].includes(form.action)
                  ? "Lý do (bắt buộc)"
                  : "Ghi chú"}
                <textarea
                  aria-label="Ghi chú quyết toán"
                  required={["reversal", "reopen"].includes(form.action)}
                  maxLength={2000}
                  value={String(form.data.note || "")}
                  onChange={(e) => update("note", e.target.value)}
                  disabled={busy}
                />
              </label>
            </form>
          ) : (
            <>
              <div className="segments settlement-tabs">
                {[
                  ["people", "Theo người"],
                  ["transfers", "Chuyển tiền"],
                  ["history", "Lịch sử"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={tab === id ? "active" : ""}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="hint">
                {s.closed_at
                  ? `Đã chốt · ${new Date(s.closed_at).toLocaleString("vi-VN")}`
                  : "Số dư dương: được nhận · Số dư âm: phải trả"}
              </p>
              {s.unpaid > 0 && (
                <p className="notice warning">
                  Công nợ đang tạm tính theo thực chi. Dự toán còn{" "}
                  {money(s.unpaid)} chưa thanh toán đủ; số dư có thể thay đổi
                  khi trả tiếp hoặc hoàn tiền.
                </p>
              )}
              {!!s.issues.length && (
                <details open className="settlement-issues">
                  <summary>Cần kiểm tra ({s.issues.length})</summary>
                  {s.issues.map((x, i) => (
                    <p key={i}>
                      <b>{x.title}</b> — {x.message}
                    </p>
                  ))}
                </details>
              )}
              {tab === "people" && (
                <>
                  <input
                    className="settlement-search"
                    aria-label="Tìm người quyết toán"
                    placeholder="Tìm người tham gia…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <div className="settlement-list">
                    {s.rows
                      .filter((x) =>
                        x.name
                          .toLocaleLowerCase("vi")
                          .includes(search.toLocaleLowerCase("vi")),
                      )
                      .map((x) => (
                        <article key={x.id} className="settlement-person">
                          <div className="settlement-row">
                            <b>{x.name}</b>
                            <strong>
                              {x.balance > 0
                                ? "Được nhận "
                                : x.balance < 0
                                  ? "Phải trả "
                                  : "Đã cân bằng "}
                              {money(Math.abs(x.balance))}
                            </strong>
                          </div>
                          <dl className="settlement-metrics">
                            {[
                              ["Phần chịu", x.share],
                              ["Đã trả cá nhân", x.paid],
                              ["Đóng quỹ", x.contributed],
                              ["Đã nhận trả quỹ", x.returned],
                              ["Đã hoàn ứng", x.reimbursed],
                              ["Đã chuyển quyết toán", x.sent],
                              ["Đã nhận quyết toán", x.received],
                            ].map(([label, value]) => (
                              <div key={String(label)}>
                                <dt>{label}</dt>
                                <dd>{money(Number(value))}</dd>
                              </div>
                            ))}
                          </dl>
                          <details>
                            <summary>Nguồn hình thành số dư</summary>
                            {s.details
                              .filter((d) => d.participant_id === x.id)
                              .map((d, i) => (
                                <p key={i}>
                                  {kinds[d.kind]} · {d.title}:{" "}
                                  <b>{money(d.amount)}</b>
                                </p>
                              ))}
                          </details>
                        </article>
                      ))}
                    {!s.rows.length && (
                      <p>
                        Thêm người tham gia và khai báo cách chia trong Dự toán
                        trước khi quyết toán.
                      </p>
                    )}
                  </div>
                  <p className="hint">
                    Cọc/hoàn tiền được phân bổ theo tỷ trọng phần chịu toàn
                    khoản. Khi thực chi vượt dự toán, phần cố định giữ nguyên,
                    phần tăng thêm chia cho nhóm chịu phần còn lại. Khoản chưa
                    gắn dự toán hoặc thiếu cách chia cần được bổ sung trước.
                  </p>
                </>
              )}
              {tab === "transfers" && (
                <div className="settlement-list">
                  <p className="notice">
                    Đề xuất chưa làm thay đổi công nợ. Xác nhận số tiền thực
                    chuyển; có thể thanh toán một phần.
                  </p>
                  {suggestions.map((x) => (
                    <article key={x.from_id + x.to_id}>
                      <div className="settlement-row">
                        <div>
                          <b>
                            {who(x.from_id)} → {who(x.to_id)}
                          </b>
                          <p>{money(x.amount)}</p>
                        </div>
                        {writable && !s.closed_at && (
                          <button
                            className="btn secondary"
                            disabled={!canWrite}
                            onClick={() =>
                              start("transfer", {
                                ...x,
                                amount: Math.min(x.amount, 1e12),
                              })
                            }
                          >
                            Ghi nhận
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {!suggestions.length && !s.issues.length && (
                    <p>
                      Không còn lượt chuyển giữa thành viên được đề xuất. Kiểm
                      tra quỹ còn lại bên dưới.
                    </p>
                  )}
                  <h3>
                    <Wallet size={17} /> Đối chiếu quỹ · {money(s.fund_balance)}
                  </h3>
                  <p className="hint">
                    Trả quỹ dư theo quyền lợi còn lại, không mặc định chia đều.
                    Hoàn ứng/trả quỹ được lưu một lần trong sổ quỹ.
                  </p>
                  {s.fund_balance > 0 &&
                    s.rows
                      .filter(
                        (x) => x.balance > 0 && x.contributed > x.returned,
                      )
                      .map((x) => {
                        const amount = Math.min(
                          x.balance,
                          x.contributed - x.returned,
                          s.fund_balance,
                          1e12,
                        );
                        return (
                          <article key={x.id}>
                            <div className="settlement-row">
                              <div>
                                <b>Quỹ → {x.name}</b>
                                <p>Có thể trả {money(amount)}</p>
                              </div>
                              {writable && !s.closed_at && (
                                <button
                                  className="btn secondary"
                                  disabled={!canWrite || !!s.issues.length}
                                  onClick={() =>
                                    start("fund_return", {
                                      participant_id: x.id,
                                      amount,
                                    })
                                  }
                                >
                                  Trả quỹ
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                  {s.fund_balance > 0 &&
                    s.advances.map((x) => {
                      const person = s.rows.find((p) => p.name === x.payer);
                      const amount = Math.min(
                        x.remaining,
                        s.fund_balance,
                        Math.max(0, person?.balance || 0),
                        1e12,
                      );
                      return amount > 0 ? (
                        <article key={x.id}>
                          <div className="settlement-row">
                            <div>
                              <b>
                                {x.title} · {x.payer}
                              </b>
                              <p>Có thể hoàn {money(amount)}</p>
                            </div>
                            {writable && !s.closed_at && (
                              <button
                                className="btn secondary"
                                disabled={!canWrite || !!s.issues.length}
                                onClick={() =>
                                  start("reimbursement", {
                                    expense_id: x.id,
                                    amount,
                                  })
                                }
                              >
                                Hoàn ứng
                              </button>
                            )}
                          </div>
                        </article>
                      ) : null;
                    })}
                  <details>
                    <summary>
                      Khoản ứng gốc chưa hoàn qua quỹ ({s.advances.length})
                    </summary>
                    <p className="hint">
                      Có thể đã được bù bằng chuyển tiền giữa thành viên. Dùng
                      số dư công nợ ở Theo người để tránh hoàn trùng.
                    </p>
                    {s.advances.map((x) => (
                      <p key={x.id}>
                        {x.title} · {x.payer}: {money(x.remaining)}
                      </p>
                    ))}
                  </details>
                  {s.unpaid > 0 && (
                    <details open>
                      <summary>
                        Dự toán còn chưa thanh toán đủ · {money(s.unpaid)}
                      </summary>
                      <p className="hint">
                        Đối chiếu nghĩa vụ thực tế; ghi phần thanh toán còn
                        thiếu hoặc sửa dự toán theo chi phí cuối cùng nếu khoản
                        không còn phát sinh.
                      </p>
                      {s.budgets
                        .filter((x) => x.remaining > 0)
                        .map((x) => (
                          <p key={x.id}>
                            {x.title}: {money(x.remaining)}
                          </p>
                        ))}
                    </details>
                  )}
                  {writable && s.can_close && (
                    <div className="settlement-close">
                      <p>
                        {s.closed_at
                          ? "Mở lại để bổ sung hoặc sửa giao dịch tài chính."
                          : ready
                            ? "Các số dư đã cân bằng; có thể chốt quyết toán."
                            : "Chưa đủ điều kiện chốt. Xử lý các mục còn tồn và kiểm tra Theo người."}
                      </p>
                      <button
                        className="btn primary"
                        disabled={!canWrite || (!s.closed_at && !ready)}
                        onClick={() => start(s.closed_at ? "reopen" : "close")}
                      >
                        {s.closed_at ? (
                          <Undo2 size={16} />
                        ) : (
                          <CheckCircle2 size={16} />
                        )}{" "}
                        {s.closed_at ? "Mở lại quyết toán" : "Chốt quyết toán"}
                      </button>
                    </div>
                  )}
                  {!s.can_close && (
                    <p className="hint">
                      Chỉ chủ chuyến hoặc Editor được cấp quyền Chốt/mở lại
                      quyết toán mới được chốt.
                    </p>
                  )}
                </div>
              )}
              {tab === "history" && (
                <div className="settlement-list">
                  {s.history.map((x) => (
                    <article key={x.id}>
                      <div className="settlement-row">
                        <b>
                          {kinds[x.kind]}
                          {reversed.has(x.id) ? " · Đã hủy" : ""}
                        </b>
                        <span>{dateLabel(x.occurred_on)}</span>
                      </div>
                      {x.from_id && (
                        <p>
                          {who(x.from_id)} → {who(x.to_id)} ·{" "}
                          <b>{money(x.amount)}</b>
                        </p>
                      )}
                      <p className="prewrap">{x.note}</p>
                      <small>
                        Ghi nhận:{" "}
                        {new Date(x.created_at).toLocaleString("vi-VN")} · Tài
                        khoản{" "}
                        {x.actor_id === bundle.trip.owner_id
                          ? "Chủ chuyến đi"
                          : bundle.members.find((m) => m.user_id === x.actor_id)
                              ?.email || "Thành viên không còn trong chuyến"}
                      </small>
                      {x.receipt_url && (
                        <p>
                          <a
                            className="link"
                            href={x.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Xem chứng từ
                          </a>
                        </p>
                      )}
                      {writable &&
                        !s.closed_at &&
                        x.kind === "transfer" &&
                        !reversed.has(x.id) && (
                          <button
                            className="btn secondary"
                            disabled={!canWrite}
                            onClick={() =>
                              start("reversal", { reverses_id: x.id })
                            }
                          >
                            <Undo2 size={15} />
                            Hủy giao dịch
                          </button>
                        )}
                    </article>
                  ))}
                  {!s.history.length && (
                    <p>Chưa ghi nhận giao dịch quyết toán.</p>
                  )}
                  <details>
                    <summary>
                      Sổ quỹ liên quan ({s.fund_history.length})
                    </summary>
                    <p className="hint">
                      Đây là cùng sổ quỹ hiện có, không phải giao dịch cộng
                      thêm. Sửa/hủy giao dịch quỹ tại Quỹ chuyến đi.
                    </p>
                    {s.fund_history.map((x) => (
                      <article key={x.id}>
                        <b>
                          {x.kind === "reversal"
                            ? "Hủy giao dịch quỹ"
                            : kinds[x.kind]}{" "}
                          · {money(x.amount)}
                        </b>
                        <p>
                          {x.participant_id
                            ? who(x.participant_id)
                            : bundle.expenses.find((e) => e.id === x.expense_id)
                                ?.title || "Khoản hoàn ứng"}{" "}
                          · {dateLabel(x.occurred_on)}
                        </p>
                        <p>{x.note}</p>
                        {x.receipt_url && (
                          <a
                            className="link"
                            href={x.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Xem chứng từ
                          </a>
                        )}
                      </article>
                    ))}
                  </details>
                </div>
              )}
            </>
          )}
        </div>
        <div className="dialog-footer">
          {form ? (
            <>
              <button className="btn secondary" disabled={busy} onClick={back}>
                Hủy
              </button>
              <button
                className="btn primary"
                form="settlement-form"
                type="submit"
                disabled={!canWrite}
              >
                {busy ? "Đang ghi nhận…" : "Xác nhận"}
              </button>
            </>
          ) : (
            <>
              <button className="btn secondary" onClick={close}>
                Đóng
              </button>
              <button
                className="btn primary"
                disabled={busy || query.isFetching || !online}
                onClick={() => void query.refetch()}
              >
                <RefreshCw size={16} />
                Tải lại
              </button>
            </>
          )}
        </div>
      </Dialog>
    </section>
  );
}
