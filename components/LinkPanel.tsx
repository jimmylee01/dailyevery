"use client";

import { useOptimistic, useTransition } from "react";
import { markOpened } from "@/lib/actions";
import { hm, linkKind, type Item } from "@/lib/links";

/** 오늘 볼 링크: 누르면 새 탭으로 열리고, 오늘 연 시각만 작게 남음 (체크 아님) */
export function LinkPanel({ items, opened, day }: { items: Item[]; opened: Record<number, string>; day: string }) {
  const [, start] = useTransition();
  const [op, setOp] = useOptimistic(opened, (cur: Record<number, string>, id: number) => (cur[id] ? cur : { ...cur, [id]: new Date().toISOString() }));
  const groups = [...new Set(items.map((i) => i.grp))];
  const seen = items.filter((i) => op[i.id]).length;
  return (
    <aside className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-stone-700">🔗 오늘 볼 링크</h2>
        <span className="text-xs text-stone-500">{seen}/{items.length} 열어 봄</span>
      </div>
      {items.length === 0 && <p className="text-xs text-stone-400">링크 관리에서 넣으면 여기 나옵니다.</p>}
      {groups.map((g) => (
        <div key={g || "_"} className="card overflow-hidden">
          {g && <div className="border-b border-stone-100 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-600">{g}</div>}
          {items.filter((i) => i.grp === g).map((i) => {
            const k = linkKind(i.url);
            const at = op[i.id];
            return (
              <a key={i.id} href={i.url || undefined} target="_blank" rel="noopener noreferrer" title={i.note || i.url}
                onClick={() => { if (i.url) start(async () => { setOp(i.id); await markOpened(i.id, day); }); }}
                className="flex items-center gap-2 border-b border-stone-100 px-3 py-2 text-sm last:border-0 hover:bg-indigo-50/60">
                <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-stone-400">{i.num ?? ""}</span>
                <span className="shrink-0 text-xs" title={k.label}>{k.icon}</span>
                <span className={`min-w-0 flex-1 truncate ${at ? "text-stone-500" : "text-stone-900"}`}>{i.title}</span>
                {at && <span className="shrink-0 text-[10px] tabular-nums text-stone-400">{hm(at)}</span>}
              </a>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
