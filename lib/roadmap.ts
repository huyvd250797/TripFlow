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
    version: "V1.1.1",
    title: "Mobile Layout Fix",
    done: true,
    description:
      "Sửa CSS cascade làm giao diện mobile bị ép sang phải; khóa lại app shell, topbar, safe-area và responsive ở 320/390 px.",
  },
  {
    version: "V1.2.0",
    title: "Smart Trip Workspace & Quick Actions",
    done: true,
    description:
      "Quick add theo ngữ cảnh, tìm kiếm xuyên suốt chuyến đi, shortcut Current/Next, widget workspace và điều hướng nhanh hơn trên mobile/desktop.",
  },
  {
    version: "V1.3.0",
    title: "Media, Memories & Storytelling",
    done: true,
    description:
      "Nâng trải nghiệm ảnh/video theo ngày và hoạt động, cover chuyến đi, highlight hành trình và báo cáo chia sẻ đẹp hơn sau chuyến đi.",
  },
  {
    version: "V1.4.0",
    title: "Smart Planning Templates & Reuse",
    done: true,
    description:
      "Mẫu kế hoạch cá nhân, tạo chuyến mới bằng cách tự dời lịch theo ngày bắt đầu, tái sử dụng dự toán/người tham gia, ngày giờ kết thúc tùy chọn và tinh gọn thao tác trên dashboard/lịch trình.",
  },
  {
    version: "V1.5.0",
    title: "Quick Entry & Command Center",
    done: true,
    description:
      "Command Center toàn app, Quick Entry một dòng nhận tiền/ngày/giờ, lưu nhanh hoặc mở form, lịch sử lệnh gần đây, lặp khoản chi và phím tắt Ctrl/Cmd+K.",
  },
  {
    version: "V1.5.1",
    title: "Deploy Typecheck Fix",
    done: true,
    description:
      "Sửa lỗi build TypeScript: bảo vệ Bundle chưa tải khi lặp khoản chi gần nhất và bổ sung import dateLabel cho test domain; không đổi schema database.",
  },
  {
    version: "V1.6.0",
    title: "Smart Defaults & Context Automation",
    done: true,
    description:
      "Tự điền người trả/nhóm chi/ngày giờ/địa điểm theo dữ liệu gần nhất và activity hiện tại, gợi ý budget, cảnh báo vượt dự toán/trùng lịch, cố định taskbar PWA, Quick dock thu gọn và gom mục Thêm theo module.",
  },
  {
    version: "V1.7.0",
    title: "Planning Board & Timeline Pro",
    done: true,
    description:
      "Timeline/Planning Board chuyển đổi tức thời, kéo thả hoạt động sang ngày khác trên desktop, đổi ngày trên mobile và chỉnh giờ ±30 phút mà không cần mở form.",
  },
  {
    version: "V1.8.0",
    title: "Map, Places & Route Intelligence",
    done: true,
    description:
      "Map view theo ngày, điểm dừng từ Google Maps, ước tính quãng đường/thời gian di chuyển, cảnh báo khoảng nghỉ quá ngắn và mở tuyến Google Maps nhanh; đồng thời cố định taskbar PWA, tinh gọn Quick dock và thêm motion chuyên nghiệp.",
  },
  {
    version: "V1.8.1",
    title: "Map Link, Media Viewer & PWA Keyboard Fix",
    done: true,
    description:
      "Mở rộng link Google Maps rút gọn ở server, xem media trực tiếp trong app và ổn định editor PWA khi bàn phím điện thoại mở.",
  },
  {
    version: "V1.8.2",
    title: "Google Maps Share & Media Zoom Fix",
    done: true,
    description:
      "Đọc tọa độ từ Google Maps Share qua redirect/HTML rồi chuẩn hóa link tọa độ; khóa pinch zoom toàn giao diện và chỉ cho phép zoom/kéo riêng ảnh đang mở.",
  },
  {
    version: "V1.8.3",
    title: "Google Maps Short Link Resolver Fix",
    done: true,
    description:
      "Ưu tiên đọc Location của maps.app.goo.gl bằng Node HTTPS raw request, HEAD → GET fallback, parse từng redirect trước khi mở trang Maps và trả trace khi chưa resolve được.",
  },
  {
    version: "V1.8.4",
    title: "Google Maps Coordinate Integrity Fix",
    done: true,
    description:
      "Giữ nguyên link maps.app.goo.gl người dùng dán, resolve ngầm bằng GET như trình duyệt, ưu tiên tọa độ địa điểm !3d/!4d và loại bỏ việc lấy nhầm tọa độ ngẫu nhiên từ HTML Google.",
  },
  {
    version: "V1.9.0",
    title: "Expense Intelligence & Travel Wallet",
    done: true,
    description:
      "Travel Wallet tổng hợp ngân sách còn lại, mức chi/ngày và người thanh toán; favorite/recent expense để dùng lại nhanh, gợi ý category theo nội dung/lịch sử và cảnh báo tốc độ chi theo tiến độ chuyến đi.",
  },
  {
    version: "V2.0.0",
    title: "TripFlow Pro Travel Operating System",
    done: true,
    description:
      "Hợp nhất Planning, Live Trip, Map, Finance và Memories bằng Trip Operating Center; Travel Wallet tối ưu thao tác mobile và Người thanh toán lấy trực tiếp từ người tham gia chuyến đi.",
  },
  {
    version: "V2.1.0",
    title: "Smart Quick Actions & Contextual UX",
    done: true,
    description:
      "Nâng Quick Entry ngay trong nút ⚡ Command Center: một câu lệnh chi tiêu có thể nhận số tiền, nội dung, người thanh toán từ người tham gia và khoản dự toán theo exact/fuzzy match; preview rõ dữ liệu sẽ lưu và chỉ yêu cầu chọn khi có nhiều kết quả gần giống.",
  },
  {
    version: "V2.2.0",
    title: "Smart Forms & Defaults",
    done: true,
    description:
      "Giảm thao tác trong các form bằng progressive disclosure, mặc định thông minh và chỉ hiện các trường nâng cao khi thật sự cần, vẫn giữ đủ dữ liệu để quản lý chuyên nghiệp.",
  },
  {
    version: "V2.2.1",
    title: "Travel Wallet Compact CTA Fix",
    done: true,
    description:
      "Thu gọn nút Ghi chi tiêu trong Travel Wallet về CTA compact ở góc phải, đặc biệt trên mobile; không còn chiếm toàn chiều rộng hoặc làm hẹp phần mô tả Ví chuyến đi.",
  },
  {
    version: "V2.3.0",
    title: "Trip Daily Command Center",
    done: false,
    description:
      "Tập trung trải nghiệm đang đi vào một màn hình Hôm nay: lịch trình tiếp theo, trạng thái chuyến đi, chi tiêu trong ngày và hành động nhanh theo ngữ cảnh để giảm việc chuyển qua lại giữa các module.",
  },
  {
    version: "V2.4.0",
    title: "Offline & Sync Reliability Pro",
    done: false,
    description:
      "Tăng độ tin cậy khi mạng yếu/mất mạng: queue thao tác rõ trạng thái, chống lưu trùng, retry có kiểm soát, phục hồi sync và thông báo lỗi ngắn gọn không làm gián đoạn chuyến đi.",
  },
  {
    version: "V2.5.0",
    title: "Performance, Loading & Perceived Speed",
    done: false,
    description:
      "Tối ưu tốc độ mở app và chuyển màn hình bằng lazy loading, giảm request thừa, cache dữ liệu phù hợp, skeleton/loading state theo ngữ cảnh, optimistic UI và đo các điểm chậm thực tế trên mobile.",
  },
  {
    version: "V2.6.0",
    title: "UI/UX Motion & Visual Polish",
    done: false,
    description:
      "Chuẩn hóa motion/animation nhẹ cho modal, bottom sheet, tab, card và trạng thái lưu; thống nhất spacing, typography, button, empty/error/success state, ưu tiên mượt nhưng không gây chậm hoặc rối mắt.",
  },
  {
    version: "V2.7.0",
    title: "Mobile Navigation & Interaction Polish",
    done: false,
    description:
      "Tinh gọn điều hướng mobile, giữ vị trí scroll và context khi quay lại, giảm số lần chạm, chuẩn hóa swipe/inline action và vùng bấm để TripFlow dùng nhanh như ứng dụng native.",
  },
];

export const NEXT_VERSION = ROADMAP.find((item) => !item.done) ?? null;
