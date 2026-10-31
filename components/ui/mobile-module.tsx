"use client";
import {
  Children,
  isValidElement,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Dialog } from "./dialog";
const subscribe = (notify: () => void) => {
  const media = matchMedia("(max-width: 760px)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
export function useMobile() {
  return useSyncExternalStore(
    subscribe,
    () => matchMedia("(max-width: 760px)").matches,
    () => false,
  );
}
function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (isValidElement<{ children?: ReactNode }>(node))
    return text(node.props.children);
  return Children.toArray(node)
    .map((child) =>
      typeof child === "string"
        ? child
        : isValidElement<{ children?: ReactNode }>(child)
          ? text(child.props.children)
          : "",
    )
    .join(" ");
}
function heading(node: ReactNode): string {
  for (const child of Children.toArray(node)) {
    if (
      !isValidElement<{ children?: ReactNode; "data-module-title"?: string }>(
        child,
      )
    )
      continue;
    if (child.props["data-module-title"])
      return child.props["data-module-title"]!;
    if (child.type === "h2" || child.type === "h3")
      return text(child.props.children);
    const found = heading(child.props.children);
    if (found) return found;
  }
  return "";
}
function sections(node: ReactNode): ReactNode[] {
  return Children.toArray(node).flatMap((child) =>
    isValidElement<{ className?: string; children?: ReactNode }>(child) &&
    (child.props.className === "module-block-content" ||
      child.props.className === "settings-grid")
      ? sections(child.props.children)
      : [child],
  );
}
export function MoreModule({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  const mobile = useMobile();
  const [open, setOpen] = useState(false),
    [selected, setSelected] = useState<number | null>(null);
  const nodes = Children.toArray(children),
    summary = nodes[0],
    content = sections(nodes.slice(1));
  const title =
    id === "module-trip"
      ? "Chuyến đi & cộng tác"
      : id === "module-reporting"
        ? "Báo cáo & tổng kết"
        : "Ứng dụng & dữ liệu";
  const titles = content.map(
    (node, i) =>
      heading(node) ||
      (id === "module-reporting"
        ? "Phân tích & tổng kết"
        : id === "module-system"
          ? "Roadmap ứng dụng"
          : `Tiện ích ${i + 1}`),
  );
  return (
    <>
      <details
        id={id}
        className={className}
        onClick={(event) => {
          if (
            mobile &&
            (event.target as HTMLElement).closest("summary")?.parentElement ===
              event.currentTarget
          ) {
            event.preventDefault();
            setSelected(null);
            setOpen(true);
          }
        }}
      >
        {summary}
        {!mobile && nodes.slice(1)}
      </details>
      {mobile && open && (
        <Dialog
          open
          title={selected === null ? title : titles[selected]}
          className="dialog-sheet more-module-sheet"
          onClose={() => setOpen(false)}
        >
          <div className="dialog-body">
            {selected === null ? (
              <div className="more-section-menu">
                {content.map((_, i) => (
                  <button key={i} onClick={() => setSelected(i)}>
                    <span>{titles[i]}</span>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            ) : (
              <>
                <button
                  className="text-btn more-section-back"
                  onClick={() => setSelected(null)}
                >
                  <ArrowLeft size={17} />
                  Các mục quản lý
                </button>
                <div className="more-section-detail" key={selected}>
                  {content[selected]}
                </div>
              </>
            )}
          </div>
        </Dialog>
      )}
    </>
  );
}
