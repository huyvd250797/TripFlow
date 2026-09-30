"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Check, CalendarDays } from "lucide-react";
import { Dialog } from "./ui/dialog";
import {
  CATEGORIES,
  ZONES,
  TRIP_STATUS,
  type Entity,
  type Bundle,
  type Mutation,
} from "@/lib/types";
import { dateLabel, parseDate, localTime, utcTime } from "@/lib/domain";
import { expenseContextWarnings, itemContextWarnings } from "@/lib/smart-defaults";
import { inferExpenseCategory } from "@/lib/expense-intelligence";
import { schemas } from "@/lib/validation";
export type EditSpec = {
  entity: Entity;
  record?: Record<string, unknown>;
  defaults?: Record<string, unknown>;
  smartHints?: string[];
};
type Field = {
  key: string;
  label: string;
  kind?: string;
  options?: [string, string][];
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
};
const pair = (xs: readonly string[]): [string, string][] =>
  xs.map((x) => [x, x]);
const formatMoneyInput = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Number(digits));
};
const parseMoneyInput = (value: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
};
export function Editor({
  spec,
  bundle,
  onClose,
  onSave,
}: {
  spec: EditSpec;
  bundle?: Bundle;
  onClose: () => void;
  onSave: (m: Mutation) => Promise<void>;
}) {
  const zone = bundle?.trip.timezone || "Asia/Ho_Chi_Minh";
  const today = localTime(new Date().toISOString(), zone).slice(0, 10),
    row = spec.record;
  const initial: Record<string, unknown> = {
    note: "",
    title: "",
    name: "",
    destination: "",
    people: 1,
    timezone: zone,
    status: "planning",
    category: CATEGORIES[0],
    item_id: "",
    quantity: 1,
    unit_price: "",
    amount: "",
    payer: "",
    location: "",
    map_url: "",
    receipt_url: "",
    url: "",
    role: "editor",
    email: "",
    budget_id: "",
    refund_of: "",
    kind: spec.entity === "media" ? "album" : "payment",
    taken_on: "",
    is_highlight: false,
    is_cover: false,
    story_order: 0,
    start_date: dateLabel(today),
    end_date: "",
    spent_on: dateLabel(today),
    start_at: (bundle?.trip.start_date || today) + "T09:00",
    end_at: "",
    ...spec.defaults,
    ...row,
  };
  const source = row || spec.defaults;
  if (source) {
    for (const k of ["start_date", "end_date", "spent_on", "taken_on"])
      if (source[k]) initial[k] = dateLabel(String(source[k]));
    for (const k of ["start_at", "end_at"])
      if (source[k]) initial[k] = localTime(String(source[k]), zone);
  }
  for (const k of ["unit_price", "amount"])
    if (initial[k] !== "" && initial[k] != null) initial[k] = formatMoneyInput(initial[k]);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty },
  } = useForm<Record<string, unknown>>({ defaultValues: initial });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const operation = useRef<{ hash: string; id: string } | null>(null);
  const id = useRef(crypto.randomUUID());
  const fields: Field[] = [];
  const title = (label = "Tên khoản *") =>
    fields.push({ key: "title", label, required: true });
  const f = (key: string, label: string, kind = "text", required = false) =>
    fields.push({ key, label, kind, required });
  const sel = (key: string, label: string, options: [string, string][]) =>
    fields.push({ key, label, kind: "select", options });
  const itemOptions: [string, string][] = [
    ["", "Không gắn hoạt động"],
    ...(bundle?.items || []).map((x) => [x.id, x.title] as [string, string]),
  ];
  const participantNames = [...new Set((bundle?.participants || []).map((x) => x.name.trim()).filter(Boolean))];
  const legacyPayer = row?.payer ? String(row.payer).trim() : "";
  const payerOptions: [string, string][] = [
    ["", participantNames.length ? "Chọn người thanh toán" : "Chưa có người tham gia"],
    ...participantNames.map((name) => [name, name] as [string, string]),
    ...(legacyPayer && !participantNames.includes(legacyPayer)
      ? [[legacyPayer, `${legacyPayer} (dữ liệu cũ)`] as [string, string]]
      : []),
  ];
  if (spec.entity === "trip") {
    f("name", "Tên chuyến đi *", "text", true);
    f("destination", "Điểm đến *", "text", true);
    f("start_date", "Ngày bắt đầu *", "day", true);
    f("end_date", "Ngày kết thúc (không bắt buộc)", "day");
    fields.push({
      key: "people",
      label: "Số người *",
      kind: "number",
      min: "1",
      max: "999",
      step: "1",
      required: true,
    });
    sel("timezone", "Múi giờ", pair(ZONES));
    sel("status", "Trạng thái", Object.entries(TRIP_STATUS));
  }
  if (spec.entity === "item") {
    title("Hoạt động *");
    f("location", "Địa điểm");
    f("start_at", "Bắt đầu *", "datetime-local", true);
    f("end_at", "Kết thúc (không bắt buộc)", "datetime-local");
    f("map_url", "Link Google Maps", "url");
  }
  if (spec.entity === "budget") {
    title();
    sel("category", "Nhóm chi phí", pair(CATEGORIES));
    sel("item_id", "Thuộc hoạt động", itemOptions);
    fields.push(
      {
        key: "quantity",
        label: "Số lượng *",
        kind: "number",
        min: ".01",
        max: "100000",
        step: ".01",
        required: true,
      },
      {
        key: "unit_price",
        label: "Đơn giá VNĐ *",
        kind: "money",
        min: "0",
        max: "1000000000000",
        step: "1",
        required: true,
      },
    );
  }
  if (spec.entity === "expense") {
    f("amount", "Số tiền VNĐ *", "money", true);
    title("Nội dung chi *");
    sel("kind", "Loại giao dịch", [
      ["payment", "Chi tiền"],
      ["refund", "Hoàn tiền"],
    ]);
    if (watch("kind") === "refund")
      sel("refund_of", "Khoản chi được hoàn", [
        ["", "Chọn khoản chi"],
        ...(bundle?.expenses || [])
          .filter((x) => x.kind === "payment" && x.id !== row?.id)
          .map((x) => [x.id, x.title] as [string, string]),
      ]);
    else
      sel("budget_id", "Thuộc khoản dự toán", [
        ["", "Ngoài dự toán / chưa liên kết"],
        ...(bundle?.budgets || []).map(
          (x) => [x.id, x.title] as [string, string],
        ),
      ]);
    sel("category", "Nhóm chi phí", pair(CATEGORIES));
    f("spent_on", "Ngày chi *", "day", true);
    sel("payer", "Người thanh toán", payerOptions);
    f("receipt_url", "Link hóa đơn hoặc chứng từ", "url");
  }
  if (spec.entity === "media") {
    title("Tên album hoặc tài liệu *");
    sel("kind", "Loại media", [
      ["album", "Album ảnh"],
      ["photo", "Ảnh"],
      ["video", "Video"],
      ["document", "Tài liệu"],
    ]);
    f("url", "Liên kết Google Drive hoặc HTTPS *", "url", true);
    sel("item_id", "Thuộc hoạt động", itemOptions);
    f("taken_on", "Ngày kỷ niệm", "day");
    f("story_order", "Thứ tự kể chuyện", "number");
    f("is_highlight", "Đánh dấu Trip Highlight", "checkbox");
    f("is_cover", "Dùng làm ảnh bìa chuyến đi", "checkbox");
    f("note", "Caption / câu chuyện", "textarea");
  }
  if (spec.entity === "participant")
    f("name", "Tên người tham gia *", "text", true);
  if (spec.entity === "invitation") {
    f("email", "Email người được mời *", "email", true);
    sel("role", "Vai trò", [
      ["editor", "Được chỉnh sửa"],
      ["viewer", "Chỉ xem"],
    ]);
  }
  if (spec.entity === "member")
    sel("role", "Vai trò", [
      ["editor", "Được chỉnh sửa"],
      ["viewer", "Chỉ xem"],
    ]);
  if (spec.entity === "snapshot") title("Tên lần chốt dự toán *");
  if (!["invitation", "member", "snapshot", "media"].includes(spec.entity))
    f("note", "Ghi chú", "textarea");
  const names: Record<Entity, string> = {
    trip: "chuyến đi",
    item: "hoạt động",
    budget: "dự toán",
    expense: "chi tiêu",
    media: "liên kết media",
    participant: "người tham gia",
    invitation: "lời mời",
    member: "quyền thành viên",
    snapshot: "lần chốt dự toán",
  };
  const close = () => {
    if (
      !busy &&
      (!isDirty || window.confirm("Bạn có thay đổi chưa lưu. Đóng form?"))
    )
      onClose();
  };
  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      const data = { ...values };
      for (const k of ["start_date", "end_date", "spent_on", "taken_on"]) {
        if (!fields.some((f) => f.key === k)) continue;
        if (data[k]) data[k] = parseDate(String(data[k]));
        else if (k === "end_date") data[k] = null;
      }
      for (const k of ["start_at", "end_at"]) {
        if (!fields.some((f) => f.key === k)) continue;
        if (data[k]) data[k] = utcTime(String(data[k]), zone);
        else if (k === "end_at") data[k] = null;
      }
      for (const k of ["unit_price", "amount"])
        if (fields.some((f) => f.key === k)) data[k] = parseMoneyInput(data[k]);
      const parsed = schemas[spec.entity].safeParse(data);
      if (!parsed.success) throw Error(parsed.error.issues[0].message);
      const hash = JSON.stringify(parsed.data);
      if (!operation.current || operation.current.hash !== hash)
        operation.current = { hash, id: crypto.randomUUID() };
      setBusy(true);
      await onSave({
        operationId: operation.current.id,
        tripId:
          spec.entity === "trip"
            ? String(row?.id || id.current)
            : bundle!.trip.id,
        entity: spec.entity,
        action: row ? "update" : "create",
        ...(row
          ? { id: String(row.id), version: Number(row.version) }
          : spec.entity === "trip"
            ? {}
            : { id: id.current }),
        data: parsed.data,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được dữ liệu.");
    } finally {
      setBusy(false);
    }
  });
  const setCurrentValue = (field: Field) => {
    const current = localTime(new Date().toISOString(), zone);
    setValue(
      field.key,
      field.kind === "day" ? dateLabel(current.slice(0, 10)) : current,
      { shouldDirty: true },
    );
  };
  const linkedCategory =
    spec.entity === "expense"
      ? watch("kind") === "refund"
        ? bundle?.expenses.find((x) => x.id === watch("refund_of"))?.category
        : bundle?.budgets.find((x) => x.id === watch("budget_id"))?.category
      : undefined;
  const categorySuggestion =
    !row && bundle && spec.entity === "expense" && watch("kind") !== "refund" && !linkedCategory
      ? inferExpenseCategory(String(watch("title") || ""), bundle.expenses)
      : null;
  const contextWarnings =
    !row && bundle && spec.entity === "expense" && watch("kind") !== "refund"
      ? expenseContextWarnings(bundle, {
          amount: parseMoneyInput(watch("amount")),
          category: String(linkedCategory || watch("category") || ""),
          budget_id: String(watch("budget_id") || ""),
        })
      : !row && bundle && spec.entity === "item" && watch("start_at")
        ? itemContextWarnings(bundle, { start_local: String(watch("start_at")) })
        : [];
  return (
    <Dialog
      open
      onClose={close}
      title={`${row ? "Chỉnh sửa" : "Thêm"} ${names[spec.entity]}`}
    >
      <form onSubmit={submit} className="editor-form">
        <div className="dialog-body form-grid">
          {!row && spec.smartHints && spec.smartHints.length > 0 && (
            <div className="smart-default-banner full">
              <span><Check size={16} /> Smart Defaults</span>
              <p>{spec.smartHints.join(" · ")}</p>
              <small>Đây là gợi ý theo dữ liệu gần nhất; bạn vẫn có thể sửa trước khi lưu.</small>
            </div>
          )}
          {categorySuggestion && categorySuggestion !== "Khác" && categorySuggestion !== String(watch("category") || "") && (
            <div className="expense-category-suggestion full">
              <div>
                <span>Gợi ý nhóm chi</span>
                <b>{categorySuggestion}</b>
                <small>Dựa trên nội dung khoản chi và lịch sử gần nhất.</small>
              </div>
              <button
                type="button"
                className="btn secondary"
                onClick={() => setValue("category", categorySuggestion, { shouldDirty: true })}
              >
                Dùng gợi ý
              </button>
            </div>
          )}
          {contextWarnings.length > 0 && (
            <div className="context-warning-banner full">
              {contextWarnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          )}
          {fields.map((field) => (
            <div
              className={`field ${["textarea", "url"].includes(field.kind || "") ? "full" : ""}`}
              key={field.key}
            >
              {field.kind !== "checkbox" && <label htmlFor={"tf-field-" + field.key}>{field.label}</label>}
              {field.kind === "select" ? (
                <select
                  id={"tf-field-" + field.key}
                  aria-label={field.label}
                  {...register(field.key)}
                  {...(field.key === "category" && linkedCategory
                    ? { value: linkedCategory, disabled: true }
                    : {})}
                >
                  {field.options?.map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : field.kind === "textarea" ? (
                <textarea
                  id={"tf-field-" + field.key}
                  {...register(field.key)}
                  rows={3}
                  maxLength={5000}
                />
              ) : field.kind === "checkbox" ? (
                <label className="check-field" htmlFor={"tf-field-" + field.key}>
                  <input
                    id={"tf-field-" + field.key}
                    type="checkbox"
                    {...register(field.key)}
                  />
                  <span>{field.label}</span>
                </label>
              ) : field.kind === "day" ? (
                <div className="date-field">
                  <input
                    id={"tf-field-" + field.key}
                    {...register(field.key)}
                    placeholder="DD/MM/YYYY"
                    required={field.required}
                    inputMode="numeric"
                    maxLength={10}
                  />
                  <label className="calendar-label" title="Chọn từ lịch">
                    <CalendarDays size={20} />
                    <input
                      type="date"
                      aria-label={`Chọn ${field.label}`}
                      onChange={(e) =>
                        e.target.value &&
                        setValue(field.key, dateLabel(e.target.value), {
                          shouldDirty: true,
                        })
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="current-time-btn"
                    title="Lấy ngày hiện tại"
                    aria-label={`Lấy ngày hiện tại cho ${field.label}`}
                    onClick={() => setCurrentValue(field)}
                  >
                    <Check size={18} />
                  </button>
                </div>
              ) : field.kind === "datetime-local" ? (
                <div className="date-field datetime-field">
                  <input
                    id={"tf-field-" + field.key}
                    {...register(field.key)}
                    type="datetime-local"
                    required={field.required}
                  />
                  <button
                    type="button"
                    className="current-time-btn"
                    title="Lấy ngày giờ hiện tại"
                    aria-label={`Lấy ngày giờ hiện tại cho ${field.label}`}
                    onClick={() => setCurrentValue(field)}
                  >
                    <Check size={18} />
                  </button>
                </div>
              ) : field.kind === "money" ? (
                <input
                  id={"tf-field-" + field.key}
                  {...register(field.key)}
                  type="text"
                  required={field.required}
                  inputMode="numeric"
                  placeholder="0"
                  onInput={(event) => {
                    const input = event.currentTarget;
                    const formatted = formatMoneyInput(input.value);
                    input.value = formatted;
                    setValue(field.key, formatted, { shouldDirty: true });
                  }}
                />
              ) : (
                <input
                  id={"tf-field-" + field.key}
                  {...register(field.key)}
                  type={field.kind || "text"}
                  required={field.required}
                  min={field.min || (field.key === "amount" ? "1" : undefined)}
                  max={
                    field.max ||
                    (field.key === "amount" ? "1000000000000" : undefined)
                  }
                  step={
                    field.step || (field.key === "amount" ? "1" : undefined)
                  }
                  maxLength={
                    field.kind === "url"
                      ? 3000
                      : field.key === "name"
                        ? 160
                        : 200
                  }
                  inputMode={field.kind === "number" ? "decimal" : undefined}
                />
              )}
            </div>
          ))}
          {spec.entity === "item" && (
            <p className="hint full">
              Giờ tại {zone}. Google Maps: chọn địa điểm → Chia sẻ → Sao chép đường liên kết rồi dán trực tiếp link maps.app.goo.gl vào đây; TripFlow V1.8.4 giữ nguyên link bạn dán và chỉ đọc tọa độ ngầm khi cần. Ngày/giờ kết thúc có thể để trống.
            </p>
          )}
          {spec.entity === "expense" && linkedCategory && (
            <p className="hint full">
              Nhóm chi phí kế thừa từ khoản đã liên kết: {linkedCategory}.
            </p>
          )}
          {spec.entity === "media" && (
            <p className="hint full">
              App chỉ lưu liên kết. Người xem cần quyền tại Google Drive hoặc
              trang nguồn.
            </p>
          )}
          {spec.entity === "snapshot" && (
            <p className="hint full">
              Lần chốt đầu tiên là dự toán gốc bất biến. Các lần chốt sau chỉ
              lưu lịch sử điều chỉnh và không thay thế baseline.
            </p>
          )}
          {error && (
            <p className="error full" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="dialog-footer">
          <button
            type="button"
            className="btn secondary"
            onClick={close}
            disabled={busy}
          >
            Hủy
          </button>
          <button className="btn primary" disabled={busy}>
            <Check size={18} />
            {busy ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
