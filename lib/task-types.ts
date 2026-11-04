/** 화면(클라이언트)에서도 쓰는 타입 · 색 (DB 없이) */
export type List = { id: number; name: string; color: string; sort: number; open: number };
export type Task = {
  id: number; title: string; list_id: number | null; list_name: string | null; list_color: string | null;
  due: string | null; my_day: string | null; month: string | null; important: boolean; note: string;
  done_at: string | null; done_note: string; repeat_id: number | null; atts: Att[];
};
export type Att = { id: number; drive_id: string; name: string; mime: string; link: string };
export type View = "today" | "important" | "planned" | "inbox" | "done" | "list";

export const DEFAULT_LIST = "작업";
export const COLORS: Record<string, { dot: string; text: string; bg: string }> = {
  indigo: { dot: "bg-indigo-500", text: "text-indigo-700", bg: "bg-indigo-50" },
  rose: { dot: "bg-rose-500", text: "text-rose-700", bg: "bg-rose-50" },
  emerald: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  amber: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50" },
  sky: { dot: "bg-sky-500", text: "text-sky-700", bg: "bg-sky-50" },
  violet: { dot: "bg-violet-500", text: "text-violet-700", bg: "bg-violet-50" },
  stone: { dot: "bg-stone-500", text: "text-stone-700", bg: "bg-stone-100" },
};
export const color = (c: string | null | undefined) => COLORS[c ?? ""] ?? COLORS.indigo;

