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
import { schemas } from "@/lib/validation";
export type EditSpec = {
  entity: Entity;
  record?: Record<string, unknown>;
  defaults?: Record<string, unknown>;
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
    start_date: dateLabel(today),
    end_date: dateLabel(today),
    spent_on: dateLabel(today),
    start_at: (bundle?.trip.start_date || today) + "T09:00",
    end_at: (bundle?.trip.start_date || today) + "T10:00",
    ...spec.defaults,
    ...row,
  };
  const source = row || spec.defaults;
  if (source) {
    for (const k of ["start_date", "end_date", "spent_on"])
      if (source[k]) initial[k] = dateLabel(String(source[k]));
    for (const k of ["start_at", "end_at"])
      if (source[k]) initial[k] = localTime(String(source[k]), zone);
  }
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
  if (spec.entity === "trip") {
    f("name", "Tên chuyến đi *", "text", true);
    f("destination", "Điểm đến *", "text", true);
    f("start_date", "Ngày bắt đầu *", "day", true);
    f("end_date", "Ngày kết thúc *", "day", true);
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
    f("end_at", "Kết thúc *", "datetime-local", true);
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
        kind: "number",
        min: "0",
        max: "1000000000000",
        step: "1",
        required: true,
      },
    );
  }
  if (spec.entity === "expense") {
    f("amount", "Số tiền VNĐ *", "number", true);
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
    f("payer", "Người thanh toán");
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
  if (!["invitation", "member", "snapshot"].includes(spec.entity))
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
      for (const k of ["start_date", "end_date", "spent_on"])
        if (fields.some((f) => f.key === k))
          data[k] = parseDate(String(data[k]));
      for (const k of ["start_at", "end_at"])
        if (fields.some((f) => f.key === k))
          data[k] = utcTime(String(data[k]), zone);
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
  const linkedCategory =
    spec.entity === "expense"
      ? watch("kind") === "refund"
        ? bundle?.expenses.find((x) => x.id === watch("refund_of"))?.category
        : bundle?.budgets.find((x) => x.id === watch("budget_id"))?.category
      : undefined;
  return (
    <Dialog
      open
      onClose={close}
      title={`${row ? "Chỉnh sửa" : "Thêm"} ${names[spec.entity]}`}
    >
      <form onSubmit={submit} className="editor-form">
        <div className="dialog-body form-grid">
          {fields.map((field) => (
            <div
              className={`field ${["textarea", "url"].includes(field.kind || "") ? "full" : ""}`}
              key={field.key}
            >
              <label htmlFor={"tf-field-" + field.key}>{field.label}</label>
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
              ) : field.kind === "day" ? (
                <div className="date-field">
                  <input
                    id={"tf-field-" + field.key}
                    {...register(field.key)}
                    placeholder="DD/MM/YYYY"
                    required
                    inputMode="numeric"
                    maxLength={10}
                  />
                  <label className="calendar-label">
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
                </div>
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
              Giờ tại {zone}. Hoạt động phải nằm trong ngày chuyến đi.
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
