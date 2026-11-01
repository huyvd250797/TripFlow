"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Bundle } from "@/lib/types";
import { emptyFund, fundTotals, FUND_LABELS, type FundData } from "@/lib/fund";
import { dateLabel, localTime, money } from "@/lib/domain";
import { cacheFund, readCachedFund, removeCachedFund } from "@/lib/offline";
import { beginAppWrite, setUpdateBlocker } from "@/lib/update-safety";
import { Dialog } from "./ui/dialog";
import { download } from "./ui/travel-ui";
type Form = {
  action: "setup" | "target" | "entry";
  version?: number;
  data: Record<string, string | number>;
};
export function TripFund({
  bundle,
  userId,
  online,
}: {
  bundle: Bundle;
  userId: string;
  online: boolean;
}) {
  const tid = bundle.trip.id,
    writable = bundle.role === "owner" || bundle.role === "editor";
  const [data, setData] = useState<FundData>(emptyFund),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [cached, setCached] = useState(false),
    [open, setOpen] = useState(false),
    [view, setView] = useState("members"),
    [form, setForm] = useState<Form | null>(null),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const operation = useRef<{ hash: string; id: string } | null>(null),
    generation = useRef(0);
  const load = useCallback(async () => {
    const token = ++generation.current;
    setLoading(true);
    setError("");
    try {
      if (!navigator.onLine) {
        const saved = await readCachedFund<FundData>(userId, tid);
        if (token !== generation.current) return;
        setData(saved || emptyFund);
        setCached(true);
        if (!saved) setError("Chưa có bản quỹ đã tải trên thiết bị này.");
        return;
      }
      const r = await fetch(`/api/fund?trip=${tid}`, { cache: "no-store" });
      const d = await r.json();
      if (token !== generation.current) return;
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          await removeCachedFund(userId, tid);
          setData(emptyFund);
        }
        throw Error(d.error);
      }
      setData(d);
      setCached(false);
      await cacheFund(userId, tid, d).catch(() => {});
    } catch (e) {
      if (token === generation.current) {
        setError(e instanceof Error ? e.message : "Không tải được quỹ.");
        setCached(true);
      }
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }, [userId, tid]);
  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState !== "hidden") void load();
    };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      generation.current++;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [load, bundle.expenses, online]);
  useEffect(() => {
    setUpdateBlocker(
      "fund-form",
      dirty || busy
        ? "Hãy lưu hoặc đóng biểu mẫu quỹ trước khi cập nhật."
        : undefined,
    );
    return () => setUpdateBlocker("fund-form");
  }, [dirty, busy]);
  const totals = fundTotals(data, bundle.expenses),
    canWrite = writable && online && !cached && !loading && !busy;
  const today = localTime(new Date().toISOString(), bundle.trip.timezone).slice(
    0,
    10,
  );
  const close = () => {
    if (busy) return;
    if (dirty && !window.confirm("Bỏ thay đổi chưa lưu của quỹ?")) return;
    setForm(null);
    setDirty(false);
    setOpen(false);
  };
  const start = (next: Form) => {
    if (dirty && !window.confirm("Bỏ thay đổi chưa lưu?")) return;
    setForm(next);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      formRef.current?.querySelector("input")?.focus({ preventScroll: true });
    });
    setDirty(false);
    setMessage("");
  };
  const entry = (
    kind: string,
    participant_id = "",
    expense_id = "",
    amount = 1,
    reverses_id = "",
  ) =>
    start({
      action: "entry",
      data: {
        kind,
        participant_id,
        expense_id,
        amount,
        reverses_id,
        occurred_on: today,
        note: "",
        method: "",
        receipt_url: "",
      },
    });
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
    const payload = { ...form, tripId: tid },
      hash = JSON.stringify(payload);
    if (operation.current?.hash !== hash)
      operation.current = { hash, id: crypto.randomUUID() };
    try {
      const r = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, operationId: operation.current.id }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      operation.current = null;
      setForm(null);
      setDirty(false);
      requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0 }));
      setMessage("Đã lưu giao dịch quỹ.");
      await load();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Không lưu được. Thử lại với cùng biểu mẫu để tránh ghi trùng.",
      );
    } finally {
      end();
      setBusy(false);
    }
  };
  const who = (pid: string | null) =>
    bundle.participants.find((p) => p.id === pid)?.name ||
    "Người tham gia đã xóa";
  const advanceTitle = (id: string | null) => {
    const e = bundle.expenses.find((x) => x.id === id);
    return e
      ? `${e.payer || "Chưa ghi người ứng"} · ${e.title}`
      : "Khoản chi đã xóa";
  };
  const netFor = (pid: string) =>
    totals.active
      .filter((e) => e.participant_id === pid)
      .reduce(
        (s, e) => s + (e.kind === "contribution" ? 1 : -1) * Number(e.amount),
        0,
      );
  const field = (
    key: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <label key={key}>
      {label}
      <input
        type={type}
        required={required}
        min={
          type === "number" ? (form?.action === "target" ? 0 : 1) : undefined
        }
        max={type === "number" ? 1e12 : undefined}
        step={type === "number" ? 1 : undefined}
        maxLength={
          type === "text"
            ? key === "note"
              ? 2000
              : key === "method"
                ? 100
                : 160
            : undefined
        }
        value={String(form?.data[key] ?? "")}
        onChange={(e) => update(key, e.target.value)}
        disabled={busy}
      />
    </label>
  );
  return (
    <section className="panel trip-fund-panel" aria-label="Quỹ chuyến đi">
      <div className="section-heading">
        <div>
          <span className="eyebrow">QUỸ CHUNG</span>
          <h2>Quỹ chuyến đi</h2>
          <p className="muted">
            Tiền thực thu và đã chi ·{" "}
            {data.fund?.keeper
              ? `Giữ quỹ: ${data.fund.keeper}`
              : "Chưa thiết lập người giữ quỹ"}
          </p>
        </div>
        <button className="btn secondary" onClick={() => setOpen(true)}>
          Quản lý quỹ
        </button>
      </div>
      {loading ? (
        <p role="status">Đang tải quỹ…</p>
      ) : (
        <div className="fund-stats">
          <div>
            <span>Số dư quỹ{cached ? " · bản đã lưu" : ""}</span>
            <strong>{money(totals.balance)}</strong>
          </div>
          <div>
            <span>Đã thu / mục tiêu</span>
            <strong>
              {money(totals.collected)} / {money(totals.target)}
            </strong>
          </div>
          <div>
            <span>Cá nhân còn ứng</span>
            <strong>{money(totals.outstanding)}</strong>
          </div>
        </div>
      )}
      <p className="hint">
        Dự toán là kế hoạch. Đóng quỹ chỉ tăng tiền quỹ; hoàn ứng và trả quỹ
        không cộng thêm thực chi.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}{" "}
          <button className="btn secondary" onClick={() => void load()}>
            Tải lại quỹ
          </button>
        </p>
      )}
      {open && (
        <Dialog
          open
          onClose={close}
          title="Quản lý quỹ chuyến đi"
          className="fund-dialog dialog-sheet"
          busy={busy}
          description="Thu quỹ, hoàn ứng và trả tiền dư cho thành viên."
        >
          <div className="dialog-body fund-body" ref={bodyRef}>
            <div className="fund-stats">
              <div>
                <span>Số dư quỹ</span>
                <strong>{money(totals.balance)}</strong>
              </div>
              <div>
                <span>Chi trực tiếp từ quỹ</span>
                <strong>{money(totals.fundSpent)}</strong>
              </div>
              <div>
                <span>Đã hoàn ứng / trả quỹ</span>
                <strong>
                  {money(totals.reimbursed)} / {money(totals.returned)}
                </strong>
              </div>
            </div>
            {cached && (
              <p role="status" className="hint">
                Bản đã lưu: chỉ xem. Kết nối mạng và tải lại quỹ để ghi giao
                dịch.
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="actions">
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => void load()}
              >
                Tải lại quỹ
              </button>
              <button
                className="btn secondary"
                disabled={!canWrite}
                onClick={() =>
                  start({
                    action: "setup",
                    version: data.fund?.version,
                    data: {
                      keeper: data.fund?.keeper || "",
                      note: data.fund?.note || "",
                    },
                  })
                }
              >
                Người giữ quỹ
              </button>
              <button
                className="btn secondary"
                disabled={loading || cached}
                onClick={() =>
                  download(
                    `TripFlow-quy-${tid}.json`,
                    JSON.stringify(
                      {
                        trip: bundle.trip,
                        exported_at: new Date().toISOString(),
                        ...data,
                        expenses: bundle.expenses,
                        participants: bundle.participants,
                      },
                      null,
                      2,
                    ),
                    "application/json",
                  )
                }
              >
                Xuất sổ quỹ
              </button>
            </div>
            {data.fund?.note && <p className="prewrap">{data.fund.note}</p>}
            <div className="segments fund-views">
              {[
                ["members", "Đóng quỹ"],
                ["settle", "Hoàn / trả"],
                ["ledger", "Sổ quỹ"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  className={view === id ? "active" : ""}
                  onClick={() => {
                    setView(id);
                    bodyRef.current?.scrollTo({ top: 0 });
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {view === "members" && (
              <div className="fund-list">
                {bundle.participants.length === 0 && (
                  <p>
                    Thêm người tham gia trong Thêm → Thành viên trước khi thu
                    quỹ.
                  </p>
                )}
                {bundle.participants.map((p) => {
                  const target = data.targets.find(
                      (t) => t.participant_id === p.id,
                    ),
                    paid = netFor(p.id),
                    remaining = Math.max(0, Number(target?.amount || 0) - paid);
                  return (
                    <article key={p.id}>
                      <div>
                        <b>{p.name}</b>
                        <p className="muted">
                          Mục tiêu {money(target?.amount || 0)} · Đã đóng ròng{" "}
                          {money(paid)}
                        </p>
                        <p>
                          Còn đóng {money(remaining)}
                          {target?.due_on
                            ? ` · Hạn ${dateLabel(target.due_on)}${remaining > 0 && target.due_on < today ? " · Quá hạn" : ""}`
                            : ""}
                        </p>
                      </div>
                      <div className="actions">
                        <button
                          className="btn secondary"
                          disabled={!canWrite}
                          onClick={() =>
                            start({
                              action: "target",
                              version: target?.version,
                              data: {
                                participant_id: p.id,
                                amount: target?.amount || 0,
                                due_on: target?.due_on || "",
                              },
                            })
                          }
                        >
                          Mức đóng
                        </button>
                        <button
                          className="btn"
                          disabled={!canWrite || !data.fund}
                          onClick={() =>
                            entry("contribution", p.id, "", remaining || 1)
                          }
                        >
                          Ghi đóng quỹ
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            {view === "settle" && (
              <div className="fund-list">
                <h3>Cá nhân còn ứng · {money(totals.outstanding)}</h3>
                <p className="hint">
                  Ghi chi tiêu với nguồn “Cá nhân ứng trước”, rồi hoàn ứng đúng
                  khoản. Tổng thực chi không tăng khi hoàn ứng.
                </p>
                {totals.advances.length === 0 && (
                  <p>Không có khoản ứng cần hoàn.</p>
                )}
                {totals.advances.map((a) => (
                  <article key={a.expense.id}>
                    <div>
                      <b>{advanceTitle(a.expense.id)}</b>
                      <p>Còn hoàn {money(a.remaining)}</p>
                    </div>
                    <button
                      className="btn secondary"
                      disabled={!canWrite || !data.fund}
                      onClick={() =>
                        entry("reimbursement", "", a.expense.id, a.remaining)
                      }
                    >
                      Hoàn ứng
                    </button>
                  </article>
                ))}
                <h3>Trả quỹ dư</h3>
                <p className="hint">
                  Thống nhất phần tiền dư được trả cho từng người. Mỗi lần trả
                  không vượt phần họ đã đóng còn lại và số dư quỹ.
                </p>
                {bundle.participants
                  .filter((p) => netFor(p.id) > 0)
                  .map((p) => (
                    <article key={p.id}>
                      <div>
                        <b>{p.name}</b>
                        <p>Đã đóng ròng {money(netFor(p.id))}</p>
                      </div>
                      <button
                        className="btn secondary"
                        disabled={!canWrite || !data.fund}
                        onClick={() => entry("return", p.id)}
                      >
                        Trả quỹ
                      </button>
                    </article>
                  ))}
              </div>
            )}
            {view === "ledger" && (
              <div className="fund-list">
                <p className="hint">
                  Giao dịch đã ghi được giữ nguyên. Dùng “Hủy giao dịch” nếu
                  nhập nhầm; hệ thống lưu dấu vết và kiểm tra số dư. Chi trực
                  tiếp từ quỹ xem tại Thực chi.
                </p>
                {[...data.entries].reverse().map((e) => (
                  <article
                    key={e.id}
                    className={totals.reversed.has(e.id) ? "fund-reversed" : ""}
                  >
                    <div>
                      <b>
                        {FUND_LABELS[e.kind]} · {money(e.amount)}
                      </b>
                      <p>
                        {dateLabel(e.occurred_on)} ·{" "}
                        {e.expense_id
                          ? advanceTitle(e.expense_id)
                          : who(e.participant_id)}
                      </p>
                      {e.method && <p>{e.method}</p>}
                      {e.note && <p className="prewrap">{e.note}</p>}
                      {e.receipt_url.startsWith("https://") && (
                        <a
                          href={e.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Chứng từ
                        </a>
                      )}
                      {totals.reversed.has(e.id) && <small>Đã hủy</small>}
                    </div>
                    {e.kind !== "reversal" && !totals.reversed.has(e.id) && (
                      <button
                        className="btn secondary"
                        disabled={!canWrite}
                        onClick={() =>
                          entry("reversal", "", "", e.amount, e.id)
                        }
                      >
                        Hủy giao dịch
                      </button>
                    )}
                  </article>
                ))}
                {!data.entries.length && <p>Chưa có giao dịch quỹ.</p>}
              </div>
            )}
            {form && (
              <form
                className="fund-form"
                onSubmit={save}
                ref={formRef}
                aria-label="Biểu mẫu quỹ"
              >
                <h3>
                  {form.action === "setup"
                    ? "Thiết lập quỹ"
                    : form.action === "target"
                      ? `Mức đóng · ${who(String(form.data.participant_id))}`
                      : FUND_LABELS[form.data.kind as keyof typeof FUND_LABELS]}
                </h3>
                {form.action === "setup" ? (
                  <>
                    {field("keeper", "Người giữ quỹ", "text", true)}
                    {field("note", "Ghi chú")}
                  </>
                ) : form.action === "target" ? (
                  <>
                    {field("amount", "Mục tiêu đóng (VNĐ)", "number", true)}
                    {field("due_on", "Hạn đóng", "date")}
                  </>
                ) : (
                  <>
                    <p>
                      {form.data.kind === "reversal"
                        ? "Hủy hiệu lực giao dịch đã chọn. Không xóa lịch sử."
                        : form.data.kind === "reimbursement"
                          ? advanceTitle(String(form.data.expense_id))
                          : who(String(form.data.participant_id))}
                    </p>
                    {form.data.kind !== "reversal" &&
                      field("amount", "Số tiền (VNĐ)", "number", true)}
                    {field("occurred_on", "Ngày giao dịch", "date", true)}
                    {field("method", "Phương thức / tham chiếu")}
                    {field("receipt_url", "Link chứng từ (HTTPS)", "url")}
                    {field("note", "Ghi chú")}
                  </>
                )}
                <div className="actions">
                  <button type="submit" className="btn" disabled={!canWrite}>
                    {busy ? "Đang lưu…" : "Lưu quỹ"}
                  </button>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => {
                      if (!dirty || window.confirm("Bỏ thay đổi chưa lưu?")) {
                        setForm(null);
                        setDirty(false);
                      }
                    }}
                  >
                    Hủy nhập
                  </button>
                </div>
              </form>
            )}
            {message && (
              <p role="status" className="hint">
                {message}
              </p>
            )}
          </div>
        </Dialog>
      )}
    </section>
  );
}
