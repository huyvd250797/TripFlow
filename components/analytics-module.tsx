"use client";
import {
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { download, openPrintableReport, Bar } from "./ui/travel-ui";
import {
  postTripCsv,
  postTripJson,
  postTripHtml,
  money,
  dateLabel,
} from "@/lib/domain";
import type {
  Bundle,
  Trip,
  TripAnalyticsReport,
  FinanceReport,
} from "@/lib/types";
type Props = {
  data: Bundle;
  trip: Trip;
  analytics: TripAnalyticsReport;
  financeReport: FinanceReport;
  minutesText: (n: number | null | undefined) => string;
};
export function AnalyticsModule({
  data,
  trip,
  analytics,
  financeReport,
  minutesText,
}: Props) {
  return (
    <>
      {analytics && financeReport && (
        <section className="panel analytics-panel" id="trip-analytics">
          <div className="section-heading analytics-heading">
            <div>
              <span className="eyebrow">
                TRIP ANALYTICS & POST-TRIP REPORT · V0.8.0
              </span>
              <h2>Tổng kết chuyến đi</h2>
              <p className="muted">
                Báo cáo tổng hợp lịch trình, tài chính và media từ dữ liệu hiện
                tại của chuyến đi.
              </p>
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
          </div>

          <span
            className={`status-chip ${analytics.readiness === "ready" ? "active" : ""}`}
          >
            {analytics.report_state === "post_trip"
              ? analytics.readiness === "ready"
                ? "Báo cáo hoàn chỉnh"
                : "Sau chuyến · cần rà soát"
              : "Báo cáo tạm thời"}
          </span>
          <div className="analytics-kpis">
            <article>
              <span>Hoàn thành lịch trình</span>
              <b>{analytics.itinerary.completion_rate}%</b>
              <small>
                {analytics.itinerary.done}/{analytics.itinerary.total} hoạt động
              </small>
              <Bar
                value={analytics.itinerary.done}
                max={analytics.itinerary.total}
              />
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
                max={Math.max(
                  analytics.finance.current_budget,
                  analytics.finance.net_actual,
                  1,
                )}
                over={analytics.finance.current_variance < 0}
              />
            </article>
            <article>
              <span>Chi phí / người</span>
              <b>{money(analytics.finance.per_person)}</b>
              <small>
                {trip.people} người · {analytics.trip_days} ngày
              </small>
            </article>
            <article>
              <span>Media & tài liệu</span>
              <b>{analytics.media.total}</b>
              <small>
                {analytics.media.linked_to_activity} mục gắn hoạt động
              </small>
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
                <span className="pill">
                  {analytics.itinerary.processed_rate}% đã xử lý
                </span>
              </div>
              <div className="analytics-metrics">
                <div>
                  <span>Hoàn thành</span>
                  <b>{analytics.itinerary.done}</b>
                </div>
                <div>
                  <span>Bỏ qua</span>
                  <b>{analytics.itinerary.skipped}</b>
                </div>
                <div>
                  <span>Check-in</span>
                  <b>{analytics.itinerary.checked_in}</b>
                </div>
                <div>
                  <span>Check-in trễ</span>
                  <b>{analytics.itinerary.late_checkins}</b>
                </div>
                <div>
                  <span>Trễ trung bình</span>
                  <b>
                    {minutesText(
                      analytics.itinerary.average_checkin_delay_minutes,
                    ) || "0 phút"}
                  </b>
                </div>
                <div>
                  <span>Trễ nhiều nhất</span>
                  <b>
                    {minutesText(
                      analytics.itinerary.max_checkin_delay_minutes,
                    ) || "0 phút"}
                  </b>
                </div>
              </div>
            </div>
            <div>
              <div className="section-heading">
                <h3>Tài chính</h3>
                <span
                  className={`pill ${analytics.finance.current_variance < 0 ? "negative" : ""}`}
                >
                  {analytics.finance.current_variance < 0
                    ? "Vượt dự toán"
                    : "Trong dự toán"}
                </span>
              </div>
              <div className="analytics-metrics">
                <div>
                  <span>Dự toán hiện tại</span>
                  <b>{money(analytics.finance.current_budget)}</b>
                </div>
                <div>
                  <span>Chênh lệch</span>
                  <b>{money(analytics.finance.current_variance)}</b>
                </div>
                <div>
                  <span>Ngoài dự toán</span>
                  <b>{money(analytics.finance.unlinked_actual)}</b>
                </div>
                <div>
                  <span>Giao dịch chi</span>
                  <b>{analytics.finance.expense_count}</b>
                </div>
                <div>
                  <span>Hoàn tiền</span>
                  <b>{analytics.finance.refund_count}</b>
                </div>
                <div>
                  <span>Nhóm chi nhiều nhất</span>
                  <b>{analytics.finance.top_category || "—"}</b>
                </div>
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
                  const max = Math.max(
                    Number(row.current),
                    Number(row.actual),
                    1,
                  );
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
                        Dự toán {money(Number(row.current))} · Chênh lệch{" "}
                        {money(Number(row.variance))}
                      </small>
                    </div>
                  );
                })}
              {!financeReport.categories.some(
                (row) => Number(row.current) || Number(row.actual),
              ) && (
                <p className="muted">Chưa có dữ liệu chi phí để phân tích.</p>
              )}
            </div>
          </div>

          <div className="analytics-section">
            <div className="section-heading">
              <h3>Tổng kết theo ngày</h3>
              <small className="muted">
                {analytics.days.length} ngày có dữ liệu
              </small>
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
              <p className="muted">
                Chưa có lịch trình hoặc chi tiêu để tổng hợp.
              </p>
            )}
          </div>
          <p className="hint analytics-footnote">
            Báo cáo V0.8.0 được tính lại từ dữ liệu nguồn mỗi lần mở hoặc
            export, không lưu thêm một “tổng” độc lập nên tránh lệch số liệu khi
            lịch trình hay chi phí được chỉnh sửa.
          </p>
        </section>
      )}
    </>
  );
}
