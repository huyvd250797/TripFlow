/** Coalesce a Realtime burst into one targeted read; dispose on trip/account switch. */
export function createRefreshScheduler(
  refresh: (includeList: boolean) => void,
  delay = 220,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let includeList = false;
  return {
    schedule(list = false) {
      includeList ||= list;
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        const list = includeList;
        includeList = false;
        refresh(list);
      }, delay);
    },
    dispose() {
      if (timer) clearTimeout(timer);
      timer = undefined;
      includeList = false;
    },
  };
}
