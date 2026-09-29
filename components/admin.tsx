"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  Users,
  Compass,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Clock,
  Wallet,
  Route,
  Images,
} from "lucide-react";
import { dateLabel, money } from "@/lib/domain";

type AdminUser = {
  id: string;
  email: string;
  role: "master" | "user";
  status: "active" | "deactivated";
  created_at: string;
  last_sign_in_at: string | null;
  deactivated_at: string | null;
  trip_count: number;
  activity_count: number;
};
type AdminOverview = {
  users: AdminUser[];
  stats: { total: number; active: number; deactivated: number; trips: number };
};
type AdminOps = {
  active_trips: number;
  deleted_trips: number;
  backups: number;
  backups_past_retention: number;
  tombstones: number;
  eligible_for_purge: number;
  audit_logs: number;
  mutation_receipts: number;
  last_backup_at: string | null;
  policy: { recovery_days: number; backup_days: number; receipt_days: number; audit_days: number };
};
type UserDetail = {
  user: AdminUser;
  trips: Array<{
    id: string;
    name: string;
    destination: string;
    start_date: string;
    end_date: string | null;
    status: string;
    owner_id: string;
    access_role: string;
    items: number;
    budgets: number;
    expenses: number;
    media: number;
  }>;
  activity: Array<{
    id: number;
    trip_id: string;
    entity: string;
    action: string;
    created_at: string;
  }>;
};
type TripDetail = {
  trip: Record<string, unknown>;
  items: Record<string, unknown>[];
  budgets: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  media: Record<string, unknown>[];
  participants: Record<string, unknown>[];
  members: Record<string, unknown>[];
  snapshots: Record<string, unknown>[];
  audits: Record<string, unknown>[];
};

