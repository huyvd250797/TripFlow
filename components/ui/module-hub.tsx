"use client";
import {
  Children,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Users,
  ShieldCheck,
  FileText,
  Database,
  Palette,
  Ticket,
  Map,
  Settings,
} from "lucide-react";
import { heading, sections, useMobile } from "./mobile-module";
import { Dialog } from "./dialog";
export function ModuleHub({
  children,
  onExit,
}: {
  children: ReactNode;
  onExit: () => void;
}) {
  const mobile = useMobile();
  const [picker, setPicker] = useState(true),
    [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const show = () => {
      setPicker(true);
    };
    window.addEventListener("tripflow:open-modules", show);
    return () => window.removeEventListener("tripflow:open-modules", show);
  }, []);
  const entries = Children.toArray(children).flatMap((node) => {
    if (!isValidElement<{ children?: ReactNode; className?: string }>(node))
      return [];
    if (node.props.className === "more-hub-intro") return [];
    const isGroup = node.props.className === "module-block";
    return (
      isGroup
        ? sections(Children.toArray(node.props.children).slice(1))
        : [node]
    ).map((content) => ({
      content,
      title: heading(content) || "Phân tích & tổng kết",
    }));
  });
  if (!mobile) return <>{children}</>;
  const grid = (
    <div className="module-grid">
      {entries.map(({ title }, i) => {
        const Icon = /đặt chỗ/i.test(title)
          ? Ticket
          : /giao diện/i.test(title)
            ? Palette
            : /người/i.test(title)
              ? Users
              : /quyền/i.test(title)
                ? ShieldCheck
                : /dữ liệu|khôi phục/i.test(title)
                  ? Database
                  : /báo cáo|phân tích/i.test(title)
                    ? FileText
                    : /chuyến|kế hoạch/i.test(title)
                      ? Map
                      : Settings;
        return (
          <button
            key={i}
            className="module-tile"
            onClick={() => {
              setActive(i);
              setPicker(false);
              window.scrollTo({ top: 0 });
            }}
          >
            <div className="module-tile-title">
              <Icon size={21} />
              <strong>{title}</strong>
            </div>
            <small>
              {/giao diện/i.test(title)
                ? "Màu sắc & chế độ hiển thị"
                : /đặt chỗ/i.test(title)
                  ? "Vé, lưu trú & giấy tờ chuyến đi"
                  : /người/i.test(title)
                    ? "Danh sách người cùng đi"
                    : /quyền/i.test(title)
                      ? "Mời thành viên & phân quyền"
                      : /thông tin/i.test(title)
                        ? "Điểm đến, ngày đi & kế hoạch"
                        : /xóa/i.test(title)
                          ? "Quản lý xóa chuyến đi"
                          : /mẫu/i.test(title)
                            ? "Lưu và dùng lại kế hoạch"
                            : /phân tích/i.test(title)
                              ? "Chi phí & tổng kết hành trình"
                              : /dữ liệu/i.test(title)
                                ? "Đồng bộ, offline & tài khoản"
                                : /backup|khôi phục/i.test(title)
                                  ? "Sao lưu & khôi phục dữ liệu"
                                  : /thiết bị/i.test(title)
                                    ? "Cài app & sử dụng trên điện thoại"
                                    : /production/i.test(title)
                                      ? "Kiểm tra trạng thái hệ thống"
                                      : /roadmap/i.test(title)
                                        ? "Tính năng & phiên bản tiếp theo"
                                        : "Tùy chỉnh & quản lý chuyến đi"}
            </small>
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="module-hub">
      {active !== null && (
        <>
          <button
            className="text-btn module-back"
            onClick={() => {
              setPicker(true);
            }}
          >
            <ArrowLeft size={18} />
            Tất cả module
          </button>
          <div className="module-management" key={active}>
            {entries[active]?.content}
          </div>
        </>
      )}
      {picker && (
        <Dialog
          open
          title="Thêm chức năng"
          className="dialog-sheet module-picker"
          onClose={() => {
            setPicker(false);
            if (active === null) onExit();
          }}
        >
          <div className="dialog-body">{grid}</div>
        </Dialog>
      )}
    </div>
  );
}
