"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, MapPin, Plus, SlidersHorizontal } from "lucide-react";
import type { Bundle, Item, Mutation, TravelWish } from "@/lib/types";
import { dateLabel, localTime, utcTime } from "@/lib/domain";
import {
  TRAVEL_MODES,
  directionsUrl,
  previewShift,
  routeBatchSchema,
  routeContext,
  routeIssues,
  routeItemSchema,
  wishSchema,
  wishToItem,
} from "@/lib/flexible-planning";
import { beginAppWrite, setUpdateBlocker } from "@/lib/update-safety";
import { Dialog } from "./ui/dialog";
type Save = (m: Mutation) => Promise<void>;
type Plan = {
  data: Record<string, unknown>;
  before: Item[];
  after: Item[];
  issues: ReturnType<typeof routeIssues>;
  description: string;
};
const sorted = (items: Item[]) =>
  items
    .filter((x) => x.status !== "skipped")
    .sort(
      (a, b) =>
        Date.parse(a.start_at) - Date.parse(b.start_at) ||
        a.id.localeCompare(b.id),
    );
const stamp = (value: string | null | undefined) =>
  value ? new Date(value).toISOString() : null;
const itemData = (x: Item) =>
  routeItemSchema.parse({
    ...x,
    start_at: stamp(x.start_at),
    end_at: stamp(x.end_at),
    earliest_at: stamp(x.earliest_at),
    latest_at: stamp(x.latest_at),
  });
const clock = (x: string | null, zone: string) =>
  x
    ? `${dateLabel(localTime(x, zone))} ${localTime(x, zone).slice(11, 16)}`
    : "Chưa có giờ kết thúc";
