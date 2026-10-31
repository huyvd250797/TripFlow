// In-memory guards only: durable offline operations remain in IndexedDB across updates.
const blockers = new Map<string, string>();
const preparations = new Map<string, () => Promise<void>>();
export function setUpdateBlocker(key: string, reason?: string) {
  if (reason) blockers.set(key, reason);
  else blockers.delete(key);
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("tripflow:update-safety"));
}
export function updateBlockReason() {
  return [...blockers.values()][0] || "";
}
export function beginAppWrite() {
  const key = `write:${crypto.randomUUID()}`;
  setUpdateBlocker(key, "Đang lưu dữ liệu. Vui lòng chờ thao tác hoàn tất.");
  return () => setUpdateBlocker(key);
}
export function registerUpdatePreparation(
  key: string,
  fn: () => Promise<void>,
) {
  preparations.set(key, fn);
  return () => {
    preparations.delete(key);
  };
}
export async function prepareAppUpdate() {
  const reason = updateBlockReason();
  if (reason) throw new Error(reason);
  for (const prepare of preparations.values()) await prepare();
  const latest = updateBlockReason();
  if (latest) throw new Error(latest);
}
export function isNewerVersion(candidate: string, current: string) {
  if (!/^\d+\.\d+\.\d+$/.test(candidate)) return false;
  const a = candidate.split(".").map(Number),
    b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}
