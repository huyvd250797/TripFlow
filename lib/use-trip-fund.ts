"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { emptyFund, type FundData } from "./fund";
import type { Bundle } from "./types";
import { cacheFund, readCachedFund, removeCachedFund } from "./offline";
export function useTripFund(bundle: Bundle, userId: string, online: boolean) {
  const tid = bundle.trip.id;
  const query = useQuery({
    queryKey: ["trip-fund", userId, tid],
    networkMode: "always",
    staleTime: 15000,
    retry: false,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    queryFn: async ({ signal }) => {
      try {
        if (!navigator.onLine) {
          const saved = await readCachedFund<FundData>(userId, tid);
          return {
            data: saved || emptyFund,
            cached: true,
            error: saved ? "" : "Chưa có bản quỹ đã tải trên thiết bị này.",
          };
        }
        const r = await fetch(`/api/fund?trip=${tid}`, {
          cache: "no-store",
          signal,
        });
        const d = await r.json();
        if (!r.ok) {
          if (r.status === 401 || r.status === 403) {
            await removeCachedFund(userId, tid);
            return {
              data: emptyFund,
              cached: true,
              error: d.error || "Không còn quyền xem quỹ.",
            };
          }
          throw Error(d.error);
        }
        await cacheFund(userId, tid, d).catch(() => {});
        return { data: d as FundData, cached: false, error: "" };
      } catch (e) {
        if (signal.aborted) throw e;
        const saved = await readCachedFund<FundData>(userId, tid);
        return {
          data: saved || emptyFund,
          cached: true,
          error: e instanceof Error ? e.message : "Không tải được quỹ.",
        };
      }
    },
  });
  const load = () => query.refetch({ cancelRefetch: false });
  useEffect(() => {
    void query.refetch({ cancelRefetch: false });
  }, [online, bundle.expenses]);
  return {
    data: query.data?.data || emptyFund,
    cached: query.data?.cached || false,
    error: query.data?.error || "",
    loading: query.isFetching,
    pending: query.isPending,
    load,
  };
}
