"use client";
import { useState } from "react";
import type { Bundle, Budget } from "@/lib/types";
import {
  allocateCost,
  costPayments,
  type CostSharing,
} from "@/lib/cost-sharing";
import { money } from "@/lib/domain";
import { formatMoneyInput, parseMoneyInput } from "@/lib/money-input";

export function CostSharingFields({
  total,
  participants,
  value,
  onChange,
}: {
  total: number;
  participants: Bundle["participants"];
  value: CostSharing | null;
  onChange: (value: CostSharing) => void;
}) {
  const rule = value || { mode: "equal" as const };
  let preview: ReturnType<typeof allocateCost> = [],
    error = "";
  try {
    preview = allocateCost(total, rule, participants);
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <fieldset className="cost-sharing-fields full">
      <legend>Phân chia chi phí</legend>
      <label>
        Cách chia
        <select
          aria-label="Cách chia"
          value={rule.mode}
          onChange={(e) =>
            onChange(
              e.target.value === "equal"
                ? { mode: "equal" }
                : e.target.value === "selected_equal"
                  ? { mode: "selected_equal", participants: [] }
                  : {
                      mode: "fixed_remainder",
                      fixed: [
                        {
                          participant_id: participants[0]?.id || "",
                          amount: 0,
                        },
                      ],
                      participants: [],
                    },
            )
          }
        >
          <option value="equal">Chia đều cho tất cả người tham gia</option>
          <option value="selected_equal">
            Chia đều cho danh sách được chọn
          </option>
          <option value="fixed_remainder">
            Cố định một phần, chia đều phần còn lại
          </option>
        </select>
      </label>
      {rule.mode === "equal" ? (
        <p className="hint">
          Tự chia cho {participants.length} người trong danh sách người tham
          gia. Không cần chọn người.
        </p>
      ) : (
        <>
          {rule.mode === "fixed_remainder" && (
            <>
              <div className="cost-fixed-list">
                {rule.fixed.map((entry, i) => (
                  <div className="cost-fixed-row" key={i}>
                    <label>
                      Người chịu phần cố định
                      <select
                        aria-label={`Người chịu phần cố định ${i + 1}`}
                        value={entry.participant_id}
                        onChange={(e) =>
                          onChange({
                            ...rule,
                            fixed: rule.fixed.map((x, j) =>
                              j === i
                                ? { ...x, participant_id: e.target.value }
                                : x,
                            ),
                          })
                        }
                      >
                        <option value="">Chọn người</option>
                        {participants.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Số tiền cố định
                      <input
                        inputMode="numeric"
                        aria-label={`Số tiền cố định ${i + 1}`}
                        value={formatMoneyInput(entry.amount || "")}
                        onChange={(e) =>
                          onChange({
                            ...rule,
                            fixed: rule.fixed.map((x, j) =>
                              i === j
                                ? {
                                    ...x,
                                    amount: parseMoneyInput(e.target.value),
                                  }
                                : x,
                            ),
                          })
                        }
                      />
                    </label>
                    {rule.fixed.length > 1 && (
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() =>
                          onChange({
                            ...rule,
                            fixed: rule.fixed.filter((_, j) => i !== j),
                          })
                        }
                      >
                        Bỏ
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-btn"
                onClick={() =>
                  onChange({
                    ...rule,
                    fixed: [...rule.fixed, { participant_id: "", amount: 0 }],
                  })
                }
              >
                Thêm phần cố định
              </button>
              <b>
                Phần còn lại:{" "}
                {money(total - rule.fixed.reduce((s, x) => s + x.amount, 0))}
              </b>
            </>
          )}
          <div className="cost-people">
            <span>
              {rule.mode === "selected_equal"
                ? "Chọn người được chia"
                : "Chọn người chia phần còn lại"}{" "}
              · {rule.participants.length} người
            </span>
            {participants.map((p) => (
              <label key={p.id}>
                <input
                  type="checkbox"
                  checked={rule.participants.includes(p.id)}
                  onChange={(e) =>
                    onChange({
                      ...rule,
                      participants: e.target.checked
                        ? [...rule.participants, p.id]
                        : rule.participants.filter((id) => id !== p.id),
                    })
                  }
                />
                {p.name}
              </label>
            ))}
          </div>
        </>
      )}
      {error ? (
        <p className="error" role="status">
          {error}
        </p>
      ) : (
        <div className="cost-preview" aria-label="Xem trước cách chia">
          {preview.map((p) => (
            <div key={p.participant_id}>
              <span>{p.name}</span>
              <b>{money(p.amount)}</b>
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function SharingDetail({ budget, bundle }: { budget: Budget; bundle: Bundle }) {
  if (!budget.cost_sharing)
    return (
      <p className="muted">
        Chưa khai báo cách chia. Sửa dự toán để thiết lập.
      </p>
    );
  let shares;
  try {
    shares = allocateCost(
      Number(budget.amount),
      budget.cost_sharing,
      bundle.participants,
    );
  } catch (e) {
    return <p className="error">{(e as Error).message}</p>;
  }
  const payments = costPayments(budget, bundle.expenses, bundle.participants);
  const unknownPaid = [...payments.paid].filter(
    ([id]) => !shares.some((p) => p.participant_id === id),
  );
  return (
    <div className="cost-detail">
      <div className="cost-summary">
        <span>
          Tổng khoản<b>{money(Number(budget.amount))}</b>
        </span>
        <span>
          Đã trả ròng<b>{money(payments.total)}</b>
        </span>
        <span>
          {payments.total > Number(budget.amount)
            ? "Trả vượt"
            : "Còn trả bên cung cấp"}
          <b>{money(Math.abs(Number(budget.amount) - payments.total))}</b>
        </span>
      </div>
      <div className="cost-person-head">
        <span>Người / Phần phải chịu</span>
        <span>Đã thanh toán trực tiếp</span>
      </div>
      {shares.map((p) => {
        const paid = payments.paid.get(p.participant_id) || 0,
          delta = p.amount - paid;
        return (
          <div className="cost-person" key={p.participant_id}>
            <div>
              <b>{p.name}</b>
              <span>{money(p.amount)}</span>
            </div>
            <div>
              <b>{money(paid)}</b>
              <small>
                {delta >= 0
                  ? "Chưa thanh toán trực tiếp"
                  : "Đã trả vượt phần chịu"}
                : {money(Math.abs(delta))}
              </small>
            </div>
          </div>
        );
      })}
      {payments.fund !== 0 && (
        <p className="hint">
          Đã chi từ quỹ: {money(payments.fund)}. Khoản quỹ không được gán thành
          thanh toán cá nhân; phần phải chịu vẫn là thỏa thuận chia chi phí.
        </p>
      )}
      {(payments.unassigned !== 0 || unknownPaid.length > 0) && (
        <p className="notice warning">
          Có thanh toán từ người chưa gán được vào cách chia:{" "}
          {money(
            payments.unassigned +
              unknownPaid.reduce((s, [, value]) => s + value, 0),
          )}
          . Kiểm tra người thanh toán của giao dịch.
        </p>
      )}
    </div>
  );
}

export function CostSharingReport({ bundle }: { bundle: Bundle }) {
  const [selected, setSelected] = useState("");
  const budget =
    bundle.budgets.find((b) => b.id === selected) || bundle.budgets[0];
  return (
    <section className="panel cost-sharing-report">
      <div className="section-heading">
        <h2>Phân chia chi phí</h2>
      </div>
      {budget ? (
        <>
          <label>
            Khoản dự toán
            <select
              aria-label="Khoản dự toán cần đối chiếu"
              value={budget.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {bundle.budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </label>
          <SharingDetail budget={budget} bundle={bundle} />
        </>
      ) : (
        <p>Thêm dự toán để khai báo cách chia.</p>
      )}
    </section>
  );
}