function useDraft(dirty: boolean) {
  const key = useId();
  useEffect(() => {
    setUpdateBlocker(
      key,
      dirty ? "Hãy lưu hoặc đóng phần điều chỉnh lịch đang nhập." : undefined,
    );
    return () => setUpdateBlocker(key);
  }, [key, dirty]);
}
function useSave() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const gate = useRef(false);
  return {
    busy,
    error,
    run: async (fn: () => Promise<void>) => {
      if (gate.current) return;
      gate.current = true;
      setBusy(true);
      setError("");
      const end = beginAppWrite();
      try {
        await fn();
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
    },
  };
}
function action(
  entity: Mutation["entity"],
  bundle: Bundle,
  data: Record<string, unknown>,
  row?: { id: string; version: number },
  type: Mutation["action"] = row ? "update" : "create",
): Mutation {
  return {
    entity,
    tripId: bundle.trip.id,
    operationId: crypto.randomUUID(),
    action: type,
    id: row?.id || crypto.randomUUID(),
    version: row?.version,
    data,
  };
}
function contextFor(bundle: Bundle, days: string[]) {
  const context = routeContext(bundle.items, days, bundle.trip.timezone);
  if (context.length > 200)
    throw new Error(
      "Điều chỉnh hàng loạt hỗ trợ tối đa 200 hoạt động đang trong lịch. Hãy sửa riêng hoạt động ở chuyến dài hơn.",
    );
  return context;
}
export function RouteLeg({
  item,
  items,
  zone,
}: {
  item: Item;
  items: Item[];
  zone: string;
}) {
  const sequence = sorted(items),
    i = sequence.findIndex((x) => x.id === item.id),
    prev = sequence[i - 1];
  return (
    <div className="route-leg">
      <span className="route-time-badge">
        {item.time_mode === "fixed" ? "Giờ cố định" : "Linh hoạt"}
      </span>
      {item.earliest_at && (
        <small>Không bắt đầu trước {clock(item.earliest_at, zone)}</small>
      )}
      {item.latest_at && (
        <small>Hoàn tất trước {clock(item.latest_at, zone)}</small>
      )}
      {prev && (
        <>
          <span>
            {item.leg_from_id === prev.id && item.travel_minutes != null
              ? `${TRAVEL_MODES[item.travel_mode || "other"]} · ${item.travel_minutes}′ + ${item.buffer_minutes || 0}′ dự phòng`
              : "Chưa xác nhận chặng di chuyển"}
          </span>
          <button
            type="button"
            className="text-btn"
            aria-label={`Chặng đến ${item.title}`}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("tripflow:edit-leg", {
                  detail: { id: item.id },
                }),
              )
            }
          >
            <SlidersHorizontal size={14} />
            Chặng
          </button>
          {directionsUrl(prev, item) && (
            <a
              className="text-btn"
              href={directionsUrl(prev, item)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={14} />
              Chỉ đường
            </a>
          )}
        </>
      )}
    </div>
  );
}
export function RoutePlanning({
  bundle,
  onSave,
}: {
  bundle: Bundle;
  onSave: Save;
}) {
  const canEdit = bundle.role !== "viewer",
    [target, setTarget] = useState("");
  const [spec, setSpec] = useState<
    | { type: "shift" | "leg"; id: string; minutes?: number; day?: string }
    | { type: "wishes" }
    | { type: "wish-edit"; wish?: TravelWish }
    | { type: "wish-use"; wish: TravelWish; replace: boolean }
    | { type: "issues" }
    | null
  >(null);
  useEffect(() => {
    const shift = (e: Event) => {
      if (canEdit) setSpec({ type: "shift", ...(e as CustomEvent).detail });
    };
    const leg = (e: Event) =>
      setSpec({ type: "leg", ...(e as CustomEvent).detail });
    window.addEventListener("tripflow:adjust-itinerary", shift);
    window.addEventListener("tripflow:edit-leg", leg);
    return () => {
      window.removeEventListener("tripflow:adjust-itinerary", shift);
      window.removeEventListener("tripflow:edit-leg", leg);
    };
  }, [canEdit]);
  const issues = routeIssues(bundle.items, bundle.trip.timezone),
    selected =
      spec && "id" in spec
        ? bundle.items.find((x) => x.id === spec.id)
        : undefined;
  return (
    <section className="panel route-planner" aria-label="Điều phối lịch trình">
      <div className="section-heading">
        <h3>Điều phối lịch trình</h3>
        <div className="route-action-group">
          <button
            className="btn secondary small"
            onClick={() => setSpec({ type: "wishes" })}
          >
            Muốn đi · {bundle.wishes?.length || 0}
          </button>
          <button
            className="btn secondary small"
            onClick={() => setSpec({ type: "issues" })}
          >
            Kiểm tra lịch{issues.length ? ` · ${issues.length}` : ""}
          </button>
        </div>
      </div>
      {canEdit && (
        <div className="route-adjust-picker">
          <label className="sr-only" htmlFor="route-adjust-target">
            Hoạt động cần điều chỉnh
          </label>
          <select
            id="route-adjust-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Chọn hoạt động cần điều chỉnh</option>
            {sorted(bundle.items)
              .filter((x) => x.status === "planned")
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {localTime(x.start_at, bundle.trip.timezone).slice(5, 16)} ·{" "}
                  {x.title}
                  {x.time_mode === "fixed" ? " · Cố định" : ""}
                </option>
              ))}
          </select>
          <button
            className="btn primary small"
            disabled={
              !bundle.items.some(
                (x) => x.id === target && x.status === "planned",
              )
            }
            onClick={() => setSpec({ type: "shift", id: target })}
          >
            Điều chỉnh
          </button>
        </div>
      )}
      {spec?.type === "issues" && (
        <Dialog open title="Kiểm tra lịch trình" onClose={() => setSpec(null)}>
          <div className="dialog-body">
            <p className="muted">
              Thời gian di chuyển do bạn khai báo, chưa bao gồm giao thông trực
              tiếp.
            </p>
            {issues.length ? (
              <ul className="route-issues">
                {issues.map((x, i) => (
                  <li key={i}>{x.message}</li>
                ))}
              </ul>
            ) : (
              <p>Không phát hiện xung đột trong dữ liệu hiện có.</p>
            )}
          </div>
          <footer className="dialog-footer">
            <button className="btn secondary" onClick={() => setSpec(null)}>
              Đóng
            </button>
          </footer>
        </Dialog>
      )}
      {spec?.type === "shift" && selected && canEdit && (
        <ShiftForm
          key={selected.id + String(spec.minutes) + String(spec.day)}
          item={selected}
          bundle={bundle}
          initial={spec}
          onClose={() => setSpec(null)}
          onSave={onSave}
        />
      )}
      {spec?.type === "leg" && selected && (
        <LegForm
          item={selected}
          bundle={bundle}
          onClose={() => setSpec(null)}
          onSave={onSave}
        />
      )}
      {spec?.type === "wishes" && (
        <WishList
          bundle={bundle}
          onSave={onSave}
          onClose={() => setSpec(null)}
          onEdit={(wish) => setSpec({ type: "wish-edit", wish })}
          onUse={(wish, replace) =>
            setSpec({ type: "wish-use", wish, replace })
          }
        />
      )}
      {spec?.type === "wish-edit" && canEdit && (
        <WishForm
          key={spec.wish?.id || "new"}
          bundle={bundle}
          wish={spec.wish}
          onSave={onSave}
          onClose={() => setSpec({ type: "wishes" })}
        />
      )}
      {spec?.type === "wish-use" && canEdit && (
        <WishUse
          bundle={bundle}
          wish={spec.wish}
          replace={spec.replace}
          onSave={onSave}
          onClose={() => setSpec({ type: "wishes" })}
        />
      )}
    </section>
  );
}
function Preview({
  plan,
  bundle,
  onBack,
  onDone,
  onSave,
}: {
  plan: Plan;
  bundle: Bundle;
  onBack: () => void;
  onDone: () => void;
  onSave: Save;
}) {
  const { busy, error, run } = useSave(),
    [ack, setAck] = useState(false);
  useDraft(true);
  const changed = plan.after.filter(
    (x) =>
      !plan.before.some(
        (y) =>
          y.id === x.id &&
          y.start_at === x.start_at &&
          y.end_at === x.end_at &&
          y.status === x.status,
      ),
  );
  return (
    <Dialog open title="Xem trước thay đổi" onClose={onBack} busy={busy}>
      <div className="dialog-body">
        <p>{plan.description}</p>
        <div className="route-preview-list">
          {changed.map((x) => {
            const old = plan.before.find((y) => y.id === x.id);
            return (
              <article key={x.id}>
                <strong>
                  {x.title}
                  {x.status === "skipped" ? " · Bỏ qua trong lịch" : ""}
                </strong>
                {old && (
                  <small>
                    Cũ: {clock(old.start_at, bundle.trip.timezone)} →{" "}
                    {clock(old.end_at, bundle.trip.timezone)}
                  </small>
                )}
                <b>
                  Mới: {clock(x.start_at, bundle.trip.timezone)} →{" "}
                  {clock(x.end_at, bundle.trip.timezone)}
                </b>
              </article>
            );
          })}
        </div>
        {plan.issues.length > 0 && (
          <details className="route-warning" open>
            <summary>
              {plan.issues.length} cảnh báo trong lịch sau thay đổi
            </summary>
            <ul>
              {plan.issues.map((x, i) => (
                <li key={i}>{x.message}</li>
              ))}
            </ul>
            <label>
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />{" "}
              Tôi đã xem các cảnh báo và vẫn muốn lưu.
            </label>
          </details>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="dialog-footer">
        <button className="btn secondary" disabled={busy} onClick={onBack}>
          Quay lại
        </button>
        <button
          className="btn primary"
          disabled={busy || (!!plan.issues.length && !ack)}
          onClick={() =>
            void run(async () => {
              await onSave(
                action(
                  "route_batch",
                  bundle,
                  routeBatchSchema.parse(plan.data),
                ),
              );
              onDone();
            })
          }
        >
          {busy ? "Đang lưu…" : "Xác nhận"}
        </button>
      </footer>
    </Dialog>
  );
}
function ShiftForm({
  item,
  bundle,
  initial,
  onClose,
  onSave,
}: {
  item: Item;
  bundle: Bundle;
  initial: { minutes?: number; day?: string };
  onClose: () => void;
  onSave: Save;
}) {
  const zone = bundle.trip.timezone,
    defaultStart = localTime(
      new Date(
        Date.parse(item.start_at) + (initial.minutes || 0) * 60000,
      ).toISOString(),
      zone,
    ).slice(0, 16);
  const [start, setStart] = useState(
      initial.day ? initial.day + defaultStart.slice(10) : defaultStart,
    ),
    [duration, setDuration] = useState(
      item.end_at
        ? String(
            Math.round(
              (Date.parse(item.end_at) - Date.parse(item.start_at)) / 60000,
            ),
          )
        : "",
    ),
    [following, setFollowing] = useState(false),
    [dirty, setDirty] = useState(false),
    [plan, setPlan] = useState<Plan | null>(null),
    [error, setError] = useState("");
  useDraft(dirty);
  const close = () => {
    if (!dirty || confirm("Bạn có thay đổi chưa lưu. Đóng form?")) onClose();
  };
  if (plan)
    return (
      <Preview
        plan={plan}
        bundle={bundle}
        onBack={() => setPlan(null)}
        onDone={onClose}
        onSave={onSave}
      />
    );
  return (
    <Dialog open title={`Điều chỉnh · ${item.title}`} onClose={close}>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            if (item.status !== "planned")
              throw new Error("Chỉ điều chỉnh hoạt động chưa bắt đầu.");
            const next = previewShift(
              bundle.items,
              item,
              utcTime(start, zone),
              duration ? Number(duration) : null,
              following,
              zone,
            );
            const data = routeBatchSchema.parse({
              days: next.days,
              trip_version: bundle.trip.version,
              context: contextFor(bundle, next.days),
              updates: next.updates,
            });
            setPlan({
              data,
              before: bundle.items,
              after: next.items,
              issues: next.issues,
              description: following
                ? "Dời các hoạt động linh hoạt phía sau đến trước mốc cố định kế tiếp; giữ nguyên mốc cố định và lịch sử đã diễn ra."
                : "Chỉ thay đổi hoạt động đã chọn. Các hoạt động khác giữ nguyên giờ.",
            });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="dialog-body form-grid">
          <p className="muted full">
            Múi giờ {zone}. Giờ cố định chỉ thay đổi khi bạn chọn điều chỉnh
            trực tiếp điểm đó.
          </p>
          <label className="field">
            Bắt đầu mới
            <input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label className="field">
            Thời lượng (phút)
            <input
              type="number"
              min={1}
              max={2880}
              value={duration}
              placeholder="Chưa xác định"
              onChange={(e) => {
                setDuration(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label className="full">
            <input
              type="checkbox"
              checked={following}
              onChange={(e) => {
                setFollowing(e.target.checked);
                setDirty(true);
              }}
            />{" "}
            Dời các điểm linh hoạt phía sau trong ngày
          </label>
          {error && (
            <p className="error full" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="dialog-footer">
          <button className="btn secondary" type="button" onClick={close}>
            Hủy
          </button>
          <button className="btn primary">Xem trước</button>
        </footer>
      </form>
    </Dialog>
  );
}
function LegForm({
  item,
  bundle,
  onClose,
  onSave,
}: {
  item: Item;
  bundle: Bundle;
  onClose: () => void;
  onSave: Save;
}) {
  const seq = sorted(bundle.items),
    prev = seq[seq.findIndex((x) => x.id === item.id) - 1],
    canEdit = bundle.role !== "viewer";
  const [mode, setMode] = useState(item.travel_mode || "other"),
    [minutes, setMinutes] = useState(
      item.leg_from_id === prev?.id && item.travel_minutes != null
        ? String(item.travel_minutes)
        : "",
    ),
    [buffer, setBuffer] = useState(String(item.buffer_minutes || 0)),
    [dirty, setDirty] = useState(false);
  useDraft(dirty);
  const { busy, error, run } = useSave();
  const close = () => {
    if (!busy && (!dirty || confirm("Bạn có thay đổi chưa lưu. Đóng form?")))
      onClose();
  };
  return (
    <Dialog open title="Chặng di chuyển" onClose={close} busy={busy}>
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!prev)
              throw new Error("Chưa có điểm xuất phát trước hoạt động này.");
            await onSave(
              action(
                "item",
                bundle,
                routeItemSchema.parse({
                  ...itemData(item),
                  travel_mode: mode,
                  travel_minutes: minutes === "" ? null : Number(minutes),
                  buffer_minutes: Number(buffer),
                  leg_from_id: prev.id,
                }),
                item,
              ),
            );
            onClose();
          });
        }}
      >
        <div className="dialog-body form-grid">
          <p className="full">
            {prev?.title || "Chưa có điểm xuất phát"} <ArrowRight size={14} />{" "}
            {item.title}
          </p>
          <div className="field">
            <label htmlFor="route-leg-mode">Phương tiện</label>
            <select
              id="route-leg-mode"
              disabled={!canEdit}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as typeof mode);
                setDirty(true);
              }}
            >
              {Object.entries(TRAVEL_MODES).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <label className="field">
            Di chuyển (phút)
            <input
              type="number"
              min={0}
              max={2880}
              value={minutes}
              disabled={!canEdit}
              placeholder="Chưa xác định"
              onChange={(e) => {
                setMinutes(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <label className="field">
            Dự phòng (phút)
            <input
              type="number"
              required
              min={0}
              max={1440}
              disabled={!canEdit}
              value={buffer}
              onChange={(e) => {
                setBuffer(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <p className="muted full">
            Thời gian do bạn ước tính. Khi đổi thứ tự điểm đi, hãy xác nhận lại
            chặng mới.
          </p>
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
            disabled={busy}
            onClick={close}
          >
            {canEdit ? "Hủy" : "Đóng"}
          </button>
          {canEdit && (
            <button className="btn primary" disabled={busy || !prev}>
              Lưu chặng
            </button>
          )}
        </footer>
      </form>
    </Dialog>
  );
}
function WishList({
  bundle,
  onSave,
  onClose,
  onEdit,
  onUse,
}: {
  bundle: Bundle;
  onSave: Save;
  onClose: () => void;
  onEdit: (wish?: TravelWish) => void;
  onUse: (wish: TravelWish, replace: boolean) => void;
}) {
  const canEdit = bundle.role !== "viewer",
    { busy, error, run } = useSave();
  return (
    <Dialog open title="Danh sách muốn đi" onClose={onClose} busy={busy}>
      <div className="dialog-body">
        <div className="section-heading">
          <p>{bundle.wishes?.length || 0} địa điểm</p>
          {canEdit && (
            <button className="btn primary small" onClick={() => onEdit()}>
              <Plus size={16} />
              Thêm địa điểm
            </button>
          )}
        </div>
        {!bundle.wishes?.length && (
          <p className="muted">
            Lưu những nơi muốn ghé hoặc phương án B trước khi xếp lịch.
          </p>
        )}
        {bundle.wishes?.map((w) => {
          const target = bundle.items.find((x) => x.id === w.backup_for_id);
          return (
            <article className="wish-card" key={w.id}>
              <strong>{w.title}</strong>
              <small>
                {w.duration_minutes} phút · {w.location || "Chưa có địa điểm"}
              </small>
              {target && <small>Phương án B cho: {target.title}</small>}
              {w.note && <p>{w.note}</p>}
              {w.map_url && (
                <a href={w.map_url} target="_blank" rel="noopener noreferrer">
                  Xem bản đồ
                </a>
              )}
              {canEdit && (
                <div className="wish-actions">
                  <button
                    className="btn secondary small"
                    disabled={busy}
                    onClick={() => onEdit(w)}
                  >
                    Sửa
                  </button>
                  <button
                    className="btn secondary small"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Xóa địa điểm muốn đi?"))
                        void run(async () =>
                          onSave(action("wish", bundle, {}, w, "delete")),
                        );
                    }}
                  >
                    Xóa
                  </button>
                  <button
                    className="btn primary small"
                    onClick={() => onUse(w, false)}
                  >
                    Đưa vào lịch
                  </button>
                  {target?.status === "planned" && (
                    <button
                      className="btn secondary small"
                      onClick={() => onUse(w, true)}
                    >
                      Dùng phương án B
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
      <footer className="dialog-footer">
        <button className="btn secondary" disabled={busy} onClick={onClose}>
          Đóng
        </button>
      </footer>
    </Dialog>
  );
}
function WishForm({
  bundle,
  wish,
  onSave,
  onClose,
}: {
  bundle: Bundle;
  wish?: TravelWish;
  onSave: Save;
  onClose: () => void;
}) {
  const [v, setV] = useState({
      title: wish?.title || "",
      location: wish?.location || "",
      duration_minutes: String(wish?.duration_minutes || 60),
      map_url: wish?.map_url || "",
      note: wish?.note || "",
      backup_for_id: wish?.backup_for_id || "",
    }),
    [dirty, setDirty] = useState(false);
  useDraft(dirty);
  const { busy, error, run } = useSave();
  const close = () => {
    if (!busy && (!dirty || confirm("Bạn có thay đổi chưa lưu. Đóng form?")))
      onClose();
  };
  const set = (k: string, value: string) => {
    setV((old) => ({ ...old, [k]: value }));
    setDirty(true);
  };
  return (
    <Dialog
      open
      title={wish ? "Sửa địa điểm muốn đi" : "Thêm địa điểm muốn đi"}
      onClose={close}
      busy={busy}
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await onSave(action("wish", bundle, wishSchema.parse(v), wish));
            onClose();
          });
        }}
      >
        <div className="dialog-body form-grid">
          {(
            [
              ["title", "Tên địa điểm", "text"],
              ["location", "Địa chỉ", "text"],
              ["duration_minutes", "Thời lượng dự kiến (phút)", "number"],
              ["map_url", "Liên kết bản đồ HTTPS", "url"],
            ] as const
          ).map(([key, label, type]) => (
            <label className="field" key={key}>
              {label}
              <input
                type={type}
                required={key === "title" || key === "duration_minutes"}
                min={type === "number" ? 5 : undefined}
                max={type === "number" ? 2880 : undefined}
                maxLength={
                  key === "map_url" ? 3000 : key === "location" ? 300 : 200
                }
                value={v[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </label>
          ))}
          <div className="field full">
            <label htmlFor="wish-plan-b">Phương án B cho hoạt động</label>
            <select
              id="wish-plan-b"
              value={v.backup_for_id}
              onChange={(e) => set("backup_for_id", e.target.value)}
            >
              <option value="">Địa điểm muốn đi chung</option>
              {bundle.items
                .filter((x) => x.status === "planned")
                .map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              {v.backup_for_id &&
                !bundle.items.some(
                  (x) => x.id === v.backup_for_id && x.status === "planned",
                ) && (
                  <option value={v.backup_for_id} disabled>
                    Điểm cũ không còn sẵn sàng — hãy chọn lại
                  </option>
                )}
            </select>
          </div>
          <label className="field full">
            Ghi chú
            <textarea
              maxLength={5000}
              value={v.note}
              onChange={(e) => set("note", e.target.value)}
            />
          </label>
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
            onClick={close}
            disabled={busy}
          >
            Hủy
          </button>
          <button className="btn primary" disabled={busy}>
            Lưu địa điểm
          </button>
        </footer>
      </form>
    </Dialog>
  );
}
function WishUse({
  bundle,
  wish,
  replace,
  onSave,
  onClose,
}: {
  bundle: Bundle;
  wish: TravelWish;
  replace: boolean;
  onSave: Save;
  onClose: () => void;
}) {
  const target = bundle.items.find((x) => x.id === wish.backup_for_id),
    zone = bundle.trip.timezone;
  const [start, setStart] = useState(
      localTime(
        replace && target
          ? target.start_at
          : bundle.trip.start_date + "T02:00:00Z",
        zone,
      ).slice(0, 16),
    ),
    [after, setAfter] = useState(""),
    [keep, setKeep] = useState(true),
    [dirty, setDirty] = useState(false),
    [plan, setPlan] = useState<Plan | null>(null),
    [error, setError] = useState("");
  useDraft(dirty);
  const close = () => {
    if (!dirty || confirm("Bạn có thay đổi chưa lưu. Đóng form?")) onClose();
  };
  if (plan)
    return (
      <Preview
        plan={plan}
        bundle={bundle}
        onBack={() => setPlan(null)}
        onDone={onClose}
        onSave={onSave}
      />
    );
  return (
    <Dialog
      open
      title={replace ? "Dùng phương án B" : "Đưa vào lịch"}
      onClose={close}
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError("");
          try {
            if (replace && (!target || target.status !== "planned"))
              throw new Error("Điểm cần thay đã thay đổi. Hãy chọn lại.");
            const candidate = {
              ...wishToItem(wish, utcTime(start, zone)),
              id: crypto.randomUUID(),
              version: 1,
              trip_id: bundle.trip.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              status: "planned" as const,
              checked_in_at: null,
              completed_at: null,
            };
            const days = [
              ...new Set([
                localTime(candidate.start_at, zone).slice(0, 10),
                ...(target && replace
                  ? [localTime(target.start_at, zone).slice(0, 10)]
                  : []),
              ]),
            ];
            const data = routeBatchSchema.parse({
              days,
              trip_version: bundle.trip.version,
              context: contextFor(bundle, days),
              updates: [],
              create_item: {
                id: candidate.id,
                data: routeItemSchema.parse(candidate),
              },
              consume_wish: { id: wish.id, version: wish.version },
              ...(replace && target
                ? {
                    replace_item: {
                      id: target.id,
                      version: target.version,
                      keep_old: keep,
                      wish_id: crypto.randomUUID(),
                    },
                  }
                : {}),
            });
            const next = [
              ...bundle.items.map((x) =>
                replace && x.id === target?.id
                  ? { ...x, status: "skipped" as const }
                  : x,
              ),
              candidate,
            ];
            setPlan({
              data,
              before: bundle.items,
              after: next,
              issues: routeIssues(next, zone),
              description: replace
                ? `Thay ${target!.title} bằng ${wish.title}. Điểm cũ chuyển sang Bỏ qua; đặt chỗ và chi phí vẫn gắn với điểm cũ.${keep ? " Lưu thêm điểm cũ vào Muốn đi." : ""}`
                : `Thêm ${wish.title} vào lịch và bỏ bản sao khỏi Muốn đi. Các điểm khác giữ nguyên giờ.`,
            });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <div className="dialog-body form-grid">
          <p className="full">
            <b>{wish.title}</b> · {wish.duration_minutes} phút
          </p>
          {!replace && (
            <div className="field full">
              <label htmlFor="wish-insert-after">Vị trí chèn</label>
              <select
                id="wish-insert-after"
                value={after}
                onChange={(e) => {
                  setAfter(e.target.value);
                  setDirty(true);
                  const x = bundle.items.find((x) => x.id === e.target.value);
                  if (x?.end_at)
                    setStart(localTime(x.end_at, zone).slice(0, 16));
                }}
              >
                <option value="">Tự chọn ngày giờ</option>
                {sorted(bundle.items)
                  .filter((x) => x.status === "planned")
                  .map((x) => (
                    <option key={x.id} value={x.id} disabled={!x.end_at}>
                      Sau {x.title}
                      {!x.end_at ? " (chưa có giờ kết thúc)" : ""}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <label className="field full">
            Bắt đầu
            <input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          <p className="muted full">
            Múi giờ {zone}. Dành thêm thời gian di chuyển trước khi xác nhận.
          </p>
          {replace && (
            <label className="full">
              <input
                type="checkbox"
                checked={keep}
                onChange={(e) => {
                  setKeep(e.target.checked);
                  setDirty(true);
                }}
              />{" "}
              Giữ điểm cũ trong danh sách muốn đi
            </label>
          )}
          {error && (
            <p className="error full" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="dialog-footer">
          <button type="button" className="btn secondary" onClick={close}>
            Hủy
          </button>
          <button className="btn primary">Xem trước</button>
        </footer>
      </form>
    </Dialog>
  );
}
