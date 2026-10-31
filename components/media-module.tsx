"use client";
import { SwipeRow } from "./ui/swipe-row";
import {
  Compass,
  Crown,
  Images,
  CalendarDays,
  Sparkles,
  Camera,
  Link2,
  MapPin,
  FileText,
} from "lucide-react";
import { Link, Empty } from "./ui/travel-ui";
import { mediaPreviewUrl, mediaEmbedUrl, dateLabel } from "@/lib/domain";
import type { Bundle, Trip, TripStory, Entity } from "@/lib/types";
type Props = {
  data: Bundle;
  trip: Trip;
  story: TripStory;
  storyCoverEmbed: string | null;
  storyCoverPreview: string | null;
  setMediaViewerId: (id: string) => void;
  writable: boolean;
  edit: (entity: Entity, record?: object) => void;
  rowTools: (
    entity: Entity,
    row: object & { id: string; version: number },
  ) => React.ReactNode;
};
export function MediaModule({
  data,
  trip,
  story,
  storyCoverEmbed,
  storyCoverPreview,
  setMediaViewerId,
  writable,
  edit,
  rowTools,
}: Props) {
  const tab = "media";
  return (
    <>
      {tab === "media" && data && story && (
        <>
          <section className="story-hero panel">
            <div
              className={`story-hero-visual ${story.cover && storyCoverEmbed ? "media-clickable" : ""}`}
              onClick={() =>
                story.cover &&
                storyCoverEmbed &&
                setMediaViewerId(story.cover.id)
              }
              role={story.cover && storyCoverEmbed ? "button" : undefined}
              tabIndex={story.cover && storyCoverEmbed ? 0 : undefined}
              onKeyDown={(event) => {
                if (
                  story.cover &&
                  storyCoverEmbed &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  setMediaViewerId(story.cover.id);
                }
              }}
            >
              {storyCoverPreview ? (
                <img
                  src={storyCoverPreview}
                  alt={story.cover?.title || trip.name}
                  onError={(event) => {
                    event.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="story-hero-placeholder">
                  <Compass size={42} />
                  <span>TRIPFLOW MEMORIES</span>
                </div>
              )}
              {story.cover && (
                <span className="story-cover-badge">
                  <Crown size={14} /> Ảnh bìa
                </span>
              )}
            </div>
            <div className="story-hero-copy">
              <span className="eyebrow">
                MEDIA · MEMORIES · STORYTELLING · V1.3.0
              </span>
              <h2>{story.cover?.title || trip.name}</h2>
              <p>
                {story.cover?.note ||
                  `Gom những khoảnh khắc của ${trip.destination} thành một câu chuyện dễ xem lại và chia sẻ.`}
              </p>
              <div className="story-stats">
                <span>
                  <Images size={15} />
                  <b>{story.media_total}</b> media
                </span>
                <span>
                  <CalendarDays size={15} />
                  <b>{story.memory_days}</b> ngày kỷ niệm
                </span>
                <span>
                  <Sparkles size={15} />
                  <b>{story.highlights.length}</b> highlight
                </span>
              </div>
              <div className="actions">
                {writable && (
                  <button className="btn primary" onClick={() => edit("media")}>
                    <Camera size={17} /> Thêm kỷ niệm
                  </button>
                )}
                {story.cover && storyCoverEmbed && (
                  <button
                    className="btn secondary"
                    onClick={() => setMediaViewerId(story.cover!.id)}
                  >
                    <Images size={17} /> Xem trong TripFlow
                  </button>
                )}
                {story.cover && <Link url={story.cover.url}>Mở nguồn</Link>}
              </div>
            </div>
          </section>

          <div className="notice">
            <Link2 size={20} />
            <span>
              TripFlow quản lý metadata/câu chuyện; ảnh và video vẫn nằm tại
              Google Drive hoặc nguồn HTTPS. Người xem cần quyền tại nguồn.
            </span>
          </div>

          {story.highlights.length > 0 && (
            <section className="story-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">TRIP HIGHLIGHTS</span>
                  <h2>Khoảnh khắc đáng nhớ</h2>
                </div>
                <span className="pill">
                  {story.highlights.length} highlight
                </span>
              </div>
              <div className="highlight-grid">
                {story.highlights.map((m) => {
                  const preview = mediaPreviewUrl(m);
                  const embed = mediaEmbedUrl(m);
                  return (
                    <article className="highlight-card" key={m.id}>
                      <div
                        className={`highlight-visual ${embed ? "media-clickable" : ""}`}
                        onClick={() => embed && setMediaViewerId(m.id)}
                        role={embed ? "button" : undefined}
                        tabIndex={embed ? 0 : undefined}
                        onKeyDown={(event) => {
                          if (
                            embed &&
                            (event.key === "Enter" || event.key === " ")
                          ) {
                            event.preventDefault();
                            setMediaViewerId(m.id);
                          }
                        }}
                      >
                        {preview ? (
                          <img
                            src={preview}
                            alt={m.title}
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span>
                            <Sparkles size={28} />
                          </span>
                        )}
                        <div className="highlight-badges">
                          {m.is_cover && (
                            <em>
                              <Crown size={12} /> Cover
                            </em>
                          )}
                          {m.is_highlight && (
                            <em>
                              <Sparkles size={12} /> Highlight
                            </em>
                          )}
                        </div>
                      </div>
                      <div className="highlight-copy">
                        <div className="section-heading">
                          <h3>{m.title}</h3>
                          {rowTools("media", m)}
                        </div>
                        <small>
                          {m.taken_on
                            ? dateLabel(m.taken_on)
                            : "Kỷ niệm chuyến đi"}
                        </small>
                        {m.note && <p className="prewrap">{m.note}</p>}
                        <Link url={m.url}>
                          Mở{" "}
                          {m.kind === "photo"
                            ? "ảnh"
                            : m.kind === "video"
                              ? "video"
                              : m.kind === "album"
                                ? "album"
                                : "tài liệu"}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          <section className="story-section memory-timeline-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">TRAVEL JOURNAL</span>
                <h2>Nhật ký theo ngày</h2>
              </div>
              <span className="pill">{story.days.length} ngày</span>
            </div>
            <div className="memory-timeline">
              {story.days.map((memoryDay) => (
                <article className="memory-day" key={memoryDay.day}>
                  <div className="memory-day-marker">
                    <span />
                  </div>
                  <div className="memory-day-content">
                    <div className="memory-day-head">
                      <div>
                        <span className="eyebrow">{memoryDay.title}</span>
                        <h3>
                          {memoryDay.items[0]?.location || trip.destination}
                        </h3>
                      </div>
                      <small>
                        {memoryDay.items.length} hoạt động ·{" "}
                        {memoryDay.media.length} media
                      </small>
                    </div>
                    {memoryDay.items.length > 0 && (
                      <div className="memory-activities">
                        {memoryDay.items.slice(0, 4).map((item) => (
                          <span key={item.id}>
                            <MapPin size={13} /> {item.title}
                          </span>
                        ))}
                      </div>
                    )}
                    {memoryDay.media.length > 0 ? (
                      <div className="memory-media-grid">
                        {memoryDay.media.map((m) => {
                          const preview = mediaPreviewUrl(m);
                          const embed = mediaEmbedUrl(m);
                          return (
                            <SwipeRow
                              actions={rowTools("media", m)}
                              className={`memory-media-card ${m.is_highlight ? "highlighted" : ""}`}
                              key={m.id}
                            >
                              <div
                                className={`memory-media-preview ${embed ? "media-clickable" : ""}`}
                                onClick={() => embed && setMediaViewerId(m.id)}
                                role={embed ? "button" : undefined}
                                tabIndex={embed ? 0 : undefined}
                                onKeyDown={(event) => {
                                  if (
                                    embed &&
                                    (event.key === "Enter" || event.key === " ")
                                  ) {
                                    event.preventDefault();
                                    setMediaViewerId(m.id);
                                  }
                                }}
                              >
                                {preview ? (
                                  <img
                                    src={preview}
                                    alt={m.title}
                                    onError={(event) => {
                                      event.currentTarget.style.display =
                                        "none";
                                    }}
                                  />
                                ) : m.kind === "document" ? (
                                  <FileText size={28} />
                                ) : (
                                  <Images size={28} />
                                )}
                                <span>
                                  {
                                    (
                                      {
                                        album: "ALBUM",
                                        photo: "ẢNH",
                                        video: "VIDEO",
                                        document: "TÀI LIỆU",
                                      } as const
                                    )[m.kind]
                                  }
                                </span>
                              </div>
                              <div className="memory-media-body">
                                <div className="section-heading">
                                  <h3>{m.title}</h3>
                                  {rowTools("media", m)}
                                </div>
                                <div className="memory-meta">
                                  {m.is_highlight && (
                                    <span>
                                      <Sparkles size={12} /> Highlight
                                    </span>
                                  )}
                                  {m.is_cover && (
                                    <span>
                                      <Crown size={12} /> Cover
                                    </span>
                                  )}
                                  {(m.story_order || 0) > 0 && (
                                    <span>#{m.story_order}</span>
                                  )}
                                </div>
                                {m.note && <p className="prewrap">{m.note}</p>}
                                <Link url={m.url}>Mở media</Link>
                              </div>
                            </SwipeRow>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="muted memory-empty-day">
                        Chưa gắn kỷ niệm cho ngày này.
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {!data.media.length && (
            <section className="panel">
              <Empty
                title="Bắt đầu câu chuyện chuyến đi"
                text="Gắn ảnh, video hoặc album; chọn ảnh bìa và Trip Highlight để TripFlow tự dựng nhật ký theo ngày."
                onAdd={writable ? () => edit("media") : undefined}
                label="Thêm kỷ niệm"
              />
            </section>
          )}
        </>
      )}
    </>
  );
}
