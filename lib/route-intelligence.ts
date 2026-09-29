import type { Item } from "./types";
import { localTime } from "./domain";

export type RouteCoordinate = { lat: number; lng: number };

export type RouteLeg = {
  from: Item;
  to: Item;
  fromCoord: RouteCoordinate | null;
  toCoord: RouteCoordinate | null;
  distanceKm: number | null;
  travelMinutes: number | null;
  availableMinutes: number;
  level: "ok" | "tight" | "unknown";
  mode: "walk" | "ride" | "drive" | "unknown";
  label: string;
};

export type RouteDayAnalysis = {
  day: string;
  items: Item[];
  legs: RouteLeg[];
  mappedItems: number;
  totalDistanceKm: number;
  totalTravelMinutes: number;
  warnings: string[];
  directionsUrl: string;
};

const coordOk = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

export function extractMapCoordinate(input?: string | null): RouteCoordinate | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  const variants = new Set<string>([raw]);
  let decoded = raw;
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(decoded);
      variants.add(next);
      if (next === decoded) break;
      decoded = next;
    } catch {
      break;
    }
  }
  for (const value of [...variants]) {
    variants.add(
      value
        .replace(/\\u003d/gi, "=")
        .replace(/\\u0026/gi, "&")
        .replace(/\\u002f/gi, "/")
        .replace(/&amp;/gi, "&")
        .replace(/\\\//g, "/"),
    );
  }

  const read = (latText: string, lngText: string) => {
    const lat = Number(latText);
    const lng = Number(lngText);
    return coordOk(lat, lng) ? { lat, lng } : null;
  };

  // Google place URLs can contain both a viewport center (@lat,lng) and the
  // actual place coordinate (!3dlat!4dlng). Always prefer the place coordinate.
  for (const value of variants) {
    const place = value.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/i);
    if (place) {
      const coordinate = read(place[1], place[2]);
      if (coordinate) return coordinate;
    }

    // Some Google payloads encode longitude before latitude as !2d{lng}!3d{lat}.
    const reversed = value.match(/!2d(-?\d{1,3}(?:\.\d+)?)!3d(-?\d{1,2}(?:\.\d+)?)/i);
    if (reversed) {
      const coordinate = read(reversed[2], reversed[1]);
      if (coordinate) return coordinate;
    }
  }

  for (const value of variants) {
    const query = value.match(/[?&](?:query|q|destination|origin|ll|center)=(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)(?:&|$)/i);
    if (query) {
      const coordinate = read(query[1], query[2]);
      if (coordinate) return coordinate;
    }
  }

  for (const value of variants) {
    const viewport = value.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)(?:,|\/|$)/);
    if (viewport) {
      const coordinate = read(viewport[1], viewport[2]);
      if (coordinate) return coordinate;
    }
  }

  // Deliberately do not parse arbitrary decimal pairs or lat/lng JSON from free
  // text. Google HTML contains many unrelated coordinates and treating the first
  // one as the destination can send the route to the wrong place.
  return null;
}

