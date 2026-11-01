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
  Compass,
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
export function ModuleHub({ children }: { children: ReactNode }) {
  const mobile = useMobile();
  const [picker, setPicker] = useState(true),
    [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    const show = () => {
      setActive(null);
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
            <Icon size={23} />
            <strong>{title}</strong>
            <small>Mở quản lý</small>
          </button>
        );
      })}
    </div>
  );
  return (
    <div className="module-hub">
      {active === null ? (
        <>
          <h2>Chức năng chuyến đi</h2>
          {grid}
        </>
      ) : (
        <>
          <button
            className="text-btn module-back"
            onClick={() => {
              setActive(null);
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
          onClose={() => setPicker(false)}
        >
          <div className="dialog-body">{grid}</div>
        </Dialog>
      )}
    </div>
  );
}
