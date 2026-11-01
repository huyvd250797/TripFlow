"use client";
import { useEffect, useId, useRef, useState } from "react";
import {
  Plus,
  Phone,
  MapPin,
  Pencil,
  Trash2,
  ClipboardCheck,
  CalendarDays,
} from "lucide-react";
import type {
  Bundle,
  ChecklistItem,
  Mutation,
  TravelContact,
} from "@/lib/types";
import {
  AGE_GROUPS,
  CONTACT_KINDS,
  PREPARATION_CATEGORIES,
  PACKING_TEMPLATES,
  checklistSchema,
  contactSchema,
  checklistBatchSchema,
  checklistComplete,
  copyPackingTemplate,
  filterPreparation,
  preparationProgress,
} from "@/lib/preparation";
import { dateLabel, parseDate } from "@/lib/domain";
import { Dialog } from "./ui/dialog";
import { beginAppWrite, setUpdateBlocker } from "@/lib/update-safety";

type FormSpec =
  | { type: "item"; row?: ChecklistItem }
  | { type: "contact"; row?: TravelContact }
  | { type: "template" };
export function PreparationModule({
  bundle,
  userId,
  onSave,
}: {
  bundle: Bundle;
  userId: string;
  onSave: (m: Mutation) => Promise<void>;
}) {
  const canEdit = bundle.role !== "viewer",
    items = bundle.checklist || [],
    contacts = bundle.contacts || [];
  const [filter, setFilter] = useState("all"),
    [me, setMe] = useState(""),
    [spec, setSpec] = useState<FormSpec | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const gate = useRef(false);
  const identityKey = `tripflow:preparation-person:${userId}:${bundle.trip.id}`;
  useEffect(() => {
    try {
      setMe(localStorage.getItem(identityKey) || "");
    } catch {}
  }, [identityKey]);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: bundle.trip.timezone,
  }).format(new Date());
  const p = preparationProgress(items, today),
    visible = filterPreparation(items, filter, me, bundle.participants);
  async function change(
    row: ChecklistItem | TravelContact,
    entity: "checklist" | "contact",
    action: "update" | "delete",
    patch = {},
  ) {
    if (!canEdit || gate.current) return;
    if (action === "delete" && !confirm("Xóa mục này?")) return;
    gate.current = true;
    setBusy(true);
    setError("");
    try {
      const schema = entity === "checklist" ? checklistSchema : contactSchema;
      await onSave({
        entity,
        action,
        operationId: crypto.randomUUID(),
        tripId: bundle.trip.id,
        id: row.id,
        version: row.version,
        data: action === "delete" ? {} : schema.parse({ ...row, ...patch }),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="panel preparation-module"
      aria-label="Chuẩn bị chuyến đi"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">SẴN SÀNG LÊN ĐƯỜNG</span>
          <h2>Chuẩn bị chuyến đi</h2>
        </div>
        {canEdit && (
          <div className="prep-actions">
            <button
              className="btn secondary small"
              onClick={() => setSpec({ type: "template" })}
            >
              Dùng mẫu
            </button>
            <button
              className="btn primary small"
              onClick={() => setSpec({ type: "item" })}
            >
              <Plus size={16} />
              Thêm mục
            </button>
          </div>
        )}
      </div>
      <div className="prep-progress">
        <ClipboardCheck size={24} />
        <div>
          <strong>
            {p.complete}/{p.total} mục hoàn tất
          </strong>
          <progress
            max={p.total || 1}
            value={p.complete}
            aria-label="Tiến độ chuẩn bị"
          />
        </div>
      </div>
      <div className="prep-counts">
        <span>{p.missing} chưa xong</span>
        <span className={p.overdue ? "error" : ""}>{p.overdue} quá hạn</span>
        <span>{p.unassigned} chưa phân công</span>
      </div>
      <div className="prep-toolbar">
        <label>
          Bạn là ai trong chuyến?
          <select
            value={bundle.participants.some((x) => x.id === me) ? me : ""}
            onChange={(e) => {
              setMe(e.target.value);
              try {
                localStorage.setItem(identityKey, e.target.value);
              } catch {}
            }}
          >
            <option value="">Chọn người tham gia</option>
            {bundle.participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lọc checklist
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Tất cả</option>
            <option value="mine">Của tôi</option>
            <option value="unfinished">Chưa xong</option>
            <option value="unassigned">Chưa phân công</option>
          </select>
        </label>
      </div>
      {filter === "mine" && !bundle.participants.some((x) => x.id === me) && (
        <p className="muted">
          Chọn người tham gia tương ứng với bạn để xem các mục được phân công.
        </p>
      )}
      {items.length === 0 && (
        <div className="prep-empty">
          Chưa có checklist. Thêm mục hoặc chọn mẫu phù hợp chuyến đi.
        </div>
      )}
      {items.length > 0 && !visible.length && (
        <p className="muted">Không có mục phù hợp bộ lọc.</p>
      )}
      {PREPARATION_CATEGORIES.map((category) => {
        const rows = visible.filter((x) => x.category === category);
        if (!rows.length) return null;
        return (
          <details key={category} className="prep-category" open>
            <summary>
              {category}
              <span>
                {rows.filter((x) => !x.excluded && checklistComplete(x)).length}
                /{rows.filter((x) => !x.excluded).length}
              </span>
            </summary>
            <div>
              {rows.map((row) => (
                <article
                  className={`prep-item ${row.excluded ? "is-excluded" : ""}`}
                  key={row.id}
                >
                  <div className="prep-item-title">
                    <strong>{row.title}</strong>
                    <small>
                      {row.scope === "personal" ? "Cá nhân" : "Dùng chung"} ·{" "}
                      {row.kind === "packing"
                        ? `SL ${row.quantity}`
                        : "Công việc"}
                    </small>
                    <small>
                      {bundle.participants.find((p) => p.id === row.assignee_id)
                        ?.name || "Chưa phân công"}
                      {row.due_on
                        ? ` · Hạn ${row.due_on.split("-").reverse().join("/")}`
                        : ""}
                    </small>
                    {row.due_on &&
                      row.due_on < today &&
                      !row.excluded &&
                      !checklistComplete(row) && (
                        <small className="error">Quá hạn</small>
                      )}
                    {row.note && <p>{row.note}</p>}
                  </div>
                  <div className="prep-item-control">
                    <label
                      className="sr-only"
                      htmlFor={`prep-status-${row.id}`}
                    >
                      Trạng thái {row.title}
                    </label>
                    <select
                      id={`prep-status-${row.id}`}
                      value={row.excluded ? "excluded" : row.status}
                      disabled={!canEdit || busy}
                      onChange={(e) =>
                        void change(
                          row,
                          "checklist",
                          "update",
                          e.target.value === "excluded"
                            ? { excluded: true }
                            : { excluded: false, status: e.target.value },
                        )
                      }
                    >
                      <option value="needed">
                        {row.kind === "task" ? "Chưa làm" : "Cần chuẩn bị"}
                      </option>
                      {row.kind === "packing" ? (
                        <>
                          <option value="ready">Đã có</option>
                          <option value="packed">Đã đóng gói</option>
                        </>
                      ) : (
                        <option value="done">Hoàn tất</option>
                      )}
                      <option value="excluded">Không áp dụng</option>
                    </select>
                    {canEdit && (
                      <div className="prep-actions">
                        <button
                          className="icon-btn"
                          aria-label={`Sửa ${row.title}`}
                          onClick={() => setSpec({ type: "item", row })}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-btn"
                          disabled={busy}
                          aria-label={`Xóa ${row.title}`}
                          onClick={() =>
                            void change(row, "checklist", "delete")
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </details>
        );
      })}
      <details className="prep-category">
        <summary>
          Gia đình & nhu cầu<span>{bundle.participants.length} người</span>
        </summary>
        <div className="prep-family">
          {bundle.participants.length ? (
            bundle.participants.map((p) => (
              <article key={p.id}>
                <strong>{p.name}</strong>
                <small>
                  {AGE_GROUPS[p.age_group || "adult"]}
                  {p.family_group ? ` · ${p.family_group}` : ""}
                </small>
                {p.needs_note && <p>{p.needs_note}</p>}
              </article>
            ))
          ) : (
            <p>Thêm người tại Thêm → Người tham gia.</p>
          )}
          <p className="muted">
            Chỉnh nhóm tuổi, gia đình và nhu cầu tại Người tham gia.
          </p>
        </div>
      </details>
      <div className="section-heading">
        <h3>Liên hệ cần thiết</h3>
        {canEdit && (
          <button
            className="btn secondary small"
            onClick={() => setSpec({ type: "contact" })}
          >
            <Plus size={16} />
            Thêm liên hệ
          </button>
        )}
      </div>
      {!contacts.length && (
        <p className="muted">
          Lưu liên hệ khách sạn, tài xế hoặc người thân để tra cứu nhanh.
        </p>
      )}
      {contacts.map((c) => (
        <article className="prep-contact" key={c.id}>
          <div>
            <small>{CONTACT_KINDS[c.kind]}</small>
            <strong>{c.name}</strong>
            {c.address && <p>{c.address}</p>}
            {c.note && <p>{c.note}</p>}
            <div className="prep-actions">
              {c.phone && (
                <a
                  className="text-btn"
                  href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}
                >
                  <Phone size={15} />
                  {c.phone}
                </a>
              )}
              {c.map_url && (
                <a
                  className="text-btn"
                  href={c.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={15} />
                  Bản đồ
                </a>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="prep-actions">
              <button
                className="icon-btn"
                aria-label={`Sửa liên hệ ${c.name}`}
                onClick={() => setSpec({ type: "contact", row: c })}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-btn"
                disabled={busy}
                aria-label={`Xóa liên hệ ${c.name}`}
                onClick={() => void change(c, "contact", "delete")}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </article>
      ))}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {spec && canEdit && (
        <PreparationForm
          key={spec.type + ("row" in spec ? spec.row?.id || "new" : "")}
          spec={spec}
          bundle={bundle}
          onClose={() => setSpec(null)}
          onSave={onSave}
        />
      )}
    </section>
  );
}
function PreparationForm({
  spec,
  bundle,
  onClose,
  onSave,
}: {
  spec: FormSpec;
  bundle: Bundle;
  onClose: () => void;
  onSave: (m: Mutation) => Promise<void>;
}) {
  const row = "row" in spec ? spec.row : undefined;
  const draftKey = useId();
  const [values, setValues] = useState<Record<string, any>>(() =>
    spec.type === "contact"
      ? {
          name: "",
          kind: "hotel",
          phone: "",
          address: "",
          map_url: "",
          note: "",
          ...row,
        }
      : {
          title: "",
          kind: "packing",
          category: "Hành lý",
          scope: "shared",
          assignee_id: "",
          quantity: 1,
          status: "needed",
          excluded: false,
          note: "",
          template: "beach",
          ...row,
          due_on:
            row && "due_on" in row && row.due_on ? dateLabel(row.due_on) : "",
        },
  );
  const [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const gate = useRef(false);
  useEffect(() => {
    setUpdateBlocker(
      draftKey,
      dirty ? "Bạn có nội dung chuẩn bị chưa lưu." : undefined,
    );
    return () => setUpdateBlocker(draftKey);
  }, [dirty, draftKey]);
  const close = () => {
    if (!busy && (!dirty || confirm("Bạn có thay đổi chưa lưu. Đóng form?")))
      onClose();
  };
  const set = (key: string, value: unknown) => {
    setDirty(true);
    setValues((v) => ({
      ...v,
      [key]: value,
      ...(key === "kind" && spec.type === "item" ? { status: "needed" } : {}),
    }));
  };
  const field = (
    key: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <div className="field" key={key}>
      <label htmlFor={`prep-field-${key}`}>{label}</label>
      {type === "date" ? (
        <div className="date-field">
          <input
            id={`prep-field-${key}`}
            placeholder="DD/MM/YYYY"
            inputMode="numeric"
            maxLength={10}
            value={values[key] || ""}
            onChange={(e) => set(key, e.target.value)}
          />
          <label className="calendar-label" title="Chọn từ lịch">
            <CalendarDays size={20} />
            <input
              type="date"
              aria-label="Chọn hạn chuẩn bị"
              onChange={(e) =>
                set(key, e.target.value ? dateLabel(e.target.value) : "")
              }
            />
          </label>
        </div>
      ) : type === "textarea" ? (
        <textarea
          id={`prep-field-${key}`}
          maxLength={5000}
          value={values[key] || ""}
          onChange={(e) => set(key, e.target.value)}
        />
      ) : (
        <input
          id={`prep-field-${key}`}
          type={type}
          required={required}
          maxLength={key === "map_url" ? 3000 : key === "address" ? 500 : 200}
          min={type === "number" ? 1 : undefined}
          max={type === "number" ? 999 : undefined}
          value={values[key] ?? ""}
          onChange={(e) => set(key, e.target.value)}
        />
      )}
    </div>
  );
  const select = (key: string, label: string, options: [string, string][]) => (
    <div className="field" key={key}>
      <label htmlFor={`prep-field-${key}`}>{label}</label>
      <select
        id={`prep-field-${key}`}
        value={values[key] || ""}
        onChange={(e) => set(key, e.target.value)}
      >
        {options.map(([v, text]) => (
          <option value={v} key={v}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    const end = beginAppWrite();
    try {
      const due =
        spec.type !== "contact" && values.due_on
          ? parseDate(String(values.due_on))
          : null;
      let data: Record<string, unknown>, entity: Mutation["entity"];
      if (spec.type === "template") {
        entity = "checklist_batch";
        data = checklistBatchSchema.parse({
          entries: copyPackingTemplate(
            values.template,
            values.assignee_id || null,
            values.scope,
            due,
          ),
        });
      } else {
        entity = spec.type === "item" ? "checklist" : "contact";
        data = (spec.type === "item" ? checklistSchema : contactSchema).parse({
          ...values,
          ...(spec.type === "item" ? { due_on: due } : {}),
        });
      }
      await onSave({
        entity,
        action: row ? "update" : "create",
        tripId: bundle.trip.id,
        operationId: crypto.randomUUID(),
        id: row?.id || crypto.randomUUID(),
        version: row?.version,
        data,
      });
      onClose();
    } catch (e) {
      setError(
        (e as { issues?: { message: string }[] }).issues?.[0]?.message ||
          (e as Error).message,
      );
    } finally {
      gate.current = false;
      setBusy(false);
      end();
    }
  }
  return (
    <Dialog
      open
      onClose={close}
      busy={busy}
      title={
        spec.type === "template"
          ? "Dùng mẫu chuẩn bị"
          : `${row ? "Sửa" : "Thêm"} ${spec.type === "item" ? "mục chuẩn bị" : "liên hệ"}`
      }
    >
      <form className="editor-form prep-form" onSubmit={submit}>
        <div className="dialog-body form-grid">
          {spec.type === "contact" ? (
            <>
              {field("name", "Tên liên hệ *", "text", true)}
              {select("kind", "Loại liên hệ", Object.entries(CONTACT_KINDS))}
              {field("phone", "Số điện thoại", "tel")}
              {field("address", "Địa chỉ")}
              {field("map_url", "Liên kết bản đồ HTTPS", "url")}
              {field("note", "Ghi chú", "textarea")}
            </>
          ) : (
            <>
              {spec.type === "template" ? (
                <>
                  {select(
                    "template",
                    "Mẫu hành lý",
                    PACKING_TEMPLATES.map((t) => [
                      t.id,
                      `${t.name} · ${t.items.length} mục`,
                    ]),
                  )}
                  <p className="muted full">
                    Mỗi lần áp dụng tạo một bản sao độc lập. Các mục cá nhân vẫn
                    được mọi thành viên có quyền xem chuyến đi nhìn thấy.
                  </p>
                </>
              ) : (
                <>
                  {field("title", "Tên mục *", "text", true)}
                  {select("kind", "Loại mục", [
                    ["packing", "Đồ cần mang"],
                    ["task", "Việc cần làm"],
                  ])}
                  {select(
                    "category",
                    "Nhóm",
                    PREPARATION_CATEGORIES.map((c) => [c, c]),
                  )}
                  {field("quantity", "Số lượng", "number", true)}
                </>
              )}
              {select("scope", "Phạm vi", [
                ["shared", "Dùng chung"],
                ["personal", "Cá nhân"],
              ])}
              {select("assignee_id", "Người phụ trách", [
                ["", "Chưa phân công"],
                ...bundle.participants.map(
                  (p) => [p.id, p.name] as [string, string],
                ),
              ])}
              {field("due_on", "Hạn chuẩn bị", "date")}
              {spec.type !== "template" && (
                <>
                  {select(
                    "status",
                    "Trạng thái",
                    values.kind === "task"
                      ? [
                          ["needed", "Chưa làm"],
                          ["done", "Hoàn tất"],
                        ]
                      : [
                          ["needed", "Cần chuẩn bị"],
                          ["ready", "Đã có"],
                          ["packed", "Đã đóng gói"],
                        ],
                  )}
                  {field("note", "Ghi chú", "textarea")}
                  <label className="full">
                    <input
                      type="checkbox"
                      checked={values.excluded}
                      onChange={(e) => set("excluded", e.target.checked)}
                    />{" "}
                    Không áp dụng
                  </label>
                </>
              )}
            </>
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
            {busy
              ? "Đang lưu…"
              : spec.type === "template"
                ? "Áp dụng mẫu"
                : "Lưu thay đổi"}
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
