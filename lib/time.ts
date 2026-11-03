/** "08:30" 또는 "08:30:00" → 분 */
export function toMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}
/** 분 → "08:30" */
export function minToTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
/** 분 → "13:05" 같은 시간 합계 (24시간 넘어도 그대로) */
export function fmtHM(m: number): string {
  const sign = m < 0 ? "-" : "";
  const a = Math.abs(m);
  return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}
export function hhmm(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}
/** 서울 기준 오늘 'YYYY-MM-DD' */
export function todaySeoul(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
export function isMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}
export function isDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function weekday(date: string): number {
  return new Date(date + "T00:00:00Z").getUTCDay();
}
/** 'YYYY-MM-DD' 에 n일 더하기 */
export function addDays(date: string, n: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 기록 추가에서 한 번에 넣을 수 있는 최대 기간(일) */
export const MAX_RANGE_DAYS = 100;
/** from ~ to 날짜 목록 (둘 다 포함). limit 보다 길면 limit+1 개에서 멈춤 */
export function dateRange(from: string, to: string, limit = 400): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length <= limit; d = addDays(d, 1)) out.push(d);
  return out;
}
export const WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];
