"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import {
  Compass,
  LayoutDashboard,
  Route,
  Wallet,
  Images,
  Ellipsis,
  Plus,
  ChevronDown,
  ArrowUpRight,
  ArrowRight,
  MapPin,
  Clock,
  Users,
  Check,
  CheckCircle2,
  Trash2,
  Pencil,
  Download,
  RefreshCw,
  LogOut,
  Link2,
  Copy,
  CalendarDays,
  LockKeyhole,
  WifiOff,
  Flag,
  Receipt,
  FileText,
  ChevronRight,
  ShieldCheck,
  CloudUpload,
  AlertTriangle,
} from "lucide-react";
import { browserClient, configured } from "@/lib/supabase/client";
import { Auth } from "./auth";
import { Editor, type EditSpec } from "./editor";
import { Dialog } from "./ui/dialog";
import {
  VERSION,
  TRIP_STATUS,
  ITEM_STATUS,
  type Bundle,
  type Trip,
  type Mutation,
  type Entity,
  type Item,
  type TripListResponse,
  type QueuedMutation,
  CATEGORIES,
} from "@/lib/types";
import {
  compare,
  money,
  dateLabel,
  localTime,
  live,
  csv,
  planned,
  net,
} from "@/lib/domain";
import { MasterAdmin } from "./admin";
import { ProductRoadmap } from "./roadmap";
import {
  cacheBundle,
  cacheTrips,
  canQueueMutation,
  clearUserOfflineData,
  enqueueMutation,
  listQueue,
  readCachedBundle,
  readCachedTrips,
  removeQueue,
  retryQueue,
  updateQueue,
} from "@/lib/offline";
const tabs = [
  { id: "home", label: "Tổng quan", Icon: LayoutDashboard },
  { id: "route", label: "Lịch trình", Icon: Route },
  { id: "money", label: "Chi phí", Icon: Wallet },
  { id: "media", label: "Media", Icon: Images },
  { id: "more", label: "Thêm", Icon: Ellipsis },
];
class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 0, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store", ...init });
  } catch {
    throw new ApiError("Không kết nối được máy chủ.", 0, "NETWORK_ERROR");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiError(
      data.error || "Có lỗi xảy ra. Vui lòng thử lại.",
      res.status,
      data.code,
    );
  return data as T;
}
function download(name: string, content: string, type: string) {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function Link({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <a className="link" href={url} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={16} />
    </a>
  );
}
function Empty({
  title,
  text,
  onAdd,
  label = "Thêm mới",
}: {
  title: string;
  text: string;
  onAdd?: () => void;
  label?: string;
}) {
  return (
    <div className="empty">
      <Compass size={40} />
      <h3>{title}</h3>
      <p>{text}</p>
      {onAdd && (
        <button className="btn primary" onClick={onAdd}>
          <Plus size={17} />
          {label}
        </button>
      )}
    </div>
  );
}
function Bar({
  value,
  max,
  over = false,
}: {
  value: number;
  max: number;
  over?: boolean;
}) {
  return (
    <div className={`bar ${over ? "over" : ""}`}>
      <span
        style={{
          width: `${Math.max(0, Math.min(100, max ? (value / max) * 100 : 0))}%`,
        }}
      />
    </div>
  );
}
export function TripFlow() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  );
}
function App() {
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null>(null),
    [authLoading, setAuthLoading] = useState(true),
    [recover, setRecover] = useState(false),
    [blockedMessage, setBlockedMessage] = useState("");
  const [selected, setSelected] = useState(""),
    [tab, setTab] = useState("home"),
    [financeTab, setFinanceTab] = useState("summary"),
    [day, setDay] = useState("all"),
    [category, setCategory] = useState("all");
  const [spec, setSpec] = useState<EditSpec | null>(null),
    [tripPicker, setTripPicker] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [online, setOnline] = useState(true),
    [now, setNow] = useState("");
  const [confirm, setConfirm] = useState<{
      title: string;
      text: string;
      action: () => Promise<void>;
    } | null>(null),
    [inviteToken, setInviteToken] = useState(""),
    [shareLink, setShareLink] = useState("");
  const [queueRows, setQueueRows] = useState<QueuedMutation[]>([]),
    [syncing, setSyncing] = useState(false);
  const syncLock = useRef(false);
  const notify = useCallback((s: string) => setToast(s), []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const loadAuth = useCallback(async () => {
    if (!configured()) {
      setAuthLoading(false);
      return;
    }
    const s = browserClient();
    const { data } = await s.auth.getUser();
    setUser(data.user);
    setAuthLoading(false);
  }, []);
  useEffect(() => {
    void loadAuth();
    setNow(new Date().toISOString());
    setRecover(new URLSearchParams(location.search).has("recovery"));
    setInviteToken(new URLSearchParams(location.search).get("invite") || "");
    const tick = setInterval(() => setNow(new Date().toISOString()), 30000);
    const changed = () => setOnline(navigator.onLine);
    changed();
    window.addEventListener("online", changed);
    window.addEventListener("offline", changed);
    let sub: { unsubscribe: () => void } | undefined;
    if (configured()) {
      sub = browserClient().auth.onAuthStateChange((event, session) => {
        setUser(session?.user || null);
        if (event === "PASSWORD_RECOVERY") setRecover(true);
      }).data.subscription;
    }
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", changed);
      window.removeEventListener("offline", changed);
      sub?.unsubscribe();
    };
  }, [loadAuth]);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  const tripsQ = useQuery<TripListResponse>({
    queryKey: ["trips", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("Vui lòng đăng nhập.");
      try {
        const value = await api<TripListResponse>("/api/tripflow");
        await cacheTrips(user.id, value);
        return value;
      } catch (e) {
        if (e instanceof ApiError && e.status !== 0) throw e;
        const cached = await readCachedTrips(user.id);
        if (cached) return cached;
        throw e;
      }
    },
    enabled: !!user,
    refetchInterval: online ? 30000 : false,
  });
  const trips = tripsQ.data?.trips || [];
  const account = tripsQ.data?.account;
  useEffect(() => {
    const e = tripsQ.error;
    if (!user || !(e instanceof ApiError) || e.code !== "ACCOUNT_DEACTIVATED") return;
    setBlockedMessage(e.message);
    setQueueRows([]);
    qc.clear();
    void browserClient().auth.signOut().finally(() => setUser(null));
  }, [tripsQ.error, user, qc]);
  const selectedId = trips.some((t) => t.id === selected)
    ? selected
    : trips[0]?.id || "";
  const bq = useQuery<Bundle>({
    queryKey: ["trip", user?.id, selectedId],
    queryFn: async () => {
      if (!user || !selectedId) throw new Error("Chưa chọn chuyến đi.");
      try {
        const value = await api<Bundle>("/api/tripflow?trip=" + selectedId);
        await cacheBundle(user.id, selectedId, value);
        return value;
      } catch (e) {
        if (e instanceof ApiError && e.status !== 0) throw e;
        const cached = await readCachedBundle(user.id, selectedId);
        if (cached) return cached;
        throw e;
      }
    },
    enabled: !!user && !!selectedId,
    refetchInterval: online ? 30000 : false,
  });
  const data = bq.data,
    trip = data?.trip;
  useEffect(() => {
    if (!user || !selectedId || !configured()) return;
    const s = browserClient();
    const channel = s
      .channel("trip:" + selectedId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", filter: `trip_id=eq.${selectedId}` },
        () => {
          void qc.invalidateQueries({
            queryKey: ["trip", user.id, selectedId],
          });
        },
      )
      .subscribe();
    return () => {
      void s.removeChannel(channel);
    };
  }, [user, selectedId, qc]);
  const refreshQueue = useCallback(async () => {
    if (!user) {
      setQueueRows([]);
      return;
    }
    setQueueRows(await listQueue(user.id));
  }, [user]);
  const syncPending = useCallback(
    async (showMessage = false) => {
      if (!user || !navigator.onLine || syncLock.current) return;
      syncLock.current = true;
      setSyncing(true);
      let sent = 0;
      try {
        const rows = await listQueue(user.id);
        for (const row of rows) {
          if (!['pending', 'sending'].includes(row.state)) continue;
          await updateQueue(row.operationId, {
            state: 'sending',
            attempts: row.attempts + 1,
            error: undefined,
          });
          try {
            await api<{ result: Record<string, unknown> }>("/api/tripflow", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(row.mutation),
            });
            await removeQueue(row.operationId);
            sent += 1;
          } catch (e) {
            const err = e instanceof ApiError ? e : new ApiError((e as Error).message);
            if (err.status === 0 || err.status >= 500) {
              await updateQueue(row.operationId, { state: 'pending', error: err.message });
              break;
            }
            await updateQueue(row.operationId, {
              state: err.status === 409 ? 'conflict' : 'rejected',
              error: err.message,
            });
            if (err.code === 'ACCOUNT_DEACTIVATED') break;
          }
        }
        if (sent) {
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["trips"] }),
            qc.invalidateQueries({ queryKey: ["trip"] }),
          ]);
          if (showMessage) notify(`Đã đồng bộ ${sent} thao tác.`);
        } else if (showMessage) {
          notify("Không có thao tác mới cần đồng bộ.");
        }
      } finally {
        await refreshQueue();
        setSyncing(false);
        syncLock.current = false;
      }
    },
    [user, qc, notify, refreshQueue],
  );
  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);
  useEffect(() => {
    if (online && user) void syncPending(false);
  }, [online, user, syncPending]);

  async function queueOffline(m: Mutation) {
    if (!user) throw new Error("Vui lòng đăng nhập lại.");
    if (!canQueueMutation(m))
      throw new Error(
        "Thao tác này cần kết nối mạng. Offline V0.2.0 chỉ cho phép ghi chi tiêu mới, cập nhật/check-in lịch trình, người tham gia và media.",
      );
    await enqueueMutation(user.id, m);
    await refreshQueue();
    notify("Đã lưu trên thiết bị · chờ đồng bộ khi có mạng.");
  }

  async function save(m: Mutation) {
    if (!navigator.onLine) {
      await queueOffline(m);
      return;
    }
    let result: { result: Record<string, unknown> };
    try {
      result = await api<{ result: Record<string, unknown> }>(
        "/api/tripflow",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(m),
        },
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 0 && canQueueMutation(m)) {
        await queueOffline(m);
        return;
      }
      throw e;
    }
    if (m.entity === "trip" && m.action === "create") {
      setSelected(m.tripId);
      setTab("home");
    }
    if (m.entity === "invitation" && m.action === "create")
      setShareLink(location.origin + "/?invite=" + String(result.result.token));
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["trips"] }),
      qc.invalidateQueries({ queryKey: ["trip"] }),
    ]);
    notify("Đã lưu trên hệ thống.");
  }
  const edit = (entity: Entity, record?: object) =>
    setSpec({ entity, record: record as Record<string, unknown> | undefined });
  const writable = data?.role === "owner" || data?.role === "editor",
    owner = data?.role === "owner";
  function remove(entity: Entity, row: { id: string; version: number }) {
    const message =
      entity === "trip"
        ? "Ẩn chuyến đi và toàn bộ nội dung khỏi danh sách. Dữ liệu được giữ dưới dạng đã xóa trong database."
        : entity === "budget"
          ? "Xóa dự toán này. Thực chi liên quan vẫn được giữ và trở thành khoản chưa liên kết."
          : entity === "item"
            ? "Xóa hoạt động này. Dự toán và media vẫn được giữ lại."
            : entity === "member"
              ? "Thu hồi quyền truy cập chuyến đi của thành viên này?"
              : "Xóa mục này khỏi danh sách?";
    const request: Mutation = {
      operationId: crypto.randomUUID(),
      tripId: selectedId,
      entity,
      action: "delete",
      id: row.id,
      version: row.version,
    };
    setConfirm({
      title: entity === "member" ? "Thu hồi quyền" : "Xác nhận xóa",
      text: message,
      action: async () => save(request),
    });
  }
  async function status(item: Item, next: string) {
    if (!data) return;
    const active = data.items.find((x) => x.status === "active");
    const request: Mutation = {
      operationId: crypto.randomUUID(),
      tripId: selectedId,
      entity: "item",
      action: "status",
      id: item.id,
      version: item.version,
      data: { status: next, previous_id: active?.id || "" },
    };
    setConfirm({
      title:
        next === "active"
          ? "Xác nhận đã đến"
          : next === "done"
            ? "Hoàn thành hoạt động"
            : "Cập nhật trạng thái",
      text:
        next === "active" && active && active.id !== item.id
          ? `“${active.title}” sẽ hoàn thành và bạn chuyển sang “${item.title}”.`
          : `Cập nhật “${item.title}” thành ${ITEM_STATUS[next as keyof typeof ITEM_STATUS].toLowerCase()}?`,
      action: async () => save(request),
    });
  }
  function rowTools(
    entity: Entity,
    row: object & { id: string; version: number },
  ) {
    return (
      writable && (
        <div className="row-tools">
          <button
            className="icon-btn"
            title="Chỉnh sửa"
            aria-label="Chỉnh sửa"
            onClick={() => edit(entity, row)}
          >
            <Pencil size={17} />
          </button>
          <button
            className="icon-btn danger"
            title="Xóa"
            aria-label="Xóa"
            onClick={() => remove(entity, row)}
          >
            <Trash2 size={17} />
          </button>
        </div>
      )
    );
  }
  function navigate(id: string) {
    setTab(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function logout() {
    const pending = queueRows.length;
    const message = pending
      ? `Đang có ${pending} thao tác offline chưa đồng bộ. Nếu đăng xuất, TripFlow sẽ giữ chúng trên thiết bị và chỉ gửi lại khi đúng tài khoản này đăng nhập. Tiếp tục?`
      : "Đăng xuất khỏi TripFlow? Dữ liệu cache offline trên thiết bị này sẽ được xóa.";
    if (!window.confirm(message)) return;
    if (!pending && user) await clearUserOfflineData(user.id);
    await browserClient().auth.signOut();
    qc.clear();
    setQueueRows([]);
    setSelected("");
    setUser(null);
  }
  if (authLoading)
    return (
      <div className="loading-screen">
        <Compass size={42} />
        <p>Đang mở TripFlow…</p>
      </div>
    );
  if (!configured() || !user || recover)
    return (
      <Auth
        recovery={recover}
        initialError={blockedMessage}
        onDone={() => {
          setBlockedMessage("");
          setRecover(false);
          void loadAuth();
          qc.clear();
        }}
      />
    );
  const totals = data ? compare(data.budgets, data.expenses) : null;
  const progress = data
    ? live(data.items, now || new Date().toISOString())
    : null;
  const current = progress?.active || progress?.scheduled[0];
  const latestSnapshot = data?.snapshots.toSorted((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )[0];
  const queuePending = queueRows.filter((x) => x.state === "pending" || x.state === "sending").length;
  const queueIssues = queueRows.filter((x) => x.state === "conflict" || x.state === "rejected").length;
  const tableNames: Record<string, string> = {
    trips: "Chuyến đi",
    itinerary_items: "Lịch trình",
    budget_items: "Dự toán",
    expenses: "Thực chi",
    media_links: "Media",
    trip_participants: "Người tham gia",
    trip_members: "Thành viên",
    budget_snapshots: "Chốt dự toán",
  };
  const liveCard = () =>
    trip &&
    progress && (
      <section className="live-panel">
        <div className="live-top">
          <span className="pill light">
            <MapPin size={14} />
            {trip.status === "completed"
              ? "CHUYẾN ĐI ĐÃ KẾT THÚC"
              : progress.active
                ? "CHECK-IN THỰC TẾ"
                : current
                  ? "HIỆN TẠI THEO KẾ HOẠCH"
                  : "CHẶNG TIẾP THEO"}
          </span>
          <span>{now ? localTime(now, trip.timezone).slice(11) : "--:--"}</span>
        </div>
        <h2>
          {trip.status === "completed"
            ? "Những ngày đáng nhớ đã qua"
            : current?.title ||
              progress.next?.title ||
              (progress.late.length
                ? "Cập nhật các điểm đã qua giờ"
                : progress.sorted.length
                  ? "Bạn đã đến cuối lịch trình"
                  : "Sẵn sàng cho hành trình mới")}
        </h2>
        <p>
          {current
            ? `${current.location || trip.destination} · ${localTime(current.start_at, trip.timezone).slice(11)} – ${localTime(current.end_at, trip.timezone).slice(11)}`
            : progress.next
              ? `${dateLabel(localTime(progress.next.start_at, trip.timezone))} · ${localTime(progress.next.start_at, trip.timezone).slice(11)}`
              : "Thêm hoạt động và thời gian để bắt đầu."}
        </p>
        <div className="live-bottom">
          <small>
            {progress.active
              ? "Bạn đã xác nhận điểm này."
              : current
                ? "Chưa xác nhận có mặt. Đây không phải vị trí GPS."
                : "Giờ theo múi giờ của chuyến đi."}
          </small>
          {current && writable && trip.status !== "completed" ? (
            <button
              className="btn lime"
              onClick={() =>
                status(current, progress.active ? "done" : "active")
              }
            >
              {progress.active ? <Check size={17} /> : <MapPin size={17} />}{" "}
              {progress.active ? "Hoàn thành" : "Tôi đã đến"}
            </button>
          ) : (
            <button className="btn lime" onClick={() => navigate("route")}>
              Xem lộ trình
              <ArrowRight size={17} />
            </button>
          )}
        </div>
        {progress.scheduled.length > 1 && (
          <small className="live-note">
            Có {progress.scheduled.length} hoạt động trùng giờ dự kiến.
          </small>
        )}
      </section>
    );
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <a className="brand" href="/">
          <Compass />
          <b>TripFlow</b>
        </a>
        <span className="side-caption">KHÔNG GIAN CHUYẾN ĐI</span>
        <nav>
          {tabs.map(({ id, label, Icon }) => (
            <button
              className={tab === id ? "active" : ""}
              onClick={() => navigate(id)}
              key={id}
            >
              <Icon size={21} />
              {label}
            </button>
          ))}
          {account?.role === "master" && (
            <button
              className={tab === "admin" ? "active" : ""}
              onClick={() => navigate("admin")}
            >
              <ShieldCheck size={21} />
              Quản trị Master
            </button>
          )}
        </nav>
        <div className="side-footer">
          <span className="version">V{VERSION} · OFFLINE + ADMIN</span>
          <p>
            Đi cùng nhau.
            <br />
            Nhớ thật lâu.
          </p>
          <button className="account" onClick={() => navigate("more")}>
            <span>{user.email?.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>Tài khoản của bạn</strong>
              <small>{user.email}</small>
            </div>
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="mobile-brand">
            <Compass />
            <b>TripFlow</b>
          </div>
          <span className="breadcrumb">
            Chuyến đi <ChevronRight size={14} /> {trip?.name || "Của bạn"}
          </span>
          <div className="top-actions">
            {queueRows.length > 0 && (
              <button
                className={`sync-badge ${queueIssues ? "issue" : ""}`}
                onClick={() => void syncPending(true)}
                disabled={!online || syncing}
                title="Đồng bộ dữ liệu offline"
              >
                {queueIssues ? <AlertTriangle size={16} /> : <CloudUpload size={16} />}
                <span>{queuePending || queueIssues}</span>
              </button>
            )}
            <button
              className="icon-btn"
              aria-label="Tải lại dữ liệu"
              onClick={() => {
                void qc.invalidateQueries();
                if (online) void syncPending(false);
                notify("Đang cập nhật dữ liệu…");
              }}
            >
              <RefreshCw size={19} />
            </button>
            <button className="trip-select" onClick={() => setTripPicker(true)}>
              <Compass size={18} />
              <span>{trip?.name || "Các chuyến đi"}</span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <main className="main">
          {!online && (
            <div className="notice warning">
              <WifiOff size={19} />
              Đang mất mạng. TripFlow đang dùng dữ liệu đã cache. Các thao tác
              được hỗ trợ offline sẽ lưu vào hàng đợi và tự đồng bộ khi có mạng.
            </div>
          )}
          {(tripsQ.error || bq.error || error) && (
            <div className="error" role="alert">
              {error || (tripsQ.error || bq.error)?.message}
              <button
                onClick={() => {
                  setError("");
                  void qc.invalidateQueries();
                }}
              >
                Thử lại
              </button>
            </div>
          )}
          {inviteToken && (
            <section className="notice invitation-notice">
              <div>
                <b>Bạn có lời mời tham gia chuyến đi</b>
                <p>Đăng nhập đúng email được mời rồi bấm tham gia.</p>
              </div>
              <button
                className="btn primary"
                disabled={working}
                onClick={async () => {
                  setWorking(true);
                  setError("");
                  try {
                    const m: Mutation = {
                      entity: "invitation",
                      action: "accept",
                      operationId: crypto.randomUUID(),
                      tripId: crypto.randomUUID(),
                      data: { token: inviteToken },
                    };
                    const res = await api<{ result: { trip_id: string } }>(
                      "/api/tripflow",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(m),
                      },
                    );
                    setSelected(res.result.trip_id);
                    setInviteToken("");
                    history.replaceState({}, "", "/");
                    await qc.invalidateQueries();
                    notify("Đã tham gia chuyến đi.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                Tham gia
              </button>
              <button
                className="text-btn"
                onClick={() => {
                  setInviteToken("");
                  history.replaceState({}, "", "/");
                }}
              >
                Bỏ qua
              </button>
            </section>
          )}
          {tab === "admin" && account?.role === "master" ? (
            <MasterAdmin currentUserId={user.id} notify={notify} />
          ) : tripsQ.isPending || (selectedId && bq.isPending) ? (
            <div className="skeleton">
              <div />
              <div />
              <div />
            </div>
          ) : !trip ? (
            tab === "more" ? (
              <>
                <ProductRoadmap />
                <section className="panel">
                  <h2>Tài khoản & dữ liệu offline</h2>
                  <p className="muted">
                    {user.email} · TripFlow {VERSION}{account?.role === "master" ? " · MASTER" : ""}
                  </p>
                  <div className="actions">
                    {account?.role === "master" && (
                      <button className="btn secondary" onClick={() => navigate("admin")}>
                        <ShieldCheck size={17} /> Quản trị Master
                      </button>
                    )}
                    <button className="btn secondary" onClick={logout}>
                      <LogOut size={17} /> Đăng xuất
                    </button>
                  </div>
                </section>
              </>
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <span className="eyebrow">CHUYẾN ĐI CỦA BẠN</span>
                    <h1>Đi đâu tiếp theo?</h1>
                  </div>
                  <button className="btn primary" onClick={() => edit("trip")}>
                    <Plus size={18} />
                    Tạo chuyến đi
                  </button>
                </div>
                <section className="panel welcome">
                  <Compass size={58} />
                  <h2>
                    Một kế hoạch nhỏ.
                    <br />
                    Một hành trình đáng nhớ.
                  </h2>
                  <p>
                    Tạo chuyến đi đầu tiên, thêm những nơi muốn đến
                    <br className="desktop-only" /> và chủ động ngân sách của bạn.
                  </p>
                  <button className="btn primary" onClick={() => edit("trip")}>
                    <Plus size={18} />
                    Tạo chuyến đi đầu tiên
                  </button>
                </section>
                <button className="text-btn" onClick={logout}>
                  <LogOut size={16} />
                  Đăng xuất {user.email}
                </button>
              </>
            )
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <span className="eyebrow">
                    {tab === "home"
                      ? "CHUYẾN ĐI CỦA BẠN"
                      : tab === "route"
                        ? "TỪNG CHẶNG CỦA HÀNH TRÌNH"
                        : tab === "money"
                          ? "CHỦ ĐỘNG NGÂN SÁCH"
                          : tab === "media"
                            ? "GIỮ LẠI KỶ NIỆM"
                            : "KHÔNG GIAN CỦA BẠN"}
                  </span>
                  <h1>
                    {tab === "home"
                      ? trip.name
                      : tab === "route"
                        ? "Lịch trình"
                        : tab === "money"
                          ? "Chi phí chuyến đi"
                          : tab === "media"
                            ? "Album & media"
                            : "Thành viên & cài đặt"}
                  </h1>
                </div>
                {writable && tab !== "more" && (
                  <button
                    className="btn primary"
                    onClick={() =>
                      edit(
                        tab === "route"
                          ? "item"
                          : tab === "media"
                            ? "media"
                            : "expense",
                      )
                    }
                  >
                    <Plus size={18} />
                    {tab === "route"
                      ? "Thêm hoạt động"
                      : tab === "media"
                        ? "Gắn liên kết"
                        : "Ghi chi tiêu"}
                  </button>
                )}
              </div>
              {tab === "home" && data && totals && progress && (
                <>
                  <div className="trip-meta">
                    <span>
                      <MapPin size={15} />
                      {trip.destination}
                    </span>
                    <span>
                      <CalendarDays size={15} />
                      {dateLabel(trip.start_date)} – {dateLabel(trip.end_date)}
                    </span>
                    <span>
                      <Users size={15} />
                      {trip.people} người
                    </span>
                    <span className="pill">{TRIP_STATUS[trip.status]}</span>
                  </div>
                  {liveCard()}
                  <div className="stats">
                    <div className="stat">
                      <span>Dự toán hiện hành</span>
                      <strong>{money(totals.plan)}</strong>
                      <small>{data.budgets.length} khoản dự toán</small>
                    </div>
                    <div className="stat">
                      <span>Đã chi thực tế</span>
                      <strong>{money(totals.actual)}</strong>
                      <small>
                        {totals.plan
                          ? Math.round((totals.actual / totals.plan) * 100) +
                            "% ngân sách"
                          : "Chưa lập dự toán"}
                      </small>
                      <Bar
                        value={totals.actual}
                        max={totals.plan}
                        over={totals.actual > totals.plan}
                      />
                    </div>
                    <div
                      className={`stat ${totals.remaining < 0 ? "negative" : ""}`}
                    >
                      <span>
                        {totals.remaining < 0
                          ? "Vượt dự toán"
                          : "Ngân sách còn lại"}
                      </span>
                      <strong>{money(Math.abs(totals.remaining))}</strong>
                      <small>
                        Bình quân {money(totals.actual / trip.people)}/người
                      </small>
                    </div>
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Hành trình của bạn</h2>
                        <button
                          className="text-btn"
                          onClick={() => navigate("route")}
                        >
                          Xem tất cả
                          <ArrowRight size={16} />
                        </button>
                      </div>
                      <div className="progress-label">
                        <span>
                          {progress.done}/{data.items.length} điểm hoàn thành
                        </span>
                        <b>
                          {data.items.length
                            ? Math.round(
                                (progress.done / data.items.length) * 100,
                              )
                            : 0}
                          %
                        </b>
                      </div>
                      <Bar value={progress.done} max={data.items.length} />
                      {progress.late.length > 0 && (
                        <p className="inline-notice">
                          {progress.late.length} hoạt động qua giờ chưa cập
                          nhật.
                        </p>
                      )}
                      <div className="mini-timeline">
                        {progress.sorted.slice(0, 4).map((x, i) => (
                          <button
                            key={x.id}
                            onClick={() => {
                              navigate("route");
                              setDay(
                                localTime(x.start_at, trip.timezone).slice(
                                  0,
                                  10,
                                ),
                              );
                            }}
                          >
                            <span className={`step ${x.status}`}>
                              {x.status === "done" ? (
                                <Check size={16} />
                              ) : (
                                String(i + 1).padStart(2, "0")
                              )}
                            </span>
                            <span>
                              <b>{x.title}</b>
                              <small>
                                {dateLabel(
                                  localTime(x.start_at, trip.timezone),
                                )}{" "}
                                ·{" "}
                                {localTime(x.start_at, trip.timezone).slice(11)}{" "}
                                · {ITEM_STATUS[x.status]}
                              </small>
                            </span>
                            <ChevronRight size={16} />
                          </button>
                        ))}
                      </div>
                      {!data.items.length && (
                        <Empty
                          title="Lịch trình còn trống"
                          text="Thêm những hoạt động đầu tiên."
                          onAdd={writable ? () => edit("item") : undefined}
                        />
                      )}
                    </section>
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Chi phí theo nhóm</h2>
                        <button
                          className="text-btn"
                          onClick={() => navigate("money")}
                        >
                          Chi tiết
                        </button>
                      </div>
                      {totals.categories
                        .filter((x) => x.plan || x.actual)
                        .map((x) => (
                          <div className="category-row" key={x.category}>
                            <div>
                              <b>{x.category}</b>
                              <span>{money(x.actual)}</span>
                            </div>
                            <Bar
                              value={x.actual}
                              max={x.plan}
                              over={x.actual > x.plan}
                            />
                            <small>Dự toán {money(x.plan)}</small>
                          </div>
                        ))}
                      {!totals.plan && !totals.actual && (
                        <Empty
                          title="Ngân sách của chuyến đi"
                          text="Lập dự toán để theo dõi từng khoản chi."
                          onAdd={writable ? () => edit("budget") : undefined}
                        />
                      )}
                      <div className="legend">
                        <i />
                        Thực chi
                        <i className="over" />
                        Vượt dự toán
                      </div>
                    </section>
                  </div>
                  {trip.note && (
                    <section className="panel">
                      <span className="eyebrow">GHI CHÚ CHUYẾN ĐI</span>
                      <p className="prewrap">{trip.note}</p>
                    </section>
                  )}
                </>
              )}
              {tab === "route" && data && progress && (
                <>
                  {liveCard()}
                  <div className="section-heading roadmap-heading">
                    <div>
                      <h2>Roadmap chuyến đi</h2>
                      <p className="muted">
                        {progress.done}/{data.items.length} hoàn thành ·{" "}
                        {progress.processed} đã xử lý · {trip.timezone}
                      </p>
                    </div>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        if (!navigator.geolocation) {
                          notify("Thiết bị không hỗ trợ định vị.");
                          return;
                        }
                        notify("Đang lấy vị trí…");
                        navigator.geolocation.getCurrentPosition(
                          (pos) => {
                            setShareLink(
                              `https://www.google.com/maps/search/?api=1&query=${pos.coords.latitude},${pos.coords.longitude}`,
                            );
                          },
                          () =>
                            notify(
                              "Không lấy được GPS. Hãy kiểm tra quyền vị trí.",
                            ),
                          { timeout: 15000, enableHighAccuracy: true },
                        );
                      }}
                    >
                      <MapPin size={16} />
                      GPS của tôi
                    </button>
                  </div>
                  <div className="day-tabs">
                    <button
                      className={day === "all" ? "active" : ""}
                      onClick={() => setDay("all")}
                    >
                      Tất cả
                    </button>
                    {[
                      ...new Set(
                        progress.sorted.map((x) =>
                          localTime(x.start_at, trip.timezone).slice(0, 10),
                        ),
                      ),
                    ].map((d) => (
                      <button
                        key={d}
                        className={day === d ? "active" : ""}
                        onClick={() => setDay(d)}
                      >
                        {dateLabel(d)}
                      </button>
                    ))}
                  </div>
                  <div className="timeline">
                    {progress.sorted
                      .filter(
                        (x) =>
                          day === "all" ||
                          localTime(x.start_at, trip.timezone).slice(0, 10) ===
                            day,
                      )
                      .map((x) => (
                        <article
                          className={`timeline-row ${x.status}`}
                          key={x.id}
                        >
                          <div className="timeline-time">
                            <b>
                              {localTime(x.start_at, trip.timezone).slice(11)}
                            </b>
                            <small>
                              {dateLabel(localTime(x.start_at, trip.timezone))}
                            </small>
                          </div>
                          <div className="timeline-dot">
                            {x.status === "done" ? (
                              <Check size={15} />
                            ) : (
                              <MapPin size={14} />
                            )}
                          </div>
                          <section className="stop-panel">
                            <div className="section-heading">
                              <span
                                className={`pill ${x.status === "active" ? "green" : ""}`}
                              >
                                {ITEM_STATUS[x.status]}
                                {progress.late.some((s) => s.id === x.id)
                                  ? " · Qua giờ"
                                  : ""}
                              </span>
                              {rowTools("item", x)}
                            </div>
                            <h3>{x.title}</h3>
                            <p className="location">
                              <MapPin size={15} />
                              {x.location || "Chưa có địa điểm"}
                            </p>
                            <p className="muted">
                              {localTime(x.start_at, trip.timezone).slice(11)} –{" "}
                              {localTime(x.end_at, trip.timezone).slice(11)}
                              {localTime(x.start_at, trip.timezone).slice(
                                0,
                                10,
                              ) !==
                              localTime(x.end_at, trip.timezone).slice(0, 10)
                                ? " · " +
                                  dateLabel(localTime(x.end_at, trip.timezone))
                                : ""}
                            </p>
                            {x.note && <p className="prewrap">{x.note}</p>}
                            {x.checked_in_at && (
                              <small>
                                Check-in{" "}
                                {dateLabel(
                                  localTime(x.checked_in_at, trip.timezone),
                                )}{" "}
                                lúc{" "}
                                {localTime(
                                  x.checked_in_at,
                                  trip.timezone,
                                ).slice(11)}
                              </small>
                            )}
                            <div className="stop-summary">
                              Dự toán{" "}
                              {money(
                                planned(
                                  data.budgets.filter(
                                    (b) => b.item_id === x.id,
                                  ),
                                ),
                              )}{" "}
                              ·{" "}
                              {
                                data.media.filter((m) => m.item_id === x.id)
                                  .length
                              }{" "}
                              media
                            </div>
                            <div className="actions">
                              {writable && (
                                <>
                                  {x.status === "planned" && (
                                    <>
                                      <button
                                        className="btn primary"
                                        onClick={() => status(x, "active")}
                                      >
                                        <MapPin size={16} />
                                        Tôi đã đến
                                      </button>
                                      <button
                                        className="text-btn"
                                        onClick={() => status(x, "skipped")}
                                      >
                                        Bỏ qua
                                      </button>
                                    </>
                                  )}
                                  {x.status === "active" && (
                                    <button
                                      className="btn primary"
                                      onClick={() => status(x, "done")}
                                    >
                                      <Check size={16} />
                                      Hoàn thành
                                    </button>
                                  )}
                                  {["done", "skipped"].includes(x.status) && (
                                    <button
                                      className="text-btn"
                                      onClick={() => status(x, "planned")}
                                    >
                                      Đặt lại
                                    </button>
                                  )}
                                  <button
                                    className="icon-btn"
                                    title="Sao chép hoạt động"
                                    aria-label="Sao chép hoạt động"
                                    onClick={() =>
                                      setSpec({
                                        entity: "item",
                                        defaults: {
                                          title: x.title + " (bản sao)",
                                          location: x.location,
                                          start_at: x.start_at,
                                          end_at: x.end_at,
                                          map_url: x.map_url,
                                          note: x.note,
                                        },
                                      })
                                    }
                                  >
                                    <Copy size={16} />
                                  </button>
                                </>
                              )}
                              <Link
                                url={
                                  x.map_url ||
                                  "https://www.google.com/maps/search/?api=1&query=" +
                                    encodeURIComponent(
                                      x.location || trip.destination,
                                    )
                                }
                              >
                                Bản đồ
                              </Link>
                            </div>
                          </section>
                        </article>
                      ))}
                  </div>
                  {!data.items.length && (
                    <section className="panel">
                      <Empty
                        title="Lên kế hoạch cho từng chặng"
                        text="Ghi địa điểm, thời gian và những điều cần chuẩn bị."
                        onAdd={writable ? () => edit("item") : undefined}
                        label="Thêm hoạt động"
                      />
                    </section>
                  )}
                </>
              )}
              {tab === "money" && data && totals && (
                <>
                  <section className="money-banner">
                    <div>
                      <span>Dự toán</span>
                      <strong>{money(totals.plan)}</strong>
                    </div>
                    <div>
                      <span>Thực chi ròng</span>
                      <strong>{money(totals.actual)}</strong>
                    </div>
                    <div>
                      <span>
                        {totals.remaining < 0 ? "Vượt dự toán" : "Còn lại"}
                      </span>
                      <strong
                        className={totals.remaining < 0 ? "over-text" : ""}
                      >
                        {money(Math.abs(totals.remaining))}
                      </strong>
                    </div>
                  </section>
                  <div className="finance-toolbar">
                    <div className="segments">
                      {[
                        ["summary", "So sánh"],
                        ["plan", "Dự toán"],
                        ["actual", "Thực chi"],
                      ].map(([id, label]) => (
                        <button
                          className={financeTab === id ? "active" : ""}
                          onClick={() => setFinanceTab(id)}
                          key={id}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <select
                      aria-label="Lọc nhóm chi phí"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="all">Tất cả nhóm</option>
                      {CATEGORIES.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  {financeTab === "summary" ? (
                    <>
                      <section className="panel">
                        <div className="section-heading">
                          <h2>Dự toán & thực tế</h2>
                          {writable && (
                            <button
                              className="btn secondary"
                              onClick={() =>
                                download(
                                  "TripFlow-Chi-phi.csv",
                                  csv(data),
                                  "text/csv;charset=utf-8",
                                )
                              }
                            >
                              <Download size={16} />
                              Xuất CSV
                            </button>
                          )}
                        </div>
                        <div className="comparison-bars">
                          <div>
                            <span>Dự toán</span>
                            <Bar
                              value={totals.plan}
                              max={Math.max(totals.plan, totals.actual)}
                            />
                            <b>{money(totals.plan)}</b>
                          </div>
                          <div>
                            <span>Thực chi</span>
                            <Bar
                              value={totals.actual}
                              max={Math.max(totals.plan, totals.actual)}
                              over={totals.actual > totals.plan}
                            />
                            <b>{money(totals.actual)}</b>
                          </div>
                        </div>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Nhóm</th>
                                <th>Dự toán</th>
                                <th>Thực chi</th>
                                <th>Chênh lệch</th>
                              </tr>
                            </thead>
                            <tbody>
                              {totals.categories
                                .filter(
                                  (x) =>
                                    category === "all" ||
                                    x.category === category,
                                )
                                .map((x) => (
                                  <tr key={x.category}>
                                    <td>{x.category}</td>
                                    <td>{money(x.plan)}</td>
                                    <td>{money(x.actual)}</td>
                                    <td
                                      className={
                                        x.plan < x.actual ? "negative" : ""
                                      }
                                    >
                                      {money(x.plan - x.actual)}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="hint">
                          Chênh lệch = dự toán − thực chi. Thực chi ròng đã trừ
                          hoàn tiền. Tổng trên cùng là toàn chuyến.
                        </p>
                      </section>
                      <section className="panel">
                        <h2>Đối chiếu từng khoản</h2>
                        {data.budgets
                          .filter(
                            (b) =>
                              category === "all" || b.category === category,
                          )
                          .map((b) => {
                            const actual = net(
                              data.expenses.filter((x) => x.budget_id === b.id),
                            );
                            return (
                              <div className="reconcile" key={b.id}>
                                <div>
                                  <b>{b.title}</b>
                                  <small>{b.category}</small>
                                </div>
                                <div>
                                  <b>
                                    {money(actual)} / {money(Number(b.amount))}
                                  </b>
                                  <small
                                    className={
                                      actual > Number(b.amount)
                                        ? "negative"
                                        : ""
                                    }
                                  >
                                    Chênh lệch{" "}
                                    {money(Number(b.amount) - actual)}
                                  </small>
                                </div>
                              </div>
                            );
                          })}
                        <p className="notice">
                          Thực chi chưa gắn dự toán:{" "}
                          <b>{money(totals.unlinked)}</b>. Các khoản này đã nằm
                          trong tổng thực chi.
                        </p>
                      </section>
                      <section className="panel">
                        <div className="section-heading">
                          <h2>Dự toán đã chốt</h2>
                          {owner && (
                            <button
                              className="btn secondary"
                              onClick={() => edit("snapshot")}
                            >
                              <LockKeyhole size={16} />
                              Chốt dự toán
                            </button>
                          )}
                        </div>
                        {latestSnapshot ? (
                          <>
                            <p>
                              <b>{latestSnapshot.title}</b> ·{" "}
                              {dateLabel(latestSnapshot.created_at)}
                            </p>
                            <div className="snapshot-values">
                              <span>
                                Ngân sách gốc{" "}
                                <b>{money(planned(latestSnapshot.data))}</b>
                              </span>
                              <span>
                                So với thực chi{" "}
                                <b
                                  className={
                                    planned(latestSnapshot.data) < totals.actual
                                      ? "negative"
                                      : ""
                                  }
                                >
                                  {money(
                                    planned(latestSnapshot.data) -
                                      totals.actual,
                                  )}
                                </b>
                              </span>
                            </div>
                            <details>
                              <summary>
                                Lịch sử {data.snapshots.length} lần chốt
                              </summary>
                              {data.snapshots.map((s) => (
                                <p key={s.id}>
                                  {dateLabel(s.created_at)} · {s.title} ·{" "}
                                  {money(planned(s.data))}
                                </p>
                              ))}
                            </details>
                          </>
                        ) : (
                          <p className="muted">
                            Chốt một bản dự toán trước khi đi để đối chiếu, ngay
                            cả khi ngân sách hiện hành thay đổi.
                          </p>
                        )}
                      </section>
                    </>
                  ) : financeTab === "plan" ? (
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Dự toán chi tiết</h2>
                        {writable && (
                          <button
                            className="btn secondary"
                            onClick={() => edit("budget")}
                          >
                            <Plus size={16} />
                            Thêm dự toán
                          </button>
                        )}
                      </div>
                      {data.budgets
                        .filter(
                          (b) => category === "all" || b.category === category,
                        )
                        .map((b) => (
                          <article className="ledger-row" key={b.id}>
                            <span className="ledger-icon">
                              <Wallet size={20} />
                            </span>
                            <div className="ledger-content">
                              <h3>{b.title}</h3>
                              <small>
                                {b.category}
                                {b.item_id
                                  ? " · " +
                                    data.items.find((x) => x.id === b.item_id)
                                      ?.title
                                  : ""}
                              </small>
                              <small>
                                {b.quantity} × {money(Number(b.unit_price))}
                              </small>
                              {b.note && <p className="prewrap">{b.note}</p>}
                            </div>
                            <b className="ledger-amount">
                              {money(Number(b.amount))}
                            </b>
                            {rowTools("budget", b)}
                          </article>
                        ))}
                      {!data.budgets.length && (
                        <Empty
                          title="Dự trù trước khi lên đường"
                          text="Thêm vé xe, khách sạn, ăn uống và những khoản dự kiến."
                          onAdd={writable ? () => edit("budget") : undefined}
                        />
                      )}
                    </section>
                  ) : (
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Nhật ký chi tiêu</h2>
                        <span className="pill">
                          {data.expenses.length} giao dịch
                        </span>
                      </div>
                      {data.expenses
                        .filter(
                          (x) => category === "all" || x.category === category,
                        )
                        .toSorted((a, b) =>
                          b.spent_on.localeCompare(a.spent_on),
                        )
                        .map((x) => (
                          <article className="ledger-row" key={x.id}>
                            <span
                              className={`ledger-icon ${x.kind === "refund" ? "refund" : ""}`}
                            >
                              <Receipt size={20} />
                            </span>
                            <div className="ledger-content">
                              <h3>{x.title}</h3>
                              <small>
                                {dateLabel(x.spent_on)} · {x.category} ·{" "}
                                {x.payer || "Chưa ghi người trả"}
                              </small>
                              <small>
                                {x.kind === "refund" ? "Hoàn tiền · " : ""}
                                {x.budget_id
                                  ? data.budgets.find(
                                      (b) => b.id === x.budget_id,
                                    )?.title
                                  : "Ngoài dự toán / chưa liên kết"}
                              </small>
                              {x.note && <p className="prewrap">{x.note}</p>}
                              {x.receipt_url && (
                                <Link url={x.receipt_url}>Xem chứng từ</Link>
                              )}
                            </div>
                            <b
                              className={`ledger-amount ${x.kind === "refund" ? "positive" : ""}`}
                            >
                              {x.kind === "refund" ? "−" : ""}
                              {money(Number(x.amount))}
                            </b>
                            {rowTools("expense", x)}
                          </article>
                        ))}
                      {!data.expenses.length && (
                        <Empty
                          title="Chưa có khoản chi"
                          text="Ghi lại chi tiêu ngay khi phát sinh."
                          onAdd={writable ? () => edit("expense") : undefined}
                          label="Ghi chi tiêu"
                        />
                      )}
                    </section>
                  )}
                </>
              )}
              {tab === "media" && data && (
                <>
                  <div className="notice">
                    <Link2 size={20} />
                    <span>
                      Ảnh và video nằm tại Google Drive hoặc trang nguồn.
                      TripFlow chỉ lưu liên kết; người xem cần được cấp quyền ở
                      nguồn.
                    </span>
                  </div>
                  <div className="media-grid">
                    {data.media.map((m) => (
                      <section className="panel media-card" key={m.id}>
                        <div className="media-cover">
                          {m.kind === "document" ? (
                            <FileText size={35} />
                          ) : (
                            <Images size={35} />
                          )}
                          <span>
                            {
                              {
                                album: "ALBUM",
                                photo: "ẢNH",
                                video: "VIDEO",
                                document: "TÀI LIỆU",
                              }[m.kind]
                            }
                          </span>
                        </div>
                        <div className="section-heading">
                          <h3>{m.title}</h3>
                          {rowTools("media", m)}
                        </div>
                        {m.item_id && (
                          <p className="muted">
                            {data.items.find((x) => x.id === m.item_id)?.title}
                          </p>
                        )}
                        {m.note && <p className="prewrap">{m.note}</p>}
                        <Link url={m.url}>
                          Mở{" "}
                          {
                            {
                              album: "album",
                              photo: "ảnh",
                              video: "video",
                              document: "tài liệu",
                            }[m.kind]
                          }
                        </Link>
                      </section>
                    ))}
                  </div>
                  {!data.media.length && (
                    <section className="panel">
                      <Empty
                        title="Một nơi cho những kỷ niệm"
                        text="Gắn album Google Drive để cả nhóm mở xem."
                        onAdd={writable ? () => edit("media") : undefined}
                        label="Gắn liên kết"
                      />
                    </section>
                  )}
                </>
              )}
              {tab === "more" && data && (
                <>
                  <div className="settings-grid">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Thông tin chuyến đi</h2>
                        {writable && (
                          <button
                            className="icon-btn"
                            aria-label="Sửa chuyến đi"
                            onClick={() => edit("trip", trip)}
                          >
                            <Pencil size={18} />
                          </button>
                        )}
                      </div>
                      <dl>
                        <dt>Tên</dt>
                        <dd>{trip.name}</dd>
                        <dt>Điểm đến</dt>
                        <dd>{trip.destination}</dd>
                        <dt>Ngày</dt>
                        <dd>
                          {dateLabel(trip.start_date)} –{" "}
                          {dateLabel(trip.end_date)}
                        </dd>
                        <dt>Múi giờ</dt>
                        <dd>{trip.timezone}</dd>
                        <dt>Trạng thái</dt>
                        <dd>{TRIP_STATUS[trip.status]}</dd>
                        <dt>Quyền của bạn</dt>
                        <dd>
                          {
                            {
                              owner: "Chủ chuyến",
                              editor: "Chỉnh sửa",
                              viewer: "Chỉ xem",
                            }[data.role]
                          }
                        </dd>
                      </dl>
                    </section>
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Người tham gia</h2>
                        {writable && (
                          <button
                            className="btn secondary"
                            onClick={() => edit("participant")}
                          >
                            <Plus size={16} />
                            Thêm
                          </button>
                        )}
                      </div>
                      <p className="hint">
                        Danh sách người đi, không tự cấp quyền tài khoản. Bình
                        quân chi phí dùng số người trong thông tin chuyến đi:{" "}
                        {trip.people}.
                      </p>
                      {data.participants.map((x) => (
                        <div className="simple-row" key={x.id}>
                          <div>
                            <b>{x.name}</b>
                            <small>{x.note}</small>
                          </div>
                          {rowTools("participant", x)}
                        </div>
                      ))}
                      {!data.participants.length && (
                        <p className="muted">Chưa thêm người tham gia.</p>
                      )}
                    </section>
                  </div>
                  <section className="panel">
                    <div className="section-heading">
                      <h2>Chia sẻ chuyến đi</h2>
                      {owner && (
                        <button
                          className="btn secondary"
                          onClick={() => edit("invitation")}
                        >
                          <Plus size={16} />
                          Mời thành viên
                        </button>
                      )}
                    </div>
                    <p className="hint">
                      Lời mời gắn với email và có hạn 7 ngày. Bạn sao chép liên
                      kết để gửi cho người được mời; ứng dụng không tự gửi email
                      mời.
                    </p>
                    {data.members.map((m) => (
                      <div className="simple-row" key={m.id}>
                        <div>
                          <b>{m.email}</b>
                          <small>
                            {m.role === "editor" ? "Được chỉnh sửa" : "Chỉ xem"}
                          </small>
                        </div>
                        {owner && (
                          <div className="row-tools">
                            <button
                              className="icon-btn"
                              aria-label="Sửa quyền"
                              onClick={() => edit("member", m)}
                            >
                              <Pencil size={17} />
                            </button>
                            <button
                              className="icon-btn danger"
                              aria-label="Thu hồi quyền"
                              onClick={() => remove("member", m)}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {owner &&
                      data.invitations
                        .filter((x) => !x.used_at && !x.revoked_at)
                        .map((i) => (
                          <div className="simple-row" key={i.id}>
                            <div>
                              <b>{i.email}</b>
                              <small>
                                {new Date(i.expires_at) < new Date()
                                  ? "Đã hết hạn"
                                  : "Chờ chấp nhận"}{" "}
                                · {dateLabel(i.expires_at)}
                              </small>
                            </div>
                            <div className="row-tools">
                              <button
                                className="icon-btn"
                                aria-label="Xem liên kết mời"
                                onClick={() =>
                                  setShareLink(
                                    location.origin + "/?invite=" + i.token,
                                  )
                                }
                              >
                                <Link2 size={18} />
                              </button>
                              <button
                                className="icon-btn danger"
                                aria-label="Thu hồi lời mời"
                                onClick={() => remove("invitation", i)}
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                          </div>
                        ))}
                  </section>
                  <section className="panel">
                    <div className="section-heading">
                      <div>
                        <h2>Dữ liệu, offline & tài khoản</h2>
                        <p className="muted">
                          Supabase là nguồn dữ liệu chính. IndexedDB giữ bản cache theo từng tài khoản và hàng đợi thao tác khi mạng yếu.
                        </p>
                      </div>
                      <span className={`status-chip ${online ? "active" : "deactivated"}`}>
                        {online ? "Online" : "Offline"}
                      </span>
                    </div>
                    <div className="sync-summary">
                      <div><CloudUpload size={19} /><span><b>{queuePending}</b><small>Chờ đồng bộ</small></span></div>
                      <div><AlertTriangle size={19} /><span><b>{queueIssues}</b><small>Xung đột / bị từ chối</small></span></div>
                    </div>
                    {queueRows.length > 0 && (
                      <div className="sync-queue-list">
                        {queueRows.map((row) => (
                          <div key={row.operationId}>
                            <span className={`sync-dot ${row.state}`} />
                            <span>
                              <b>{row.mutation.entity} · {row.mutation.action}</b>
                              <small>
                                {row.state === "pending"
                                  ? "Chờ gửi"
                                  : row.state === "sending"
                                    ? "Đang gửi"
                                    : row.state === "conflict"
                                      ? "Xung đột dữ liệu"
                                      : "Bị từ chối"}
                                {row.error ? ` · ${row.error}` : ""}
                              </small>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="actions">
                      {queueRows.length > 0 && (
                        <button
                          className="btn secondary"
                          disabled={!online || syncing}
                          onClick={() => void syncPending(true)}
                        >
                          <CloudUpload size={17} />
                          {syncing ? "Đang đồng bộ…" : "Đồng bộ ngay"}
                        </button>
                      )}
                      {queueIssues > 0 && (
                        <button
                          className="btn secondary"
                          disabled={!online || syncing}
                          onClick={async () => {
                            await retryQueue(user.id);
                            await refreshQueue();
                            void syncPending(true);
                          }}
                        >
                          <RefreshCw size={17} />
                          Thử lại thao tác lỗi
                        </button>
                      )}
                      {account?.role === "master" && (
                        <button className="btn secondary" onClick={() => navigate("admin")}>
                          <ShieldCheck size={17} />
                          Quản trị Master
                        </button>
                      )}
                      {owner && (
                        <button
                          className="btn secondary"
                          onClick={() =>
                            download(
                              "TripFlow-" + trip.id + ".json",
                              JSON.stringify(
                                {
                                  format: "tripflow-cloud-export",
                                  version: 2,
                                  exportedAt: new Date().toISOString(),
                                  trip,
                                  items: data.items,
                                  budgets: data.budgets,
                                  expenses: data.expenses,
                                  media: data.media,
                                  participants: data.participants,
                                  snapshots: data.snapshots,
                                },
                                null,
                                2,
                              ),
                              "application/json",
                            )
                          }
                        >
                          <Download size={17} />
                          Xuất dữ liệu JSON
                        </button>
                      )}
                      <button className="btn secondary" onClick={logout}>
                        <LogOut size={17} />
                        Đăng xuất
                      </button>
                    </div>
                    <p className="hint">
                      Offline V0.2.0 hỗ trợ ghi chi tiêu mới, cập nhật/check-in lịch trình, người tham gia và media. Phân quyền, xóa chuyến, chốt dự toán và quản trị yêu cầu online.
                    </p>
                    <p className="hint">
                      {user.email} · TripFlow {VERSION}{account?.role === "master" ? " · MASTER" : ""}
                    </p>
                  </section>
                  <ProductRoadmap />
                  <section className="panel">
                    <h2>Lịch sử gần đây</h2>
                    <p className="hint">
                      15 thay đổi gần nhất. Nhật ký đầy đủ được lưu trong
                      database.
                    </p>
                    {data.audits.slice(0, 15).map((a) => (
                      <div className="audit-row" key={a.id}>
                        <Clock size={15} />
                        <span>
                          <b>{tableNames[a.entity] || a.entity}</b> ·{" "}
                          {a.action === "INSERT"
                            ? "Thêm mới"
                            : a.action === "DELETE"
                              ? "Thu hồi"
                              : a.after_data?.deleted_at
                                ? "Xóa"
                                : "Cập nhật"}
                          {a.after_data?.title
                            ? " · " + String(a.after_data.title)
                            : ""}
                          <small>
                            {dateLabel(localTime(a.created_at, trip.timezone))}{" "}
                            · {localTime(a.created_at, trip.timezone).slice(11)}
                          </small>
                        </span>
                      </div>
                    ))}
                  </section>
                  {owner && (
                    <section className="panel danger-panel">
                      <div>
                        <h2>Xóa chuyến đi</h2>
                        <p className="muted">
                          Chuyến đi sẽ không còn trong danh sách của các thành
                          viên.
                        </p>
                      </div>
                      <button
                        className="btn danger-btn"
                        onClick={() => remove("trip", trip)}
                      >
                        <Trash2 size={16} />
                        Xóa chuyến đi
                      </button>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </main>
        <footer className="page-footer">
          <b>TRIPFLOW</b>
          <span>
            V{VERSION} · {online ? "Đang kết nối" : "Mất kết nối"}
          </span>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng chính">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => navigate(id)}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {spec && (
        <Editor
          key={spec.entity + String(spec.record?.id || "new")}
          spec={spec}
          bundle={data}
          onClose={() => setSpec(null)}
          onSave={save}
        />
      )}
      {tripPicker && (
        <Dialog open onClose={() => setTripPicker(false)} title="Các chuyến đi">
          <div className="dialog-body trip-list">
            {trips.map((t) => (
              <button
                className={selectedId === t.id ? "selected" : ""}
                key={t.id}
                onClick={() => {
                  setSelected(t.id);
                  setDay("all");
                  setCategory("all");
                  setTripPicker(false);
                  setTab("home");
                }}
              >
                <span className="trip-icon">
                  <Compass size={24} />
                </span>
                <span>
                  <b>{t.name}</b>
                  <small>
                    {t.destination} · {dateLabel(t.start_date)}
                  </small>
                  <small>{TRIP_STATUS[t.status]}</small>
                </span>
                {selectedId === t.id ? (
                  <Check size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
              </button>
            ))}
            {!trips.length && <p className="muted">Chưa có chuyến đi nào.</p>}
          </div>
          <footer className="dialog-footer">
            <button
              className="btn primary"
              onClick={() => {
                setTripPicker(false);
                edit("trip");
              }}
            >
              <Plus size={17} />
              Tạo chuyến đi
            </button>
          </footer>
        </Dialog>
      )}
      {confirm && (
        <Dialog
          open
          onClose={() => !working && setConfirm(null)}
          title={confirm.title}
        >
          <div className="dialog-body">
            <p>{confirm.text}</p>
            {error && <p className="error">{error}</p>}
          </div>
          <footer className="dialog-footer">
            <button
              className="btn secondary"
              disabled={working}
              onClick={() => {
                setConfirm(null);
                setError("");
              }}
            >
              Hủy
            </button>
            <button
              className="btn primary"
              disabled={working}
              onClick={async () => {
                setWorking(true);
                setError("");
                try {
                  await confirm.action();
                  setConfirm(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setWorking(false);
                }
              }}
            >
              {working ? "Đang xử lý…" : "Xác nhận"}
            </button>
          </footer>
        </Dialog>
      )}
      {shareLink && (
        <Dialog
          open
          onClose={() => setShareLink("")}
          title={
            shareLink.includes("google.com/maps")
              ? "Vị trí GPS hiện tại"
              : "Liên kết mời thành viên"
          }
        >
          <div className="dialog-body">
            <p className="muted">
              {shareLink.includes("google.com/maps")
                ? "Vị trí GPS không tự cập nhật check-in. Mở Google Maps để xem."
                : "Người nhận cần đăng nhập đúng email được mời trước khi chấp nhận."}
            </p>
            <input
              aria-label="Liên kết"
              className="share-input"
              value={shareLink}
              readOnly
              onFocus={(e) => e.target.select()}
            />
            <div className="actions">
              <button
                className="btn secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                    notify("Đã sao chép liên kết.");
                  } catch {
                    notify("Hãy chọn và sao chép liên kết trong ô.");
                  }
                }}
              >
                <Copy size={17} />
                Sao chép
              </button>
              <Link url={shareLink}>Mở liên kết</Link>
            </div>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
    </div>
  );
}
