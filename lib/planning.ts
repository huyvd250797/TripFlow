import { localTime, utcTime } from "./domain";
import type { Item, Trip } from "./types";

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dayDiff(start: string, end: string) {
  const a = Date.parse(`${start}T12:00:00Z`);
  const b = Date.parse(`${end}T12:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export function planningDays(trip: Trip, items: Item[], zone = trip.timezone) {
  const itemDays = items.map((item) => localTime(item.start_at, zone).slice(0, 10));
  const unique = new Set<string>([trip.start_date, ...itemDays]);
  if (trip.end_date) {
    const span = dayDiff(trip.start_date, trip.end_date);
    if (span >= 0 && span <= 31) {
      for (let i = 0; i <= span; i += 1) unique.add(addDays(trip.start_date, i));
    } else {
      unique.add(trip.end_date);
    }
  }
  return [...unique].sort();
}

export function moveItemToDay(item: Item, targetDay: string, zone: string) {
  const localStart = localTime(item.start_at, zone);
  const startTime = localStart.slice(11, 16);
  const nextStart = utcTime(`${targetDay}T${startTime}`, zone);
  const duration = item.end_at ? Date.parse(item.end_at) - Date.parse(item.start_at) : null;
  const nextEnd = duration != null ? new Date(Date.parse(nextStart) + duration).toISOString() : null;
  return { start_at: nextStart, end_at: nextEnd };
}

export function shiftItemMinutes(item: Item, minutes: number) {
  const delta = minutes * 60000;
  return {
    start_at: new Date(Date.parse(item.start_at) + delta).toISOString(),
    end_at: item.end_at ? new Date(Date.parse(item.end_at) + delta).toISOString() : null,
  };
}
