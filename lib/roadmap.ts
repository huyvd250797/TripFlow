export type RoadmapItem = {
  version: string;
  title: string;
  done: boolean;
  description: string;
};

export const ROADMAP: RoadmapItem[] = [
  {
    version: "V0.1.0",
    title: "Cloud MVP",
    done: true,
    description:
      "Tài khoản, chuyến đi, lịch trình, roadmap/check-in, dự toán, thực chi, media, thành viên, RLS và triển khai cloud.",
  },
  {
    version: "V0.2.0",
    title: "Offline, Data Reliability & Master Administration",
    done: true,
    description:
      "Cache IndexedDB, hàng đợi offline, đồng bộ chống trùng/xung đột, trạng thái sync và Master quản lý user, dữ liệu, kích hoạt tài khoản.",
  },
  {
    version: "V0.3.0",
    title: "Finance & Reporting Integrity",
    done: true,
    description:
      "Hoàn thiện snapshot ngân sách, đối chiếu dự toán gốc/hiện tại/thực chi, hoàn tiền, báo cáo và kiểm soát tính đúng của số liệu.",
  },
  {
    version: "V0.4.0",
    title: "Live Trip & Realtime",
    done: true,
    description:
      "Current/Next/Late, check-in giao dịch, lịch sử trạng thái bất biến, cảnh báo trễ và Realtime nhiều thiết bị có refetch dự phòng.",
  },
  {
    version: "V0.5.0",
    title: "Collaboration & Permission Control",
    done: true,
    description:
      "Hoàn thiện Owner/Editor/Viewer, participant tách account, lời mời chống trùng, thay đổi quyền Realtime và thu hồi quyền tức thời ở server.",
  },
  {
    version: "V0.6.0",
    title: "Mobile UX & PWA Stabilization",
    done: true,
    description:
      "Tối ưu safe-area iPhone/Android, form fullscreen theo visual viewport, giữ trạng thái màn hình/scroll, cài đặt & cập nhật PWA, bảo vệ cache offline và hiệu năng cảm nhận.",
  },
  {
    version: "V0.7.0",
    title: "Backup, Recovery & Operations",
    done: true,
    description:
      "Backup snapshot có checksum, khôi phục thành bản sao an toàn, thùng rác/tombstone, retention không tự purge, health vận hành và recovery có audit.",
  },
  {
    version: "V0.8.0",
    title: "Trip Analytics & Post-Trip Report",
    done: true,
    description:
      "Dashboard tổng kết lịch trình/tài chính/media, chỉ số theo ngày, cảnh báo cần rà soát và export CSV/JSON/bản in báo cáo sau chuyến.",
  },
  {
    version: "V0.9.0",
    title: "Release Candidate & Hardening",
    done: true,
    description:
      "Release readiness tự kiểm tra migration/RLS/guard dữ liệu, hardening HTTP/API, UAT đa thiết bị, kiểm thử mạng gián đoạn và đóng lỗi trước V1.0.0.",
  },
  {
    version: "V1.0.0",
    title: "Stable Production Release",
    done: true,
    description:
      "Bản ổn định chính thức: schema marker production, kiểm tra health trước vận hành, tài liệu runbook/checklist và đóng roadmap 1.0.",
  },
  {
    version: "V1.1.0",
    title: "Brand Refresh, Professional UI & Travel Identity",
    done: true,
    description:
      "Làm mới nhận diện TripFlow theo chủ đề du lịch, logo/app icon mới, splash loading có thương hiệu, hệ màu travel premium và chuẩn hóa UI desktop/mobile.",
  },
  {
    version: "V1.2.0",
    title: "Smart Trip Workspace & Quick Actions",
    done: false,
    description:
      "Tăng tốc thao tác hằng ngày bằng quick add, shortcut theo ngữ cảnh, tìm kiếm trong chuyến đi, widget tổng quan và điều hướng thông minh hơn.",
  },
  {
    version: "V1.3.0",
    title: "Media, Memories & Storytelling",
    done: false,
    description:
      "Nâng trải nghiệm ảnh/video theo ngày và hoạt động, cover chuyến đi, highlight hành trình và báo cáo chia sẻ đẹp hơn sau chuyến đi.",
  },
  {
    version: "V1.4.0",
    title: "Smart Planning Templates & Reuse",
    done: false,
    description:
      "Template chuyến đi, duplicate thông minh, checklist theo loại hành trình và tái sử dụng lịch trình/ngân sách cho chuyến mới.",
  },
  {
    version: "V1.5.0",
    title: "Growth, Sharing & Expansion",
    done: false,
    description:
      "Mở rộng chia sẻ, public/private trip view, export nâng cao và chuẩn bị nền cho đa tiền tệ, tích hợp dịch vụ hoặc AI khi có nhu cầu rõ ràng.",
  },
];

export const NEXT_VERSION = ROADMAP.find((item) => !item.done) ?? null;
