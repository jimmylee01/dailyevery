"use client";

import { useOptimistic, useState, useTransition } from "react";
import { markOpened, saveMemo, toggleCheck } from "@/lib/actions";
import { hm, linkKind, type Check, type Item } from "@/lib/links";

type Row = { item: Item; check: Check | null };

/** 오늘 목록: 이름을 누르면 새 탭으로 열리고 '열어 봄' 기록, ✓를 누르면 확인 시각 기록 */
export function TodayList({ rows, day }: { rows: Row[]; day: string }) {
  const [, start] = useTransition();
  const [opt, setOpt] = useOptimistic(rows, (cur: Row[], a: { id: number; kind: "check" | "open" }) =>
    cur.map((r) => {
      if (r.item.id !== a.id) return r;
      const c: Check = r.check ?? { item_id: a.id, day, checked_at: null, opened_at: null, memo: null };
      const now = new Date().toISOString();
      return { ...r, check: a.kind === "check" ? { ...c, checked_at: c.checked_at ? null : now } : { ...c, opened_at: c.opened_at ?? now } };
    }));
  const groups = [...new Set(opt.map((r) => r.item.grp))];
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g || "_"} className="card overflow-hidden">
          {g && <h2 className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-700">{g}</h2>}
          <ul>
            {opt.filter((r) => r.item.grp === g).map(({ item, check }) => {
              const done = !!check?.checked_at;
              const k = linkKind(item.url);
              return (
                <li key={item.id} className={`flex items-center gap-3 border-b border-stone-100 px-4 py-2.5 last:border-0 ${done ? "bg-emerald-50/50" : ""}`}>
                  <button
                    type="button"
                    onClick={() => start(async () => { setOpt({ id: item.id, kind: "check" }); await toggleCheck(item.id, day); })}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-base font-bold transition ${done ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-300 text-transparent hover:border-emerald-500 hover:text-emerald-300"}`}
                    title={done ? "확인 취소" : "확인"}
                  >✓</button>
                  <span className="w-7 shrink-0 text-right text-xs tabular-nums text-stone-400">{item.num ?? ""}</span>
                  <div className="min-w-0 flex-1">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        onClick={() => start(async () => { setOpt({ id: item.id, kind: "open" }); await markOpened(item.id, day); })}
                        className={`font-medium hover:underline ${done ? "text-stone-500" : "text-stone-900"}`}>{item.title}</a>
                    ) : <span className="font-medium">{item.title}</span>}
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] ${k.cls}`}>{k.icon} {k.label}</span>
                    {item.note && <div className="truncate text-xs text-stone-500">{item.note}</div>}
                    <Memo itemId={item.id} day={day} memo={check?.memo ?? ""} />
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums">
                    {done && <div className="font-semibold text-emerald-700">{hm(check!.checked_at)} 확인</div>}
                    {check?.opened_at && <div className="text-stone-400">{hm(check.opened_at)} 열어 봄</div>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Memo({ itemId, day, memo }: { itemId: number; day: string; memo: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(memo);
  const [pending, start] = useTransition();
  if (!open) {
    return memo
      ? <button type="button" onClick={() => setOpen(true)} className="mt-0.5 block max-w-full truncate text-left text-xs text-sky-800">📝 {memo}</button>
      : <button type="button" onClick={() => setOpen(true)} className="mt-0.5 text-[11px] text-stone-400 hover:text-sky-700">+ 메모</button>;
  }
  return (
    <form className="mt-1 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); start(async () => { await saveMemo(itemId, day, v); setOpen(false); }); }}>
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} className="input !py-1 text-xs" placeholder="예: 새 신청 3건 · 교복 사이즈 문의 회신함" />
      <button className="btn !py-1 text-xs" disabled={pending}>저장</button>
      <button type="button" className="btn-ghost !py-1 text-xs" onClick={() => { setV(memo); setOpen(false); }}>취소</button>
    </form>
  );
}