async function request<T>(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Không tải được dữ liệu quản trị.");
  return body as T;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function MasterAdmin({
  currentUserId,
  notify,
}: {
  currentUserId: string;
  notify: (message: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [ops, setOps] = useState<AdminOps | null>(null);
  const [user, setUser] = useState<UserDetail | null>(null);
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadOverview(value = search) {
    setLoading(true);
    setError("");
    try {
      const data = await request<AdminOverview>(
        "/api/admin?mode=overview&search=" + encodeURIComponent(value.trim()),
      );
      setOverview(data);
      try {
        setOps(await request<AdminOps>("/api/admin?mode=ops"));
      } catch {
        setOps(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được quản trị.");
    } finally {
      setLoading(false);
    }
  }

  async function openUser(id: string) {
    setLoading(true);
    setError("");
    try {
      setUser(await request<UserDetail>("/api/admin?mode=user&id=" + id));
      setTrip(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được user.");
    } finally {
      setLoading(false);
    }
  }

  async function openTrip(id: string) {
    setLoading(true);
    setError("");
    try {
      setTrip(await request<TripDetail>("/api/admin?mode=trip&id=" + id));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được chuyến đi.");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(target: AdminUser, status: "active" | "deactivated") {
    const action = status === "deactivated" ? "hủy kích hoạt" : "kích hoạt lại";
    if (!window.confirm(`Xác nhận ${action} tài khoản ${target.email}?`)) return;
    setLoading(true);
    setError("");
    try {
      await request("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_status", userId: target.id, status }),
      });
      notify(status === "deactivated" ? "Đã hủy kích hoạt tài khoản." : "Đã kích hoạt lại tài khoản.");
      await loadOverview();
      if (user?.user.id === target.id) await openUser(target.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không cập nhật được tài khoản.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOverview("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tripName = String(trip?.trip.name || "Chi tiết chuyến đi");
  const activeUsers = useMemo(() => overview?.users || [], [overview]);

  if (trip) {
    return (
      <div className="admin-stack">
        <button className="btn secondary admin-back" onClick={() => setTrip(null)}>
          <ArrowLeft size={17} /> Quay lại user
        </button>
        <section className="panel admin-hero">
          <div>
            <span className="eyebrow">MASTER · READ ONLY VIEW</span>
            <h1>{tripName}</h1>
            <p className="muted">
              {String(trip.trip.destination || "")} · {dateLabel(String(trip.trip.start_date || ""))} – {dateLabel(trip.trip.end_date == null ? null : String(trip.trip.end_date))}
            </p>
          </div>
          <ShieldCheck size={34} />
        </section>
        <div className="admin-metrics compact">
          <div><Route /><b>{trip.items.length}</b><span>Hoạt động</span></div>
          <div><Wallet /><b>{trip.expenses.length}</b><span>Thực chi</span></div>
          <div><Images /><b>{trip.media.length}</b><span>Media</span></div>
          <div><Users /><b>{trip.members.length + 1}</b><span>Tài khoản</span></div>
        </div>
        <AdminTripData data={trip} />
      </div>
    );
  }

  if (user) {
    const selected = user.user;
    return (
      <div className="admin-stack">
        <button className="btn secondary admin-back" onClick={() => setUser(null)}>
          <ArrowLeft size={17} /> Danh sách user
        </button>
        {error && <div className="error">{error}</div>}
        <section className="panel admin-user-head">
          <div>
            <span className="eyebrow">CHI TIẾT TÀI KHOẢN</span>
            <h2>{selected.email || selected.id}</h2>
            <p className="muted">{selected.id}</p>
            <div className="admin-tags">
              <span className={`status-chip ${selected.status}`}>{selected.status === "active" ? "Đang hoạt động" : "Đã hủy kích hoạt"}</span>
              <span className="status-chip">{selected.role === "master" ? "Master" : "User"}</span>
            </div>
          </div>
          {selected.role !== "master" && selected.id !== currentUserId && (
            <button
              className={`btn ${selected.status === "active" ? "danger-btn" : "primary"}`}
              disabled={loading}
              onClick={() => void setStatus(selected, selected.status === "active" ? "deactivated" : "active")}
            >
              {selected.status === "active" ? <UserRoundX size={17} /> : <UserRoundCheck size={17} />}
              {selected.status === "active" ? "Hủy kích hoạt" : "Kích hoạt lại"}
            </button>
          )}
        </section>
        <section className="panel">
          <div className="section-heading"><h2>Chuyến đi user có quyền truy cập</h2><span>{user.trips.length}</span></div>
          <div className="admin-trip-list">
            {user.trips.map((t) => (
              <button key={t.id} onClick={() => void openTrip(t.id)}>
                <span className="trip-icon"><Compass size={20} /></span>
                <span className="admin-trip-copy">
                  <b>{t.name}</b>
                  <small>{t.destination || "Chưa nhập điểm đến"} · {dateLabel(t.start_date)} – {dateLabel(t.end_date)}</small>
                  <small>{t.access_role === "owner" ? "Chủ chuyến" : t.access_role} · {t.items} hoạt động · {t.expenses} giao dịch</small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
            {!user.trips.length && <p className="muted">User chưa có chuyến đi nào.</p>}
          </div>
        </section>
        <section className="panel">
          <h2>Hoạt động do user thực hiện</h2>
          <p className="hint">Hiển thị tối đa 100 audit gần nhất để Master kiểm tra thao tác.</p>
          <div className="admin-audit-list">
            {user.activity.map((a) => (
              <div key={a.id}><Clock size={15} /><span><b>{a.entity}</b> · {a.action}<small>{fmtDate(a.created_at)}</small></span></div>
            ))}
            {!user.activity.length && <p className="muted">Chưa có lịch sử thao tác.</p>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-stack">
      <section className="panel admin-hero">
        <div>
          <span className="eyebrow">MASTER ADMINISTRATION</span>
          <h1>Quản trị TripFlow</h1>
          <p className="muted">Quản lý tài khoản, trạng thái truy cập và kiểm tra dữ liệu chuyến đi trên toàn hệ thống.</p>
        </div>
        <ShieldCheck size={38} />
      </section>
      {overview && (
        <div className="admin-metrics">
          <div><Users /><b>{overview.stats.total}</b><span>Tổng user</span></div>
          <div><UserRoundCheck /><b>{overview.stats.active}</b><span>Đang hoạt động</span></div>
          <div><UserRoundX /><b>{overview.stats.deactivated}</b><span>Đã khóa</span></div>
          <div><Compass /><b>{overview.stats.trips}</b><span>Chuyến đi</span></div>
        </div>
      )}
      {ops && (
        <section className="panel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">V0.7.0 · OPERATIONS HEALTH</span>
              <h2>Backup, Recovery & vận hành</h2>
            </div>
            <span className="status-chip active">Không auto purge</span>
          </div>
          <div className="admin-metrics compact">
            <div><ShieldCheck /><b>{ops.backups}</b><span>Backup</span></div>
            <div><RefreshCw /><b>{ops.tombstones}</b><span>Tombstone</span></div>
            <div><Clock /><b>{ops.audit_logs}</b><span>Audit log</span></div>
            <div><Compass /><b>{ops.deleted_trips}</b><span>Trip đã xóa</span></div>
          </div>
          <p className="hint">Recovery {ops.policy.recovery_days} ngày · backup {ops.policy.backup_days} ngày · receipt {ops.policy.receipt_days} ngày · audit {ops.policy.audit_days} ngày. Có {ops.eligible_for_purge} tombstone và {ops.backups_past_retention} backup đã qua mốc retention; V0.7 chỉ giám sát, không tự xóa.</p>
          <p className="hint">Backup gần nhất: {fmtDate(ops.last_backup_at)} · Mutation receipts: {ops.mutation_receipts}</p>
        </section>
      )}
      <section className="panel">
        <div className="admin-toolbar">
          <form onSubmit={(e) => { e.preventDefault(); void loadOverview(search); }}>
            <Search size={18} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm email hoặc User ID" />
            <button className="btn secondary">Tìm</button>
          </form>
          <button className="icon-btn" aria-label="Tải lại" onClick={() => void loadOverview()}><RefreshCw size={18} /></button>
        </div>
        {error && <div className="error">{error}</div>}
        {loading && !overview ? <p className="muted">Đang tải dữ liệu quản trị…</p> : (
          <div className="admin-user-table">
            {activeUsers.map((u) => (
              <div className="admin-user-row" key={u.id}>
                <button className="admin-user-main" onClick={() => void openUser(u.id)}>
                  <span className={`admin-avatar ${u.status}`}>{(u.email || "U").slice(0, 1).toUpperCase()}</span>
                  <span>
                    <b>{u.email || "Chưa có email"}</b>
                    <small>{u.role === "master" ? "Master" : "User"} · {u.trip_count} chuyến · {u.activity_count} thao tác</small>
                    <small>Đăng nhập gần nhất: {fmtDate(u.last_sign_in_at)}</small>
                  </span>
                </button>
                <div className="admin-user-actions">
                  <span className={`status-chip ${u.status}`}>{u.status === "active" ? "Active" : "Deactivated"}</span>
                  {u.role !== "master" && u.id !== currentUserId && (
                    <button
                      className={`btn small ${u.status === "active" ? "danger-btn" : "secondary"}`}
                      disabled={loading}
                      onClick={() => void setStatus(u, u.status === "active" ? "deactivated" : "active")}
                    >
                      {u.status === "active" ? "Hủy kích hoạt" : "Kích hoạt"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!activeUsers.length && <p className="muted">Không tìm thấy user phù hợp.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

function AdminTripData({ data }: { data: TripDetail }) {
  const sections: Array<{ key: keyof TripDetail; label: string }> = [
    { key: "items", label: "Lịch trình" },
    { key: "budgets", label: "Dự toán" },
    { key: "expenses", label: "Thực chi" },
    { key: "media", label: "Media" },
    { key: "participants", label: "Người tham gia" },
    { key: "members", label: "Thành viên" },
    { key: "snapshots", label: "Budget snapshots" },
    { key: "audits", label: "Audit log" },
  ];
  return (
    <div className="admin-data-sections">
      {sections.map(({ key, label }) => {
        const rows = data[key] as Record<string, unknown>[];
        return (
          <details className="panel admin-data" key={key} open={key === "items" || key === "expenses"}>
            <summary><b>{label}</b><span>{rows.length}</span></summary>
            {!rows.length ? <p className="muted">Không có dữ liệu.</p> : (
              <div className="admin-data-list">
                {rows.map((row, index) => (
                  <div key={String(row.id || index)}>
                    <b>{String(row.title || row.name || row.email || row.entity || `#${index + 1}`)}</b>
                    {key === "expenses" && <span>{money(Number(row.amount || 0))}</span>}
                    <small>
                      {row.spent_on ? dateLabel(String(row.spent_on)) : row.created_at ? fmtDate(String(row.created_at)) : ""}
                      {row.status ? ` · ${String(row.status)}` : ""}
                      {row.deleted_at ? " · Đã xóa mềm" : ""}
                    </small>
                    <details className="admin-json"><summary>Chi tiết dữ liệu</summary><pre>{JSON.stringify(row, null, 2)}</pre></details>
                  </div>
                ))}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}
