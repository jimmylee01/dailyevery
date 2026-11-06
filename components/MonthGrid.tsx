"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { addRangeTask, completeTask, reopenTask } from "@/lib/actions-tasks";
import { color, DEFAULT_LIST, type Label, type List } from "@/lib/task-types";
import { LabelPicker } from "@/components/Tasks";

export type CalItem = { id: number; title: string; from: string; to: string; done: boolean; color: string | null };

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`;
const diff = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** 월별 달력: 날짜를 누르면 그날로, 여러 날을 드래그하면 그 기간 할 일 추가, 할 일 동그라미를 누르면 끝냄/되돌림 */
export function MonthGrid({ days, today, spans, dues, doneBy, notes, atts, lists, labels }: {
  days: (string | null)[]; today: string; spans: CalItem[]; dues: CalItem[];
  doneBy: Record<string, number>; notes: Record<string, string>; atts: Record<string, number>; lists: List[]; labels: Label[];
}) {
  const router = useRouter();
  const [sel, setSel] = useState<{ a: string; b: string } | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const drag = useRef<{ a: string; moved: boolean } | null>(null);
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>({});
  const [, start] = useTransition();

  useEffect(() => {
    const dayAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest("[data-day]") as HTMLElement | null)?.dataset.day;
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      const d = dayAt(e.clientX, e.clientY);
      if (d && d !== drag.current.a) drag.current.moved = true;
      if (d) setSel((s) => (s && s.b !== d ? { ...s, b: d } : s));
    };
    const up = (e: PointerEvent) => {
      const g = drag.current;
      if (!g) return;
      drag.current = null;
      const d = dayAt(e.clientX, e.clientY) ?? g.a;
      setSel(null);
      if (g.moved && d !== g.a) setRange(g.a < d ? { from: g.a, to: d } : { from: d, to: g.a });
      else router.push(`/?day=${g.a}`);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [router]);

  const isDone = (t: CalItem) => doneMap[t.id] ?? t.done;
  const toggle = (t: CalItem) => {
    const now = !isDone(t);
    setDoneMap((m) => ({ ...m, [t.id]: now }));
    start(() => (now ? completeTask(t.id, "") : reopenTask(t.id)));
  };
  const inSel = (d: string) => !!sel && d >= (sel.a < sel.b ? sel.a : sel.b) && d <= (sel.a < sel.b ? sel.b : sel.a);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <>
      <div className="select-none">
        {weeks.map((wk, wi) => {
          const real = wk.filter(Boolean) as string[];
          const ws = real[0], we = real[real.length - 1];
          // 이 주에 걸친 기간 할 일 → 줄(lane) 나누기
          const here = ws ? spans.filter((s) => s.from <= we && s.to >= ws).sort((a, b) => a.from.localeCompare(b.from) || diff(b.from, b.to) - diff(a.from, a.to)) : [];
          const lanes: CalItem[][] = [];
          for (const s of here) {
            const lane = lanes.find((l) => l.every((x) => x.to < s.from || x.from > s.to));
            if (lane) lane.push(s); else lanes.push([s]);
          }
          const shown = lanes.slice(0, 3);
          return (
            <div key={wi} className="grid grid-cols-7">
              {wk.map((d, k) => d ? (
                <div key={d} data-day={d}
                  onPointerDown={(e) => { if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return; e.preventDefault(); drag.current = { a: d, moved: false }; setSel({ a: d, b: d }); }}
                  className={`min-h-28 cursor-pointer border-b border-r border-stone-100 px-1.5 pb-1.5 pt-1 text-left ${inSel(d) ? "bg-indigo-100/70" : d === today ? "bg-indigo-50/50 ring-2 ring-inset ring-brand" : "hover:bg-stone-50"}`}>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-sm font-semibold ${k === 0 ? "text-rose-600" : k === 6 ? "text-sky-700" : ""}`}>{Number(d.slice(8))}</span>
                    {!!doneBy[d] && <span className="ml-auto rounded bg-emerald-100 px-1 text-[10px] font-semibold text-emerald-800">✓{doneBy[d]}</span>}
                  </div>
                  {shown.map((lane, li) => {
                    const s = lane.find((x) => x.from <= d && x.to >= d);
                    if (!s) return <div key={li} className="mt-0.5 h-[18px]" />;
                    const head = s.from === d || k === 0;
                    const tail = s.to === d || k === 6;
                    const dn = isDone(s);
                    return (
                      <div key={li} title={`${s.title} (${md(s.from)} ~ ${md(s.to)})`}
                        className={`mt-0.5 flex h-[18px] items-center gap-1 overflow-hidden text-[11px] leading-none ${head ? "rounded-l pl-1" : "-ml-1.5"} ${tail ? "rounded-r" : "-mr-1.5"} ${dn ? "bg-stone-200 text-stone-400 line-through" : `${color(s.color).dot} text-white`}`}>
                        {head && <button type="button" onClick={() => toggle(s)} title={dn ? "되돌리기" : "끝내기"} className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border ${dn ? "border-stone-400 bg-stone-400 text-white" : "border-white/90 hover:bg-white/40"}`}><span className="text-[8px]">{dn ? "✓" : ""}</span></button>}
                        {head && <span className="truncate">{s.title}</span>}
                      </div>
                    );
                  })}
                  {lanes.length > 3 && lanes.slice(3).some((l) => l.some((x) => x.from <= d && x.to >= d)) && <div className="text-[10px] text-stone-500">+ 기간 일 더 있음</div>}
                  {dues.filter((t) => t.to === d).slice(0, 3).map((t) => {
                    const dn = isDone(t);
                    return (
                      <div key={t.id} className={`mt-0.5 flex items-center gap-1 truncate rounded px-1 text-[11px] ${dn ? "bg-stone-100 text-stone-400 line-through" : d < today ? "bg-rose-50 text-rose-800" : "bg-amber-50 text-amber-900"}`}>
                        <button type="button" onClick={() => toggle(t)} title={dn ? "되돌리기" : "끝내기"} className={`flex h-3 w-3 shrink-0 items-center justify-center rounded-full border ${dn ? "border-stone-400 bg-stone-400 text-white" : "border-current hover:bg-white"}`}><span className="text-[8px]">{dn ? "✓" : ""}</span></button>
                        <span className="truncate">{t.title}</span>
                      </div>
                    );
                  })}
                  {dues.filter((t) => t.to === d).length > 3 && <div className="text-[10px] text-stone-500">+{dues.filter((t) => t.to === d).length - 3}개 더</div>}
                  {!!atts[d] && <div className="mt-0.5 text-[10px] text-stone-500">📎 {atts[d]}</div>}
                  {notes[d] && <div className="mt-0.5 line-clamp-2 whitespace-pre-line text-[11px] leading-snug text-stone-600">📝 {notes[d]}</div>}
                </div>
              ) : <div key={`e${wi}-${k}`} className="min-h-28 border-b border-r border-stone-100 bg-stone-50/50" />)}
            </div>
          );
        })}
      </div>
      {range && <RangeDialog range={range} lists={lists} labels={labels} close={() => setRange(null)} />}
    </>
  );
}

function RangeDialog({ range, lists, labels, close }: { range: { from: string; to: string }; lists: List[]; labels: Label[]; close: () => void }) {
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const n = diff(range.from, range.to) + 1;
  const submit = (fd: FormData) => start(async () => {
    const r = await addRangeTask({
      title: String(fd.get("title") ?? ""), from: String(fd.get("from")), to: String(fd.get("to")),
      listId: Number(fd.get("list_id")) || null, important: fd.get("important") === "on",
      labels: fd.getAll("label").map(Number), note: String(fd.get("note") ?? ""),
    });
    if (r?.error) setErr(r.error); else close();
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <form action={submit} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-center">
          <h2 className="text-base font-semibold">기간 할 일 추가</h2>
          <button type="button" onClick={close} className="ml-auto text-xl leading-none text-stone-400 hover:text-stone-700">×</button>
        </div>
        <input name="title" autoFocus required placeholder="할 일 (예: 입학원서 접수)" className="input text-[15px]" />
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input type="date" name="from" defaultValue={range.from} className="input !w-auto !py-0.5" /> ~
          <input type="date" name="to" defaultValue={range.to} className="input !w-auto !py-0.5" />
          <span className="text-xs text-stone-500">{n}일</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <select name="list_id" defaultValue="" className="input !w-auto !py-0.5">
            <option value="">{DEFAULT_LIST}</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <label className="flex items-center gap-1"><input type="checkbox" name="important" /> 중요</label>
        </div>
        <LabelPicker all={labels} />
        <input name="note" placeholder="메모 (선택)" className="input" />
        <div className="flex items-center gap-3">
          <button className="btn" disabled={pending}>{pending ? "추가 중…" : "추가"}</button>
          <button type="button" onClick={close} className="btn-ghost">취소</button>
          {err && <span className="text-sm text-rose-700">{err}</span>}
        </div>
        <p className="text-xs text-stone-500">시작일부터 마감일까지 달력에 막대로 보이고, 기간 중에는 &lsquo;오늘&rsquo; 화면에도 나옵니다.</p>
      </form>
    </div>
  );
}
