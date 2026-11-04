"use client";

import { useActionState, useRef, useState } from "react";
import { addList, deleteList, saveList } from "@/lib/actions-tasks";
import { COLORS, type List } from "@/lib/task-types";

const NAMES: Record<string, string> = { indigo: "남색", rose: "빨강", emerald: "초록", amber: "노랑", sky: "하늘", violet: "보라", stone: "회색" };
const ColorPick = ({ value }: { value?: string }) => (
  <select name="color" defaultValue={value ?? "indigo"} className="input !w-auto !py-0.5 text-sm">
    {Object.keys(COLORS).map((c) => <option key={c} value={c}>{NAMES[c]}</option>)}
  </select>
);

export function AddListForm() {
  const [open, setOpen] = useState(false);
  const [s, action, pending] = useActionState(addList, undefined);
  const ref = useRef<HTMLFormElement>(null);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="mt-1 flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-brand hover:bg-white/60"><span className="w-5 text-center">＋</span>새 목록</button>;
  return (
    <form ref={ref} action={async (fd) => { await action(fd); ref.current?.reset(); setOpen(false); }} className="mt-1 space-y-1.5 rounded-md bg-white p-2">
      <input name="name" autoFocus className="input !py-1 text-sm" placeholder="예: CAPA, 행정업무" />
      <div className="flex items-center gap-1.5">
        <ColorPick />
        <button className="btn !px-2 !py-0.5 text-xs" disabled={pending}>만들기</button>
        <button type="button" className="text-xs text-stone-500" onClick={() => setOpen(false)}>취소</button>
      </div>
      {s?.error && <p className="text-xs text-rose-700">{s.error}</p>}
    </form>
  );
}

export function ListRow({ l }: { l: List }) {
  const [s, action, pending] = useActionState(saveList, undefined);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-stone-100 py-2 last:border-0">
      <form action={action} className="flex flex-1 flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={l.id} />
        <input name="name" defaultValue={l.name} className="input !w-48 !py-1 text-sm" />
        <ColorPick value={l.color} />
        <label className="flex items-center gap-1 text-xs text-stone-500">순서 <input name="sort" type="number" defaultValue={l.sort} className="input !w-16 !py-0.5 text-right" /></label>
        <button className="btn !py-0.5 text-sm" disabled={pending}>저장</button>
        <span className="text-xs text-stone-500">남은 일 {l.open}</span>
        {s?.ok && <span className="text-xs text-emerald-700">{s.ok}</span>}
        {s?.error && <span className="text-xs text-rose-700">{s.error}</span>}
      </form>
      <form action={deleteList} onSubmit={(e) => { if (!confirm(`'${l.name}' 목록을 지울까요? 안의 할 일은 '작업'으로 옮겨집니다.`)) e.preventDefault(); }}>
        <input type="hidden" name="id" value={l.id} />
        <button className="text-xs text-stone-400 hover:text-rose-700">지우기</button>
      </form>
    </div>
  );
}