export function coordinateMapUrl(coordinate: RouteCoordinate) {
  const lat = Number(coordinate.lat.toFixed(7));
  const lng = Number(coordinate.lng.toFixed(7));
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function haversineKm(a: RouteCoordinate, b: RouteCoordinate) {
  const r = 6371;
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

export function estimateRouteLeg(a: RouteCoordinate, b: RouteCoordinate) {
  // Haversine is straight-line distance. 1.28 is a conservative road/path factor.
  const distanceKm = Math.max(0, haversineKm(a, b) * 1.28);
  let speedKmh = 38;
  let mode: RouteLeg["mode"] = "drive";
  if (distanceKm <= 1.5) {
    speedKmh = 4.5;
    mode = "walk";
  } else if (distanceKm <= 8) {
    speedKmh = 24;
    mode = "ride";
  }
  const travelMinutes = Math.max(3, Math.ceil((distanceKm / speedKmh) * 60 + (mode === "walk" ? 0 : 5)));
  return { distanceKm, travelMinutes, mode };
}

function minutesBetween(a: string, b: string) {
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(diff / 60000));
}

function placeToken(item: Item) {
  const coord = extractMapCoordinate(item.map_url);
  if (coord) return `${coord.lat},${coord.lng}`;
  return item.location.trim() || item.title.trim();
}

export function buildDirectionsUrl(items: Item[]) {
  if (items.length < 2) return "";
  const tokens = items.map(placeToken).filter(Boolean);
  if (tokens.length < 2) return "";
  const origin = tokens[0];
  const destination = tokens[tokens.length - 1];
  const waypoints = tokens.slice(1, -1).slice(0, 8);
  const params = new URLSearchParams({ api: "1", origin, destination, travelmode: "driving" });
  if (waypoints.length) params.set("waypoints", waypoints.join("|"));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function analyzeRouteDay(items: Item[], zone: string, day: string): RouteDayAnalysis {
  const rows = items
    .filter((item) => localTime(item.start_at, zone).slice(0, 10) === day)
    .slice()
    .sort((a, b) => a.start_at.localeCompare(b.start_at));
  const legs: RouteLeg[] = [];
  const warnings: string[] = [];
  for (let i = 0; i < rows.length - 1; i += 1) {
    const from = rows[i];
    const to = rows[i + 1];
    const fromCoord = extractMapCoordinate(from.map_url);
    const toCoord = extractMapCoordinate(to.map_url);
    const availableMinutes = minutesBetween(from.end_at || from.start_at, to.start_at);
    if (!fromCoord || !toCoord) {
      legs.push({
        from,
        to,
        fromCoord,
        toCoord,
        distanceKm: null,
        travelMinutes: null,
        availableMinutes,
        level: "unknown",
        mode: "unknown",
        label: "Thiếu tọa độ để ước tính quãng đường",
      });
      continue;
    }
    const estimate = estimateRouteLeg(fromCoord, toCoord);
    const buffer = 10;
    const tight = availableMinutes < estimate.travelMinutes + buffer;
    const label = tight
      ? `Chỉ có ${availableMinutes} phút, nên chừa khoảng ${estimate.travelMinutes + buffer} phút để di chuyển.`
      : `Có ${availableMinutes} phút giữa hai chặng, đủ so với khoảng ${estimate.travelMinutes} phút di chuyển ước tính.`;
    if (tight) warnings.push(`${from.title} → ${to.title}: ${label}`);
    legs.push({
      from,
      to,
      fromCoord,
      toCoord,
      distanceKm: estimate.distanceKm,
      travelMinutes: estimate.travelMinutes,
      availableMinutes,
      level: tight ? "tight" : "ok",
      mode: estimate.mode,
      label,
    });
  }
  const mappedItems = rows.filter((item) => extractMapCoordinate(item.map_url)).length;
  return {
    day,
    items: rows,
    legs,
    mappedItems,
    totalDistanceKm: legs.reduce((sum, leg) => sum + (leg.distanceKm || 0), 0),
    totalTravelMinutes: legs.reduce((sum, leg) => sum + (leg.travelMinutes || 0), 0),
    warnings,
    directionsUrl: buildDirectionsUrl(rows),
  };
}

export function mapPointLayout(items: Item[]) {
  const points = items
    .map((item) => ({ item, coord: extractMapCoordinate(item.map_url) }))
    .filter((row): row is { item: Item; coord: RouteCoordinate } => !!row.coord);
  if (!points.length) return [];
  const lats = points.map((x) => x.coord.lat);
  const lngs = points.map((x) => x.coord.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(0.001, maxLat - minLat);
  const lngRange = Math.max(0.001, maxLng - minLng);
  return points.map((row, index) => ({
    ...row,
    index,
    x: 10 + ((row.coord.lng - minLng) / lngRange) * 80,
    y: 90 - ((row.coord.lat - minLat) / latRange) * 80,
  }));
}
