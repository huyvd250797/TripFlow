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
  Radio,
  History,
  Timer,
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
  type RecoveryOverview,
  type RecoveryBackupPackage,
  type RecoveryTombstone,
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
  buildFinanceReport,
  financeJson,
  buildTripAnalytics,
  postTripCsv,
  postTripJson,
  postTripHtml,
} from "@/lib/domain";
import { MasterAdmin } from "./admin";
import { ProductRoadmap } from "./roadmap";
import { ReleaseReadiness } from "./release-readiness";
import { BrandMark, BrandName } from "./brand";
import {
  cacheBundle,
  cacheTrips,
  canQueueMutation,
  clearUserOfflineData,
  enqueueMutation,
  listQueue,
  readCachedBundle,
  readCachedTrips,
  removeCachedBundle,
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
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

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
function openPrintableReport(name: string, content: string) {
  const u = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" }));
  const opened = window.open(u + "#print", "_blank");
  if (!opened) download(name, content, "text/html;charset=utf-8");
  setTimeout(() => URL.revokeObjectURL(u), 60000);
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
    [syncing, setSyncing] = useState(false),
    [realtimeState, setRealtimeState] = useState<
      "idle" | "connecting" | "live" | "offline" | "error"
    >("idle"),
    [pwaState, setPwaState] = useState({
      standalone: false,
      installable: false,
      updateReady: false,
      serviceWorkerReady: false,
      storagePersisted: false,
      ios: false,
    });
  const syncLock = useRef(false);
  const installPromptRef = useRef<InstallPromptEvent | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const swReloadingRef = useRef(false);
  const restoredViewRef = useRef("");
  const initialSplashRef = useRef(true);
  const notify = useCallback((s: string) => setToast(s), []);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const loadAuth = useCallback(async () => {
    const splashStartedAt = performance.now();
    if (!configured()) {
      setAuthLoading(false);
      initialSplashRef.current = false;
      return;
    }
    const s = browserClient();
    const { data } = await s.auth.getUser();
    setUser(data.user);
    if (initialSplashRef.current) {
      const remaining = Math.max(0, 680 - (performance.now() - splashStartedAt));
      if (remaining) await new Promise((resolve) => setTimeout(resolve, remaining));
      initialSplashRef.current = false;
    }
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
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setPwaState((x) => ({ ...x, standalone, ios }));

    const syncViewport = () => {
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty(
        "--tf-viewport-height",
        `${Math.round(viewportHeight)}px`,
      );
      const keyboardOpen = window.innerHeight - viewportHeight > 120;
      document.documentElement.dataset.keyboard = keyboardOpen ? "open" : "closed";
    };
    syncViewport();
    window.visualViewport?.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("scroll", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    const beforeInstall = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as InstallPromptEvent;
      setPwaState((x) => ({ ...x, installable: true }));
    };
    const installed = () => {
      installPromptRef.current = null;
      setPwaState((x) => ({ ...x, standalone: true, installable: false }));
      notify("TripFlow đã được cài trên thiết bị.");
    };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);

    if (navigator.storage?.persisted) {
      void navigator.storage.persisted().then((value) =>
        setPwaState((x) => ({ ...x, storagePersisted: value })),
      );
    }

    let updateTimer: ReturnType<typeof setInterval> | undefined;
    let onFocus: (() => void) | undefined;
    let controllerChanged: (() => void) | undefined;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          swRegistrationRef.current = registration;
          setPwaState((x) => ({
            ...x,
            serviceWorkerReady: true,
            updateReady: Boolean(registration.waiting && navigator.serviceWorker.controller),
          }));
          const watchInstalling = () => {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
              if (
                worker.state === "installed" &&
                navigator.serviceWorker.controller
              )
                setPwaState((x) => ({ ...x, updateReady: true }));
            });
          };
          registration.addEventListener("updatefound", watchInstalling);
          onFocus = () => void registration.update().catch(() => undefined);
          window.addEventListener("focus", onFocus);
          updateTimer = setInterval(
            () => void registration.update().catch(() => undefined),
            60 * 60 * 1000,
          );
        })
        .catch(() => undefined);
      controllerChanged = () => {
        if (swReloadingRef.current) return;
        swReloadingRef.current = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", controllerChanged);
    }

    return () => {
      window.visualViewport?.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      if (onFocus) window.removeEventListener("focus", onFocus);
      if (controllerChanged)
        navigator.serviceWorker?.removeEventListener("controllerchange", controllerChanged);
      if (updateTimer) clearInterval(updateTimer);
    };
  }, [notify]);
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
  useEffect(() => {
    if (!user || !selectedId) return;
    const restoreKey = `${user.id}:${selectedId}`;
    if (restoredViewRef.current === restoreKey) return;
    restoredViewRef.current = restoreKey;
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(`tripflow:view:${restoreKey}`) || "{}",
      ) as { tab?: string; day?: string; category?: string; financeTab?: string };
      const canRestoreTab = Boolean(
        saved.tab &&
          (tabs.some((x) => x.id === saved.tab) ||
            (saved.tab === "admin" && account?.role === "master")),
      );
      if (canRestoreTab && saved.tab) setTab(saved.tab);
      if (saved.day) setDay(saved.day);
      if (saved.category) setCategory(saved.category);
      if (saved.financeTab) setFinanceTab(saved.financeTab);
      requestAnimationFrame(() => {
        const activeTab = canRestoreTab && saved.tab ? saved.tab : "home";
        const y = Number(
          sessionStorage.getItem(`tripflow:scroll:${restoreKey}:${activeTab}`) || 0,
        );
        window.scrollTo({ top: Number.isFinite(y) ? y : 0, behavior: "instant" });
      });
    } catch {
      // sessionStorage có thể bị chặn ở private mode; app vẫn hoạt động bình thường.
    }
  }, [user, selectedId, account?.role]);
  useEffect(() => {
    if (!user || !selectedId) return;
    const restoreKey = `${user.id}:${selectedId}`;
    try {
      sessionStorage.setItem(
        `tripflow:view:${restoreKey}`,
        JSON.stringify({ tab, day, category, financeTab }),
      );
    } catch {}
    const rememberScroll = () => {
      try {
        sessionStorage.setItem(
          `tripflow:scroll:${restoreKey}:${tab}`,
          String(Math.max(0, Math.round(window.scrollY))),
        );
      } catch {}
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    window.addEventListener("pagehide", rememberScroll);
    return () => {
      rememberScroll();
      window.removeEventListener("scroll", rememberScroll);
      window.removeEventListener("pagehide", rememberScroll);
    };
  }, [user, selectedId, tab, day, category, financeTab]);
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
  const recoveryQ = useQuery<RecoveryOverview>({
    queryKey: ["recovery", user?.id, selectedId || "all"],
    queryFn: () =>
      api<RecoveryOverview>(
        "/api/recovery?mode=overview" +
          (selectedId ? "&trip=" + encodeURIComponent(selectedId) : ""),
      ),
    enabled:
      !!user &&
      tab === "more" &&
      online &&
      (!selectedId || data?.role === "owner"),
    staleTime: 5000,
  });
  useEffect(() => {
    if (!user || !selectedId || !configured()) {
      setRealtimeState("idle");
      return;
    }
    if (!online) {
      setRealtimeState("offline");
      return;
    }
    const s = browserClient();
    setRealtimeState("connecting");
    const refreshTrip = () => {
      void qc.invalidateQueries({
        queryKey: ["trip", user.id, selectedId],
      });
    };
    const refreshTripAndList = () => {
      refreshTrip();
      void qc.invalidateQueries({ queryKey: ["trips", user.id] });
    };
    const channel = s
      .channel("trip-live:" + selectedId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "itinerary_items",
          filter: `trip_id=eq.${selectedId}`,
        },
        refreshTrip,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "itinerary_events",
          filter: `trip_id=eq.${selectedId}`,
        },
        refreshTrip,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "expenses",
          filter: `trip_id=eq.${selectedId}`,
        },
        refreshTrip,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `id=eq.${selectedId}`,
        },
        refreshTripAndList,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_members",
          filter: `trip_id=eq.${selectedId}`,
        },
        refreshTripAndList,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_invitations",
          filter: `trip_id=eq.${selectedId}`,
        },
        refreshTrip,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_participants",
          filter: `trip_id=eq.${selectedId}`,
        },
        refreshTrip,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_access_events",
          filter: `target_user_id=eq.${user.id}`,
        },
        (payload) => {
          refreshTripAndList();
          const event = payload.new as { trip_id?: string; event_type?: string; role?: string };
          if (event.trip_id === selectedId) {
            if (event.event_type === "revoked")
              void removeCachedBundle(user.id, selectedId);
            notify(
              event.event_type === "revoked"
                ? "Quyền truy cập chuyến đi vừa được thu hồi. Cache của chuyến đã được xóa khỏi thiết bị này."
                : event.event_type === "role_changed"
                  ? `Quyền của bạn vừa đổi thành ${event.role === "editor" ? "Chỉnh sửa" : "Chỉ xem"}.`
                  : "Bạn vừa được cấp quyền chuyến đi.",
            );
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeState("live");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setRealtimeState("error");
        else if (status === "CLOSED") setRealtimeState("idle");
      });
    return () => {
      setRealtimeState("idle");
      void s.removeChannel(channel);
    };
  }, [user, selectedId, qc, online, notify]);
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
        "Thao tác này cần kết nối mạng. Chế độ offline hiện chỉ cho phép ghi chi tiêu mới, cập nhật/check-in lịch trình, người tham gia và media.",
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
    if (user && selectedId) {
      const restoreKey = `${user.id}:${selectedId}`;
      try {
        sessionStorage.setItem(
          `tripflow:scroll:${restoreKey}:${tab}`,
          String(Math.max(0, Math.round(window.scrollY))),
        );
      } catch {}
      setTab(id);
      requestAnimationFrame(() => {
        const y = Number(
          sessionStorage.getItem(`tripflow:scroll:${restoreKey}:${id}`) || 0,
        );
        window.scrollTo({ top: Number.isFinite(y) ? y : 0, behavior: "instant" });
      });
      return;
    }
    setTab(id);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function installPwa() {
    const prompt = installPromptRef.current;
    if (!prompt) {
      notify(
        pwaState.ios
          ? "Trên iPhone/iPad: mở Chia sẻ → Thêm vào Màn hình chính."
          : "Trình duyệt chưa cung cấp nút cài. Hãy dùng menu Cài đặt/Install app của trình duyệt.",
      );
      return;
    }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") {
      installPromptRef.current = null;
      setPwaState((x) => ({ ...x, installable: false }));
    }
  }
  function applyPwaUpdate() {
    const worker = swRegistrationRef.current?.waiting;
    if (!worker) {
      void swRegistrationRef.current?.update();
      notify("Đang kiểm tra bản TripFlow mới…");
      return;
    }
    worker.postMessage({ type: "SKIP_WAITING" });
  }
  async function protectOfflineStorage() {
    if (!navigator.storage?.persist) {
      notify("Trình duyệt này không hỗ trợ yêu cầu lưu trữ bền vững.");
      return;
    }
    const granted = await navigator.storage.persist();
    setPwaState((x) => ({ ...x, storagePersisted: granted }));
    notify(
      granted
        ? "Đã ưu tiên giữ cache TripFlow trên thiết bị."
        : "Trình duyệt chưa cấp lưu trữ bền vững; dữ liệu server vẫn an toàn và cache có thể được dọn khi thiếu bộ nhớ.",
    );
  }
  async function recoveryPost(body: Record<string, unknown>) {
    if (!navigator.onLine) throw new Error("Backup & Recovery cần kết nối mạng.");
    return api<{ result: Record<string, unknown> }>("/api/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  async function createBackup() {
    if (!trip || !owner) return;
    const title = window.prompt(
      "Tên bản backup",
      `${trip.name} · ${new Date().toLocaleString("vi-VN")}`,
    );
    if (title === null) return;
    setWorking(true);
    setError("");
    try {
      await recoveryPost({ action: "create_backup", tripId: trip.id, title });
      await recoveryQ.refetch();
      notify("Đã tạo backup trên hệ thống.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function downloadBackup(id: string, title: string) {
    try {
      const value = await api<RecoveryBackupPackage>(
        `/api/recovery?mode=download&id=${encodeURIComponent(id)}`,
      );
      download(
        `TripFlow-Recovery-${id}.json`,
        JSON.stringify(value, null, 2),
        "application/json",
      );
      notify(`Đã xuất “${title}”.`);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function restoreBackup(id: string, title: string) {
    if (!window.confirm(`Khôi phục “${title}” thành một chuyến đi mới? Chuyến hiện tại sẽ không bị ghi đè.`)) return;
    setWorking(true);
    setError("");
    try {
      const res = await recoveryPost({ action: "restore_backup", backupId: id });
      const tripId = String(res.result.trip_id || "");
      await qc.invalidateQueries();
      if (tripId) {
        setSelected(tripId);
        setTab("home");
      }
      notify("Đã khôi phục backup thành chuyến đi mới.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  async function restoreDeleted(entity: string, id: string, tripId: string, title: string) {
    if (!window.confirm(`Khôi phục “${title}”?`)) return;
    setWorking(true);
    setError("");
    try {
      await recoveryPost({ action: "restore_deleted", entity, id, tripId });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["trips"] }),
        qc.invalidateQueries({ queryKey: ["trip"] }),
        recoveryQ.refetch(),
      ]);
      if (entity === "trip") setSelected(id);
      notify("Đã khôi phục dữ liệu từ thùng rác.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  function recoveryEntityLabel(entity: RecoveryTombstone["entity"]) {
    return ({ item: "Hoạt động", budget: "Dự toán", expense: "Chi tiêu", media: "Media", participant: "Người tham gia" } as const)[entity];
  }
  function recoveryPanel(hasTrip: boolean) {
    if (!online)
      return (
        <section className="panel">
          <h2>Backup & Recovery</h2>
          <p className="muted">Khu vực khôi phục cần kết nối mạng để luôn kiểm tra dữ liệu và quyền mới nhất trên server.</p>
        </section>
      );
    if (recoveryQ.isPending)
      return (
        <section className="panel">
          <h2>Backup & Recovery</h2>
          <p className="muted">Đang kiểm tra backup và thùng rác…</p>
        </section>
      );
    if (recoveryQ.error)
      return (
        <section className="panel">
          <h2>Backup & Recovery</h2>
          <p className="error">{recoveryQ.error.message}</p>
          <button className="btn secondary" onClick={() => void recoveryQ.refetch()}><RefreshCw size={17} /> Thử lại</button>
        </section>
      );
    const r = recoveryQ.data;
    if (!r) return null;
    return (
      <section className="panel recovery-panel">
        <div className="section-heading">
          <div>
            <h2>Backup & Recovery</h2>
            <p className="muted">Backup ứng dụng có checksum và khôi phục thành bản sao mới. Tombstone được giữ {r.policy.recovery_days} ngày theo chính sách hiện tại.</p>
          </div>
          {hasTrip && <button className="btn primary" disabled={working} onClick={() => void createBackup()}><ShieldCheck size={17} /> Tạo backup</button>}
        </div>
        <div className="sync-summary recovery-health">
          <div><ShieldCheck size={19} /><span><b>{r.health.backup_count}</b><small>Backup</small></span></div>
          <div><History size={19} /><span><b>{r.health.tombstone_count}</b><small>Đã xóa có thể phục hồi</small></span></div>
          <div><FileText size={19} /><span><b>{r.health.audit_count}</b><small>Audit hiện tại</small></span></div>
        </div>
        {hasTrip && r.backups.length > 0 && (
          <div className="recovery-group">
            <h3>Backup của chuyến này</h3>
            <div className="recovery-list">
              {r.backups.map((b) => (
                <div className="recovery-row" key={b.id}>
                  <span><b>{b.title}</b><small>{dateLabel(b.created_at.slice(0,10))} · {(b.size_bytes / 1024).toFixed(1)} KB · checksum {b.checksum.slice(0,8)}…</small></span>
                  <div className="row-tools">
                    <button className="icon-btn" title="Tải backup" onClick={() => void downloadBackup(b.id,b.title)}><Download size={17} /></button>
                    <button className="icon-btn" title="Khôi phục thành chuyến mới" onClick={() => void restoreBackup(b.id,b.title)}><RefreshCw size={17} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {hasTrip && r.tombstones.length > 0 && (
          <div className="recovery-group">
            <h3>Thùng rác của chuyến</h3>
            <div className="recovery-list">
              {r.tombstones.map((x) => (
                <div className="recovery-row" key={`${x.entity}:${x.id}`}>
                  <span><b>{recoveryEntityLabel(x.entity)} · {x.title}</b><small>Xóa {dateLabel(x.deleted_at.slice(0,10))} · khôi phục trước {dateLabel(x.purge_after.slice(0,10))}</small></span>
                  <button className="btn secondary compact" disabled={working} onClick={() => void restoreDeleted(x.entity,x.id,selectedId,x.title)}><RefreshCw size={15} /> Khôi phục</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {r.deleted_trips.length > 0 && (
          <div className="recovery-group">
            <h3>Chuyến đi đã xóa</h3>
            <div className="recovery-list">
              {r.deleted_trips.map((x) => (
                <div className="recovery-row" key={x.id}>
                  <span><b>{x.name}</b><small>{x.destination || "Không có điểm đến"} · xóa {dateLabel(x.deleted_at.slice(0,10))}</small></span>
                  <button className="btn secondary compact" disabled={working} onClick={() => void restoreDeleted("trip",x.id,x.id,x.name)}><RefreshCw size={15} /> Khôi phục chuyến</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {hasTrip && r.backups.length === 0 && r.tombstones.length === 0 && r.deleted_trips.length === 0 && (
          <p className="hint">Chưa có backup hoặc dữ liệu đã xóa. Nên tạo backup trước các thay đổi lớn.</p>
        )}
        {r.health.eligible_for_purge > 0 && (
          <p className="hint"><AlertTriangle size={14} /> Có {r.health.eligible_for_purge} tombstone đã qua cửa sổ recovery. V0.7.0 chỉ cảnh báo, không tự xóa vĩnh viễn.</p>
        )}
        <p className="hint">Retention chỉ đánh dấu cửa sổ phục hồi; V0.7.0 không tự purge dữ liệu production. Backup trong app không thay thế PostgreSQL backup/PITR độc lập của Supabase.</p>
      </section>
    );
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
      <div className="loading-screen" role="status" aria-live="polite">
        <div className="splash-orbit splash-orbit-one" />
        <div className="splash-orbit splash-orbit-two" />
        <div className="splash-content">
          <div className="splash-mark-wrap">
            <BrandMark />
            <span className="splash-pulse" />
          </div>
          <BrandName />
          <p>Sắp xếp hành trình của bạn</p>
          <div className="splash-route" aria-hidden="true">
            <span />
            <i />
            <span />
          </div>
          <small>PLAN · GO · REMEMBER</small>
        </div>
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
  const financeReport = data
    ? data.finance_report || buildFinanceReport(data)
    : null;
  const analytics = data ? buildTripAnalytics(data) : null;
  const progress = data
    ? live(data.items, now || new Date().toISOString())
    : null;
  const current = progress?.current;
  const orderedSnapshots = data?.snapshots.toSorted((a, b) =>
    (a.snapshot_no ?? 999999) - (b.snapshot_no ?? 999999) ||
    a.created_at.localeCompare(b.created_at),
  );
  const baselineSnapshot = orderedSnapshots?.[0];
  const latestSnapshot = orderedSnapshots?.at(-1);
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
    trip_backups: "Backup & Recovery",
  };
  const eventLabels: Record<string, string> = {
    check_in: "Check-in",
    complete: "Hoàn thành",
    auto_complete: "Tự hoàn thành khi chuyển chặng",
    skip: "Bỏ qua",
    reset: "Đặt lại kế hoạch",
    status: "Đổi trạng thái",
  };
  const minutesText = (value: number | null | undefined) => {
    if (value == null) return "";
    if (value < 60) return `${value} phút`;
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return minutes ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
  };
  const openAnalytics = () => {
    navigate("more");
    setTimeout(() =>
      document.getElementById("trip-analytics")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    120);
  };
  const liveCard = () => {
    if (!trip || !progress) return null;
    const overdueActive = progress.activeLateMinutes > 0;
    const lateCount = progress.late.length + (overdueActive ? 1 : 0);
    const worstLate = progress.lateMinutes.toSorted(
      (a, b) => b.minutes - a.minutes,
    )[0];
    const realtimeText =
      realtimeState === "live"
        ? "Realtime"
        : realtimeState === "connecting"
          ? "Đang nối"
          : realtimeState === "offline"
            ? "Offline"
            : realtimeState === "error"
              ? "Realtime lỗi"
              : "Định kỳ";
    return (
      <section className="live-panel">
        <div className="live-top">
          <span className="pill light">
            <MapPin size={14} />
            {trip.status === "completed"
              ? "CHUYẾN ĐI ĐÃ KẾT THÚC"
              : progress.active
                ? "CURRENT · CHECK-IN THỰC TẾ"
                : current
                  ? "CURRENT · THEO KẾ HOẠCH"
                  : progress.next
                    ? "NEXT · CHẶNG TIẾP THEO"
                    : "LIVE TRIP"}
          </span>
          <span className={`realtime-state ${realtimeState}`}>
            <Radio size={13} />
            {realtimeText}
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
        <div className="live-snapshot">
          <div>
            <small>CURRENT</small>
            <b>{current?.title || "Chưa có"}</b>
            <span>
              {progress.active
                ? overdueActive
                  ? `Đang trễ ${minutesText(progress.activeLateMinutes)}`
                  : "Đã check-in"
                : current
                  ? "Theo giờ kế hoạch"
                  : "Chưa có hoạt động hiện tại"}
            </span>
          </div>
          <div>
            <small>NEXT</small>
            <b>{progress.next?.title || "Chưa có"}</b>
            <span>
              {progress.next
                ? progress.nextInMinutes === 0
                  ? "Sắp bắt đầu"
                  : `Còn ${minutesText(progress.nextInMinutes)}`
                : "Không còn chặng kế tiếp"}
            </span>
          </div>
          <div className={lateCount ? "late" : ""}>
            <small>LATE</small>
            <b>{lateCount ? `${lateCount} chặng` : "Không có"}</b>
            <span>
              {overdueActive
                ? `Current trễ ${minutesText(progress.activeLateMinutes)}`
                : worstLate
                  ? `Lâu nhất ${minutesText(worstLate.minutes)}`
                  : "Đúng tiến độ"}
            </span>
          </div>
        </div>
        <div className="live-bottom">
          <small>
            {progress.active
              ? "Check-in dùng thời gian server; không tự suy ra từ GPS."
              : current
                ? "Chưa xác nhận có mặt. Đây không phải vị trí GPS."
                : "Giờ hiển thị theo múi giờ của chuyến đi."}
          </small>
          {current && writable && trip.status !== "completed" ? (
            <button
              className="btn lime"
              onClick={() =>
                status(current, progress.active ? "done" : "active")
              }
            >
              {progress.active ? <Check size={17} /> : <MapPin size={17} />} {" "}
              {progress.active ? "Hoàn thành" : "Tôi đã đến"}
            </button>
          ) : (
            <button className="btn lime" onClick={() => navigate("route")}>
              Xem lộ trình
              <ArrowRight size={17} />
            </button>
          )}
        </div>
        {(lateCount > 0 || progress.scheduled.length > 1) && (
          <small className="live-note">
            {lateCount > 0
              ? `${lateCount} hoạt động đang trễ hoặc đã qua giờ chưa xử lý.`
              : ""}
            {lateCount > 0 && progress.scheduled.length > 1 ? " · " : ""}
            {progress.scheduled.length > 1
              ? `Có ${progress.scheduled.length} hoạt động trùng giờ dự kiến.`
              : ""}
          </small>
        )}
      </section>
    );
  };
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="TripFlow · Trang chủ">
          <BrandMark />
          <BrandName />
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
          <span className="version">V{VERSION} · TRAVEL EDITION</span>
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
          <div className="mobile-brand" aria-label="TripFlow">
            <BrandMark />
            <BrandName />
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
                {recoveryPanel(false)}
                <ReleaseReadiness online={online} />
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
                  {analytics && (
                    <section className="analytics-glance">
                      <div>
                        <span className="eyebrow">TRIP ANALYTICS · V0.8.0</span>
                        <h2>{analytics.report_state === "post_trip" ? "Tổng kết sau chuyến đi" : "Tổng kết tạm thời"}</h2>
                        <p className="muted">
                          {analytics.itinerary.done}/{analytics.itinerary.total} hoạt động hoàn thành · {money(analytics.finance.net_actual)} thực chi · {analytics.media.total} media
                        </p>
                      </div>
                      <div className="analytics-glance-actions">
                        <span className={`status-chip ${analytics.readiness === "ready" ? "active" : ""}`}>
                          {analytics.readiness === "ready" ? "Sẵn sàng lưu trữ" : `${analytics.warnings.length} mục cần rà soát`}
                        </span>
                        <button className="btn secondary" onClick={openAnalytics}>
                          <FileText size={16} />
                          Xem báo cáo
                        </button>
                      </div>
                    </section>
                  )}
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
                      {(progress.late.length > 0 || progress.activeLateMinutes > 0) && (
                        <p className="inline-notice">
                          <Timer size={15} />
                          {progress.activeLateMinutes > 0
                            ? `Chặng hiện tại đang trễ ${minutesText(progress.activeLateMinutes)}.`
                            : `${progress.late.length} hoạt động qua giờ chưa cập nhật.`}
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
                                {x.status === "active" && progress.activeLateMinutes > 0
                                  ? ` · Trễ ${minutesText(progress.activeLateMinutes)}`
                                  : progress.late.some((s) => s.id === x.id)
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
                  <section className="panel live-history-panel">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">LIVE HISTORY</span>
                        <h2>Lịch sử trạng thái</h2>
                      </div>
                      <History size={20} />
                    </div>
                    {(data.live_events || []).length ? (
                      <div className="live-history">
                        {(data.live_events || []).slice(0, 12).map((event) => {
                          const item = data.items.find((x) => x.id === event.item_id);
                          return (
                            <div className="live-history-row" key={event.id}>
                              <span className={`history-dot ${event.to_status}`} />
                              <div>
                                <b>{eventLabels[event.event_type] || "Cập nhật trạng thái"}</b>
                                <p>{item?.title || "Hoạt động đã xóa"}</p>
                                <small>
                                  {event.actor_id === user.id ? "Bạn" : "Thành viên"} · {dateLabel(localTime(event.occurred_at, trip.timezone))} {localTime(event.occurred_at, trip.timezone).slice(11)}
                                  {event.from_status
                                    ? ` · ${ITEM_STATUS[event.from_status]} → ${ITEM_STATUS[event.to_status]}`
                                    : ` · ${ITEM_STATUS[event.to_status]}`}
                                </small>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted">
                        Lịch sử Live Trip sẽ xuất hiện khi bạn check-in, hoàn thành, bỏ qua hoặc đặt lại hoạt động sau khi nâng database V0.4.0.
                      </p>
                    )}
                  </section>
                </>
              )}
              {tab === "money" && data && totals && financeReport && (
                <>
                  <section className="money-banner finance-v030">
                    <div>
                      <span>Dự toán gốc</span>
                      <strong>
                        {financeReport.baseline_snapshot_id
                          ? money(financeReport.totals.original_budget)
                          : "Chưa chốt"}
                      </strong>
                    </div>
                    <div>
                      <span>Dự toán hiện tại</span>
                      <strong>{money(financeReport.totals.current_budget)}</strong>
                    </div>
                    <div>
                      <span>Thực chi ròng</span>
                      <strong>{money(financeReport.totals.net_actual)}</strong>
                    </div>
                    <div>
                      <span>
                        {financeReport.totals.current_variance < 0
                          ? "Vượt dự toán"
                          : "Còn lại"}
                      </span>
                      <strong
                        className={
                          financeReport.totals.current_variance < 0
                            ? "over-text"
                            : ""
                        }
                      >
                        {money(Math.abs(financeReport.totals.current_variance))}
                      </strong>
                    </div>
                  </section>
                  <div className="finance-toolbar">
                    <div className="segments">
                      {[
                        ["summary", "Đối chiếu"],
                        ["plan", "Dự toán"],
                        ["actual", "Thực chi"],
                        ["report", "Báo cáo"],
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
                          <div>
                            <span className="eyebrow">FINANCE V0.3.0</span>
                            <h2>Dự toán gốc · hiện tại · thực tế</h2>
                          </div>
                          <div className="finance-actions">
                            <button
                              className="btn secondary"
                              onClick={() =>
                                download(
                                  "TripFlow-Finance.csv",
                                  csv(data),
                                  "text/csv;charset=utf-8",
                                )
                              }
                            >
                              <Download size={16} />
                              CSV
                            </button>
                            <button
                              className="btn secondary"
                              onClick={() =>
                                download(
                                  "TripFlow-Finance.json",
                                  financeJson(data),
                                  "application/json;charset=utf-8",
                                )
                              }
                            >
                              <FileText size={16} />
                              JSON
                            </button>
                          </div>
                        </div>
                        <div className="comparison-bars">
                          {financeReport.baseline_snapshot_id && (
                            <div>
                              <span>Dự toán gốc</span>
                              <Bar
                                value={financeReport.totals.original_budget}
                                max={Math.max(
                                  financeReport.totals.original_budget,
                                  financeReport.totals.current_budget,
                                  financeReport.totals.net_actual,
                                )}
                              />
                              <b>{money(financeReport.totals.original_budget)}</b>
                            </div>
                          )}
                          <div>
                            <span>Hiện tại</span>
                            <Bar
                              value={financeReport.totals.current_budget}
                              max={Math.max(
                                financeReport.totals.original_budget,
                                financeReport.totals.current_budget,
                                financeReport.totals.net_actual,
                              )}
                            />
                            <b>{money(financeReport.totals.current_budget)}</b>
                          </div>
                          <div>
                            <span>Thực chi</span>
                            <Bar
                              value={financeReport.totals.net_actual}
                              max={Math.max(
                                financeReport.totals.original_budget,
                                financeReport.totals.current_budget,
                                financeReport.totals.net_actual,
                              )}
                              over={
                                financeReport.totals.net_actual >
                                financeReport.totals.current_budget
                              }
                            />
                            <b>{money(financeReport.totals.net_actual)}</b>
                          </div>
                        </div>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Nhóm</th>
                                <th>Dự toán gốc</th>
                                <th>Hiện tại</th>
                                <th>Thực chi</th>
                                <th>Chênh lệch</th>
                              </tr>
                            </thead>
                            <tbody>
                              {financeReport.categories
                                .filter(
                                  (x) =>
                                    category === "all" ||
                                    x.category === category,
                                )
                                .map((x) => (
                                  <tr key={x.category}>
                                    <td>{x.category}</td>
                                    <td>
                                      {financeReport.baseline_snapshot_id
                                        ? money(Number(x.original))
                                        : "—"}
                                    </td>
                                    <td>{money(Number(x.current))}</td>
                                    <td>{money(Number(x.actual))}</td>
                                    <td
                                      className={
                                        Number(x.variance) < 0 ? "negative" : ""
                                      }
                                    >
                                      {money(Number(x.variance))}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="hint">
                          Chênh lệch = dự toán hiện tại − thực chi ròng. Thực chi
                          ròng = tổng chi − hoàn tiền. Dự toán gốc lấy từ lần
                          chốt đầu tiên và không thay đổi theo các lần chỉnh sửa
                          sau.
                        </p>
                      </section>

                      <section className="panel">
                        <div className="section-heading">
                          <div>
                            <span className="eyebrow">RECONCILIATION</span>
                            <h2>Đối chiếu từng khoản</h2>
                          </div>
                          <span className="pill">
                            {data.budgets.length} khoản
                          </span>
                        </div>
                        {data.budgets
                          .filter(
                            (b) =>
                              category === "all" || b.category === category,
                          )
                          .map((b) => {
                            const actual = net(
                              data.expenses.filter((x) => x.budget_id === b.id),
                            );
                            const variance = Number(b.amount) - actual;
                            return (
                              <div className="reconcile" key={b.id}>
                                <div>
                                  <b>{b.title}</b>
                                  <small>
                                    {b.category}
                                    {b.item_id
                                      ? " · " +
                                        (data.items.find(
                                          (x) => x.id === b.item_id,
                                        )?.title || "Hoạt động")
                                      : ""}
                                  </small>
                                </div>
                                <div>
                                  <b>
                                    {money(actual)} / {money(Number(b.amount))}
                                  </b>
                                  <small
                                    className={
                                      variance < 0 ? "negative" : ""
                                    }
                                  >
                                    {variance < 0 ? "Vượt " : "Còn "}
                                    {money(Math.abs(variance))}
                                  </small>
                                </div>
                              </div>
                            );
                          })}
                        {!data.budgets.length && (
                          <p className="muted">Chưa có khoản dự toán để đối chiếu.</p>
                        )}
                        <p className="notice">
                          Thực chi chưa gắn dự toán:{" "}
                          <b>{money(financeReport.totals.unlinked_actual)}</b>.
                          Khoản này vẫn được tính vào thực chi toàn chuyến.
                        </p>
                      </section>

                      <section className="panel">
                        <div className="section-heading">
                          <div>
                            <span className="eyebrow">BUDGET SNAPSHOT</span>
                            <h2>Dự toán đã chốt</h2>
                          </div>
                          {owner && (
                            <button
                              className="btn secondary"
                              onClick={() => edit("snapshot")}
                            >
                              <LockKeyhole size={16} />
                              {baselineSnapshot
                                ? "Chốt bản điều chỉnh"
                                : "Chốt dự toán gốc"}
                            </button>
                          )}
                        </div>
                        {baselineSnapshot ? (
                          <>
                            <div className="snapshot-status">
                              <span className="snapshot-badge baseline">
                                Dự toán gốc · #{baselineSnapshot.snapshot_no ?? 1}
                              </span>
                              <b>{baselineSnapshot.title}</b>
                              <small>
                                {dateLabel(baselineSnapshot.created_at)} ·{" "}
                                {baselineSnapshot.item_count ??
                                  baselineSnapshot.data.length}{" "}
                                khoản
                              </small>
                            </div>
                            <div className="snapshot-values">
                              <span>
                                Ngân sách gốc
                                <b>
                                  {money(
                                    Number(
                                      baselineSnapshot.total_amount ??
                                        planned(baselineSnapshot.data),
                                    ),
                                  )}
                                </b>
                              </span>
                              <span>
                                Dự toán hiện tại
                                <b>{money(financeReport.totals.current_budget)}</b>
                              </span>
                              <span>
                                Thay đổi kế hoạch
                                <b
                                  className={
                                    financeReport.totals.current_budget >
                                    financeReport.totals.original_budget
                                      ? "negative"
                                      : ""
                                  }
                                >
                                  {money(
                                    financeReport.totals.current_budget -
                                      financeReport.totals.original_budget,
                                  )}
                                </b>
                              </span>
                              <span>
                                So với thực chi
                                <b
                                  className={
                                    (financeReport.totals.original_variance ??
                                      0) < 0
                                      ? "negative"
                                      : ""
                                  }
                                >
                                  {money(
                                    Number(
                                      financeReport.totals.original_variance ??
                                        0,
                                    ),
                                  )}
                                </b>
                              </span>
                            </div>
                            <details>
                              <summary>
                                Lịch sử {orderedSnapshots?.length || 0} lần chốt
                              </summary>
                              <div className="snapshot-history">
                                {orderedSnapshots?.map((snapshot) => (
                                  <div key={snapshot.id}>
                                    <span
                                      className={`snapshot-badge ${
                                        snapshot.snapshot_kind === "baseline" ||
                                        snapshot.id === baselineSnapshot.id
                                          ? "baseline"
                                          : ""
                                      }`}
                                    >
                                      {snapshot.snapshot_kind === "baseline" ||
                                      snapshot.id === baselineSnapshot.id
                                        ? "Gốc"
                                        : `Điều chỉnh #${snapshot.snapshot_no ?? "?"}`}
                                    </span>
                                    <span>{snapshot.title}</span>
                                    <b>
                                      {money(
                                        Number(
                                          snapshot.total_amount ??
                                            planned(snapshot.data),
                                        ),
                                      )}
                                    </b>
                                    <small>
                                      {dateLabel(snapshot.created_at)}
                                    </small>
                                  </div>
                                ))}
                              </div>
                            </details>
                            {latestSnapshot &&
                              latestSnapshot.id !== baselineSnapshot.id && (
                                <p className="hint">
                                  Bản chốt mới nhất chỉ lưu lịch sử thay đổi.
                                  Dự toán gốc vẫn là lần chốt đầu tiên.
                                </p>
                              )}
                          </>
                        ) : (
                          <div className="integrity-empty">
                            <AlertTriangle size={22} />
                            <div>
                              <b>Chưa có dự toán gốc</b>
                              <p>
                                Hãy chốt ngân sách trước chuyến đi. Lần chốt đầu
                                tiên sẽ trở thành baseline bất biến để đối chiếu
                                về sau.
                              </p>
                            </div>
                          </div>
                        )}
                      </section>
                    </>
                  ) : financeTab === "plan" ? (
                    <section className="panel">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">CURRENT BUDGET</span>
                          <h2>Dự toán hiện tại</h2>
                        </div>
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
                  ) : financeTab === "actual" ? (
                    <section className="panel">
                      <div className="section-heading">
                        <div>
                          <span className="eyebrow">ACTUAL SPENDING</span>
                          <h2>Nhật ký chi tiêu</h2>
                        </div>
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
                  ) : (
                    <>
                      <section className="panel">
                        <div className="section-heading">
                          <div>
                            <span className="eyebrow">DATA INTEGRITY</span>
                            <h2>Kiểm tra tính đúng tài chính</h2>
                          </div>
                          <span
                            className={`integrity-pill ${financeReport.integrity.status}`}
                          >
                            {financeReport.integrity.status === "ok" ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <AlertTriangle size={16} />
                            )}
                            {financeReport.integrity.status === "ok"
                              ? "Dữ liệu hợp lệ"
                              : `${financeReport.integrity.issue_count} cảnh báo`}
                          </span>
                        </div>
                        {financeReport.integrity.issues.length ? (
                          <div className="integrity-list">
                            {financeReport.integrity.issues.map((issue) => (
                              <div key={issue.code}>
                                <AlertTriangle size={18} />
                                <div>
                                  <b>{issue.message}</b>
                                  <small>
                                    Mã {issue.code} · {issue.count} trường hợp
                                  </small>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="integrity-ok">
                            <ShieldCheck size={26} />
                            <div>
                              <b>Không phát hiện sai lệch cấu trúc tài chính</b>
                              <p>
                                Refund, liên kết dự toán và snapshot đang nhất
                                quán theo dữ liệu server.
                              </p>
                            </div>
                          </div>
                        )}
                      </section>

                      <section className="report-kpis">
                        <article className="panel">
                          <span>Tổng chi trước hoàn</span>
                          <b>{money(financeReport.totals.gross_payments)}</b>
                        </article>
                        <article className="panel">
                          <span>Đã hoàn tiền</span>
                          <b>{money(financeReport.totals.refunds)}</b>
                        </article>
                        <article className="panel">
                          <span>Thực chi ròng</span>
                          <b>{money(financeReport.totals.net_actual)}</b>
                        </article>
                        <article className="panel">
                          <span>Ngoài dự toán</span>
                          <b>{money(financeReport.totals.unlinked_actual)}</b>
                        </article>
                      </section>

                      <section className="panel">
                        <div className="section-heading">
                          <h2>Báo cáo theo ngày</h2>
                          <small className="muted">
                            {financeReport.days.length} ngày có giao dịch
                          </small>
                        </div>
                        {financeReport.days.length ? (
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Ngày</th>
                                  <th>Chi</th>
                                  <th>Hoàn</th>
                                  <th>Thực chi ròng</th>
                                </tr>
                              </thead>
                              <tbody>
                                {financeReport.days.map((row) => (
                                  <tr key={row.day}>
                                    <td>{dateLabel(row.day)}</td>
                                    <td>{money(Number(row.payments))}</td>
                                    <td>{money(Number(row.refunds))}</td>
                                    <td>{money(Number(row.actual))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="muted">Chưa có giao dịch để thống kê.</p>
                        )}
                      </section>

                      <section className="panel">
                        <div className="section-heading">
                          <h2>Báo cáo theo hoạt động</h2>
                          <div className="finance-actions">
                            <button
                              className="btn secondary"
                              onClick={() =>
                                download(
                                  "TripFlow-Finance.csv",
                                  csv(data),
                                  "text/csv;charset=utf-8",
                                )
                              }
                            >
                              <Download size={16} />
                              CSV
                            </button>
                            <button
                              className="btn secondary"
                              onClick={() =>
                                download(
                                  "TripFlow-Finance.json",
                                  financeJson(data),
                                  "application/json;charset=utf-8",
                                )
                              }
                            >
                              <FileText size={16} />
                              JSON
                            </button>
                          </div>
                        </div>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Hoạt động</th>
                                <th>Dự toán</th>
                                <th>Thực chi</th>
                                <th>Chênh lệch</th>
                              </tr>
                            </thead>
                            <tbody>
                              {financeReport.activities.map((row) => (
                                <tr key={row.item_id || "unassigned"}>
                                  <td>{row.title}</td>
                                  <td>{money(Number(row.current_budget))}</td>
                                  <td>{money(Number(row.actual))}</td>
                                  <td
                                    className={
                                      Number(row.variance) < 0 ? "negative" : ""
                                    }
                                  >
                                    {money(Number(row.variance))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    </>
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
                  <section className="panel collaboration-panel">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">COLLABORATION · V0.5.0</span>
                        <h2>Chia sẻ & phân quyền</h2>
                      </div>
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
                      Tài khoản truy cập và người thực sự tham gia chuyến đi là hai danh sách độc lập.
                      Lời mời gắn đúng email, có hạn 7 ngày và không cho tạo trùng khi lời mời cũ còn hiệu lực.
                      Thay đổi Editor/Viewer hoặc thu hồi quyền có hiệu lực ngay ở server; thiết bị online nhận cập nhật qua Realtime.
                    </p>
                    <div className="collab-summary">
                      <div><ShieldCheck size={19} /><span><b>{data.role === "owner" ? "Owner" : data.role === "editor" ? "Editor" : "Viewer"}</b><small>Quyền của bạn</small></span></div>
                      <div><Users size={19} /><span><b>{data.members.length + 1}</b><small>Tài khoản có quyền</small></span></div>
                      <div><Clock size={19} /><span><b>{data.invitations.filter((x) => !x.used_at && !x.revoked_at && new Date(x.expires_at) >= new Date()).length}</b><small>Lời mời đang chờ</small></span></div>
                      <div><Compass size={19} /><span><b>{data.participants.length}</b><small>Người đi thực tế</small></span></div>
                    </div>
                    <div className="permission-matrix" aria-label="Ma trận quyền cộng tác">
                      <div className="permission-row head"><b>Quyền</b><b>Owner</b><b>Editor</b><b>Viewer</b></div>
                      {[
                        ["Xem dữ liệu", true, true, true],
                        ["Sửa lịch / chi phí / media", true, true, false],
                        ["Check-in Live Trip", true, true, false],
                        ["Mời / đổi quyền / thu hồi", true, false, false],
                        ["Xóa chuyến / chốt dự toán", true, false, false],
                      ].map(([label, o, e, v]) => (
                        <div className="permission-row" key={String(label)}>
                          <span>{String(label)}</span>
                          <span>{o ? "✓" : "—"}</span>
                          <span>{e ? "✓" : "—"}</span>
                          <span>{v ? "✓" : "—"}</span>
                        </div>
                      ))}
                    </div>
                    <div className="simple-row owner-row">
                      <div>
                        <b>Chủ chuyến đi</b>
                        <small>Owner · toàn quyền quản lý cộng tác và dữ liệu nhạy cảm</small>
                      </div>
                      <span className="pill">Owner</span>
                    </div>
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
                                · {i.role === "editor" ? "Editor" : "Viewer"}
                                · hết hạn {dateLabel(i.expires_at)}
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
                  {analytics && financeReport && (
                    <section className="panel analytics-panel" id="trip-analytics">
                      <div className="section-heading analytics-heading">
                        <div>
                          <span className="eyebrow">TRIP ANALYTICS & POST-TRIP REPORT · V0.8.0</span>
                          <h2>Tổng kết chuyến đi</h2>
                          <p className="muted">
                            Báo cáo tổng hợp lịch trình, tài chính và media từ dữ liệu hiện tại của chuyến đi.
                          </p>
                        </div>
                        <span className={`status-chip ${analytics.readiness === "ready" ? "active" : ""}`}>
                          {analytics.report_state === "post_trip"
                            ? analytics.readiness === "ready"
                              ? "Báo cáo hoàn chỉnh"
                              : "Sau chuyến · cần rà soát"
                            : "Báo cáo tạm thời"}
                        </span>
                      </div>

                      <div className="analytics-actions">
                        <button
                          className="btn secondary"
                          onClick={() =>
                            download(
                              "TripFlow-PostTrip.csv",
                              postTripCsv(data),
                              "text/csv;charset=utf-8",
                            )
                          }
                        >
                          <Download size={16} /> CSV
                        </button>
                        <button
                          className="btn secondary"
                          onClick={() =>
                            download(
                              "TripFlow-PostTrip.json",
                              postTripJson(data),
                              "application/json;charset=utf-8",
                            )
                          }
                        >
                          <FileText size={16} /> JSON
                        </button>
                        <button
                          className="btn primary"
                          onClick={() =>
                            openPrintableReport(
                              "TripFlow-PostTrip.html",
                              postTripHtml(data),
                            )
                          }
                        >
                          <FileText size={16} /> Bản in
                        </button>
                      </div>

                      <div className="analytics-kpis">
                        <article>
                          <span>Hoàn thành lịch trình</span>
                          <b>{analytics.itinerary.completion_rate}%</b>
                          <small>{analytics.itinerary.done}/{analytics.itinerary.total} hoạt động</small>
                          <Bar value={analytics.itinerary.done} max={analytics.itinerary.total} />
                        </article>
                        <article>
                          <span>Thực chi ròng</span>
                          <b>{money(analytics.finance.net_actual)}</b>
                          <small>
                            {analytics.finance.budget_usage_percent == null
                              ? "Chưa có dự toán"
                              : `${analytics.finance.budget_usage_percent}% dự toán hiện tại`}
                          </small>
                          <Bar
                            value={analytics.finance.net_actual}
                            max={Math.max(analytics.finance.current_budget, analytics.finance.net_actual, 1)}
                            over={analytics.finance.current_variance < 0}
                          />
                        </article>
                        <article>
                          <span>Chi phí / người</span>
                          <b>{money(analytics.finance.per_person)}</b>
                          <small>{trip.people} người · {analytics.trip_days} ngày</small>
                        </article>
                        <article>
                          <span>Media & tài liệu</span>
                          <b>{analytics.media.total}</b>
                          <small>{analytics.media.linked_to_activity} mục gắn hoạt động</small>
                        </article>
                      </div>

                      <div className="analytics-two-col">
                        <div className="analytics-summary-card">
                          <div className="section-heading">
                            <h3>Điểm nổi bật</h3>
                            <CheckCircle2 size={20} />
                          </div>
                          <ul className="analytics-list good">
                            {analytics.highlights.map((text) => (
                              <li key={text}>{text}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="analytics-summary-card">
                          <div className="section-heading">
                            <h3>Cần rà soát</h3>
                            {analytics.warnings.length ? (
                              <AlertTriangle size={20} />
                            ) : (
                              <ShieldCheck size={20} />
                            )}
                          </div>
                          {analytics.warnings.length ? (
                            <ul className="analytics-list warning">
                              {analytics.warnings.map((text) => (
                                <li key={text}>{text}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="analytics-ready">
                              Dữ liệu đã sẵn sàng để lưu trữ báo cáo sau chuyến đi.
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="analytics-two-col analytics-detail-grid">
                        <div>
                          <div className="section-heading">
                            <h3>Lịch trình</h3>
                            <span className="pill">{analytics.itinerary.processed_rate}% đã xử lý</span>
                          </div>
                          <div className="analytics-metrics">
                            <div><span>Hoàn thành</span><b>{analytics.itinerary.done}</b></div>
                            <div><span>Bỏ qua</span><b>{analytics.itinerary.skipped}</b></div>
                            <div><span>Check-in</span><b>{analytics.itinerary.checked_in}</b></div>
                            <div><span>Check-in trễ</span><b>{analytics.itinerary.late_checkins}</b></div>
                            <div><span>Trễ trung bình</span><b>{minutesText(analytics.itinerary.average_checkin_delay_minutes) || "0 phút"}</b></div>
                            <div><span>Trễ nhiều nhất</span><b>{minutesText(analytics.itinerary.max_checkin_delay_minutes) || "0 phút"}</b></div>
                          </div>
                        </div>
                        <div>
                          <div className="section-heading">
                            <h3>Tài chính</h3>
                            <span className={`pill ${analytics.finance.current_variance < 0 ? "negative" : ""}`}>
                              {analytics.finance.current_variance < 0 ? "Vượt dự toán" : "Trong dự toán"}
                            </span>
                          </div>
                          <div className="analytics-metrics">
                            <div><span>Dự toán hiện tại</span><b>{money(analytics.finance.current_budget)}</b></div>
                            <div><span>Chênh lệch</span><b>{money(analytics.finance.current_variance)}</b></div>
                            <div><span>Ngoài dự toán</span><b>{money(analytics.finance.unlinked_actual)}</b></div>
                            <div><span>Giao dịch chi</span><b>{analytics.finance.expense_count}</b></div>
                            <div><span>Hoàn tiền</span><b>{analytics.finance.refund_count}</b></div>
                            <div><span>Nhóm chi nhiều nhất</span><b>{analytics.finance.top_category || "—"}</b></div>
                          </div>
                        </div>
                      </div>

                      <div className="analytics-section">
                        <div className="section-heading">
                          <h3>Chi phí theo nhóm</h3>
                          <small className="muted">
                            {analytics.finance.over_budget_categories} nhóm vượt dự toán
                          </small>
                        </div>
                        <div className="analytics-category-bars">
                          {financeReport.categories
                            .filter((row) => Number(row.current) || Number(row.actual))
                            .map((row) => {
                              const max = Math.max(Number(row.current), Number(row.actual), 1);
                              return (
                                <div key={row.category}>
                                  <div className="progress-label">
                                    <span>{row.category}</span>
                                    <b>{money(Number(row.actual))}</b>
                                  </div>
                                  <Bar
                                    value={Number(row.actual)}
                                    max={max}
                                    over={Number(row.actual) > Number(row.current)}
                                  />
                                  <small className="muted">
                                    Dự toán {money(Number(row.current))} · Chênh lệch {money(Number(row.variance))}
                                  </small>
                                </div>
                              );
                            })}
                          {!financeReport.categories.some(
                            (row) => Number(row.current) || Number(row.actual),
                          ) && <p className="muted">Chưa có dữ liệu chi phí để phân tích.</p>}
                        </div>
                      </div>

                      <div className="analytics-section">
                        <div className="section-heading">
                          <h3>Tổng kết theo ngày</h3>
                          <small className="muted">{analytics.days.length} ngày có dữ liệu</small>
                        </div>
                        {analytics.days.length ? (
                          <div className="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>Ngày</th>
                                  <th>Hoạt động</th>
                                  <th>Hoàn thành</th>
                                  <th>Bỏ qua</th>
                                  <th>Thực chi</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analytics.days.map((row) => (
                                  <tr key={row.day}>
                                    <td>{dateLabel(row.day)}</td>
                                    <td>{row.item_count}</td>
                                    <td>{row.done}</td>
                                    <td>{row.skipped}</td>
                                    <td>{money(row.actual)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="muted">Chưa có lịch trình hoặc chi tiêu để tổng hợp.</p>
                        )}
                      </div>
                      <p className="hint analytics-footnote">
                        Báo cáo V0.8.0 được tính lại từ dữ liệu nguồn mỗi lần mở hoặc export, không lưu thêm một “tổng” độc lập nên tránh lệch số liệu khi lịch trình hay chi phí được chỉnh sửa.
                      </p>
                    </section>
                  )}
                  <ReleaseReadiness online={online} />
                  <section className="panel pwa-panel">
                    <div className="section-heading">
                      <div>
                        <span className="eyebrow">MOBILE UX & PWA · V0.6.0</span>
                        <h2>Ứng dụng trên thiết bị</h2>
                        <p className="muted">
                          Safe-area iPhone/Android, form mobile fullscreen, cập nhật service worker có kiểm soát và cache offline theo tài khoản.
                        </p>
                      </div>
                      <span className={`status-chip ${pwaState.standalone ? "active" : ""}`}>
                        {pwaState.standalone ? "Đã cài" : "Trình duyệt"}
                      </span>
                    </div>
                    <div className="pwa-summary">
                      <div>
                        <Compass size={19} />
                        <span><b>{pwaState.standalone ? "Standalone" : "Web"}</b><small>Chế độ hiển thị</small></span>
                      </div>
                      <div>
                        <RefreshCw size={19} />
                        <span><b>{pwaState.updateReady ? "Có bản mới" : pwaState.serviceWorkerReady ? "Sẵn sàng" : "Đang kiểm tra"}</b><small>Service worker</small></span>
                      </div>
                      <div>
                        <ShieldCheck size={19} />
                        <span><b>{pwaState.storagePersisted ? "Được bảo vệ" : "Tiêu chuẩn"}</b><small>Cache offline</small></span>
                      </div>
                    </div>
                    <div className="actions">
                      {!pwaState.standalone && (
                        <button className="btn secondary" onClick={() => void installPwa()}>
                          <Download size={17} />
                          {pwaState.installable ? "Cài TripFlow" : pwaState.ios ? "Cách cài trên iPhone" : "Cài ứng dụng"}
                        </button>
                      )}
                      {pwaState.updateReady && (
                        <button className="btn primary" onClick={applyPwaUpdate}>
                          <RefreshCw size={17} />
                          Cập nhật TripFlow
                        </button>
                      )}
                      {!pwaState.storagePersisted && (
                        <button className="btn secondary" onClick={() => void protectOfflineStorage()}>
                          <ShieldCheck size={17} />
                          Bảo vệ cache offline
                        </button>
                      )}
                    </div>
                    {pwaState.ios && !pwaState.standalone && (
                      <p className="hint pwa-ios-hint">
                        Safari iPhone/iPad: bấm Chia sẻ → <b>Thêm vào Màn hình chính</b>. iOS không cung cấp nút cài tự động như Chrome Android.
                      </p>
                    )}
                  </section>
                  {owner && recoveryPanel(true)}
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
                      Chế độ offline hỗ trợ ghi chi tiêu mới, cập nhật/check-in lịch trình, người tham gia và media. Phân quyền, xóa chuyến, chốt dự toán và quản trị yêu cầu online.
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
