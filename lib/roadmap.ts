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
    done: false,
    description:
      "Dashboard tổng kết, thống kê chi phí/lịch trình, báo cáo sau chuyến và export nâng cao.",
  },
  {
    version: "V0.9.0",
    title: "Release Candidate & Hardening",
    done: false,
    description:
      "Dừng mở rộng lớn, tập trung UAT, thiết bị thật, bảo mật, hiệu năng, mạng gián đoạn và sửa lỗi.",
  },
  {
    version: "V1.0.0",
    title: "Stable Production Release",
    done: false,
    description:
      "Bản ổn định chính thức với tài liệu vận hành, checklist phát hành và tiêu chuẩn production.",
  },
];

export const NEXT_VERSION = ROADMAP.find((item) => !item.done)!;
