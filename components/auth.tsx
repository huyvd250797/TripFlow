"use client";
import { useEffect, useState } from "react";
import {
  Compass,
  ArrowRight,
  LockKeyhole,
  Map,
  Wallet,
  Mail,
} from "lucide-react";
import { browserClient, configured } from "@/lib/supabase/client";
export function Auth({
  recovery = false,
  onDone,
  initialError = "",
}: {
  recovery?: boolean;
  onDone: () => void;
  initialError?: string;
}) {
  const [mode, setMode] = useState(recovery ? "change" : "login"),
    [error, setError] = useState(initialError),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (initialError) setError(initialError);
    if (new URLSearchParams(location.search).has("auth_error"))
      setError(
        "Liên kết xác thực đã hết hạn hoặc không hợp lệ. Hãy yêu cầu lại.",
      );
  }, [initialError]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const f = new FormData(e.currentTarget),
      email = String(f.get("email") || "").trim(),
      password = String(f.get("password") || "");
    try {
      const s = browserClient();
      if (mode === "login") {
        const { error } = await s.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const gate = await fetch("/api/tripflow", { cache: "no-store" });
        if (!gate.ok) {
          const info = await gate.json().catch(() => ({}));
          await s.auth.signOut();
          throw new Error(
            info.error ||
              "Tài khoản chưa được phép truy cập TripFlow. Liên hệ quản trị Master.",
          );
        }
        onDone();
      } else if (mode === "signup") {
        const { data, error } = await s.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + "/auth/callback" },
        });
        if (error) throw error;
        if (data.session) onDone();
        else
          setMessage(
            "Đã tiếp nhận đăng ký. Kiểm tra email để xác nhận tài khoản trước khi đăng nhập.",
          );
      } else if (mode === "reset") {
        const { error } = await s.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/auth/callback?recovery=1",
        });
        if (error) throw error;
        setMessage(
          "Nếu email đã đăng ký, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.",
        );
      } else {
        const { error } = await s.auth.updateUser({ password });
        if (error) throw error;
        history.replaceState({}, "", "/");
        onDone();
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setError(
        m === "Invalid login credentials"
          ? "Email hoặc mật khẩu không đúng."
          : m === "Email not confirmed"
            ? "Vui lòng xác nhận email trước khi đăng nhập."
            : m || "Không thể thực hiện. Vui lòng thử lại.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <a className="brand" href="/">
          <Compass />
          <b>TripFlow</b>
        </a>
        <span className="eyebrow">KẾ HOẠCH CHO NHỮNG NGÀY ĐÁNG NHỚ</span>
        <h1>
          Mỗi chuyến đi.
          <br />
          Một không gian riêng.
        </h1>
        <p>
          Lịch trình rõ ràng, chi phí trong tầm tay và những kỷ niệm được giữ
          lại cùng nhau.
        </p>
        <div className="auth-features">
          <span>
            <Map /> Theo dõi từng chặng
          </span>
          <span>
            <Wallet /> Chủ động ngân sách
          </span>
          <span>
            <LockKeyhole /> Dữ liệu riêng của bạn
          </span>
        </div>
        <small>TRIPFLOW · LIVE TRIP & REALTIME · 0.4.0</small>
      </aside>
      <main className="auth-main">
        <div className="auth-card">
          <div className="mobile-auth-brand">
            <Compass /> TripFlow
          </div>
          {!configured() ? (
            <>
              <span className="eyebrow">THIẾT LẬP LẦN ĐẦU</span>
              <h2>Kết nối không gian của bạn</h2>
              <p>
                Ứng dụng đã sẵn sàng. Chủ ứng dụng cần hoàn tất cấu hình
                database để bắt đầu.
              </p>
              <ol>
                <li>
                  Tạo dự án Supabase và chạy SQL trong thư mục{" "}
                  <code>supabase/migrations</code>.
                </li>
                <li>
                  Thiết lập hai biến <code>NEXT_PUBLIC_SUPABASE_URL</code> và{" "}
                  <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
                </li>
                <li>Triển khai lại trên Vercel, sau đó tạo tài khoản.</li>
              </ol>
              <p className="hint">
                Hướng dẫn từng bước nằm trong README.md của bộ mã nguồn.
              </p>
            </>
          ) : (
            <>
              <span className="eyebrow">CHÀO MỪNG ĐẾN TRIPFLOW</span>
              <h2>
                {mode === "login"
                  ? "Chuyến đi bắt đầu từ đây"
                  : mode === "signup"
                    ? "Tạo tài khoản của bạn"
                    : mode === "reset"
                      ? "Đặt lại mật khẩu"
                      : "Chọn mật khẩu mới"}
              </h2>
              <p className="muted">
                {mode === "login"
                  ? "Đăng nhập để mở kế hoạch và tiếp tục hành trình."
                  : mode === "signup"
                    ? "Lưu kế hoạch và mở trên các thiết bị của bạn."
                    : "Sử dụng mật khẩu ít nhất 8 ký tự."}
              </p>
              <form onSubmit={submit}>
                {mode !== "change" && (
                  <label className="field">
                    <span>Email</span>
                    <input
                      type="email"
                      name="email"
                      required
                      autoComplete="email"
                      maxLength={254}
                      placeholder="ban@example.com"
                    />
                  </label>
                )}
                {mode !== "reset" && (
                  <label className="field">
                    <span>Mật khẩu</span>
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={mode === "login" ? 1 : 8}
                      maxLength={128}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                    />
                  </label>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                {message && (
                  <p className="notice" role="status">
                    <Mail size={18} />
                    {message}
                  </p>
                )}
                <button className="btn primary wide" disabled={busy}>
                  {busy
                    ? "Đang xử lý…"
                    : mode === "login"
                      ? "Đăng nhập"
                      : mode === "signup"
                        ? "Tạo tài khoản"
                        : mode === "reset"
                          ? "Gửi email khôi phục"
                          : "Lưu mật khẩu mới"}
                  <ArrowRight size={18} />
                </button>
              </form>
              <div className="auth-links">
                {mode === "login" ? (
                  <>
                    <button
                      onClick={() => {
                        setMode("signup");
                        setError("");
                        setMessage("");
                      }}
                    >
                      Chưa có tài khoản? Đăng ký
                    </button>
                    <button
                      onClick={() => {
                        setMode("reset");
                        setError("");
                        setMessage("");
                      }}
                    >
                      Quên mật khẩu?
                    </button>
                  </>
                ) : (
                  mode !== "change" && (
                    <button
                      onClick={() => {
                        setMode("login");
                        setError("");
                        setMessage("");
                      }}
                    >
                      Quay lại đăng nhập
                    </button>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
