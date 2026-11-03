"use client";

import { startTransition, useActionState, useState } from "react";
import { addItem, importLinks, saveItem, type FormState, type ImportState } from "@/lib/actions";
import { linkKind, type Item } from "@/lib/links";

function Msg({ s }: { s: FormState }) {
  return <>{s?.error && <span className="text-sm text-rose-700">{s.error}</span>}{s?.ok && <span className="text-sm text-emerald-700">{s.ok}</span>}</>;
}

/** 메모장 · 노션에 적어 둔 목록 통째로 붙여넣기 */
export function ImportForm({ groups }: { groups: string[] }) {
  const [s, action, pending] = useActionState<ImportState, FormData>(importLinks, undefined);
  const [text, setText] = useState("");
  const [grp, setGrp] = useState("");
  const send = (mode: string) => {
    const fd = new FormData();
    fd.set("text", text); fd.set("grp", grp); fd.set("mode", mode);
    startTransition(() => action(fd));
  };
  return (
    <div className="space-y-2">
      <textarea className="input font-mono text-xs" rows={8} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={"14. 입학설명회\nhttps://docs.google.com/spreadsheets/d/...\n\n15. LIS 초등 여름캠프 신청서 (엑셀)\nhttps://docs.google.com/spreadsheets/d/..."} />
      <div className="flex flex-wrap items-center gap-2">
        <input list="grps" className="input !w-48" value={grp} onChange={(e) => setGrp(e.target.value)} placeholder="묶음 (선택, 예: 신청서)" />
        <datalist id="grps">{groups.map((g) => <option key={g} value={g} />)}</datalist>
        <button type="button" className="btn-ghost" disabled={pending || !text.trim()} onClick={() => send("preview")}>미리보기</button>
        <button type="button" className="btn" disabled={pending || !s?.preview?.length} onClick={() => send("apply")}>넣기</button>
        <Msg s={s} />
      </div>
      {s?.preview && (
        <table className="w-full border-collapse text-sm">
          <tbody>
            {s.preview.map((r, k) => (
              <tr key={k} className={r.dup ? "text-stone-400 line-through" : ""}>
                <td className="td w-10 text-right text-xs">{r.num}</td>
                <td className="td">{r.title}</td>
                <td className="td max-w-[380px] truncate text-xs text-stone-500">{r.url || <span className="text-amber-700">링크 없음</span>}</td>
                <td className="td text-xs">{r.dup ? "이미 있음" : <span className={`rounded px-1.5 ${linkKind(r.url).cls}`}>{linkKind(r.url).label}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function AddItemForm({ groups }: { groups: string[] }) {
  const [s, action, pending] = useActionState<FormState, FormData>(addItem, undefined);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[70px_1fr_2fr_160px_auto]">
      <input name="num" className="input" placeholder="번호" />
      <input name="title" className="input" placeholder="이름 (예: 간식 링크)" />
      <input name="url" className="input" placeholder="https://…" />
      <input name="grp" list="grps2" className="input" placeholder="묶음 (선택)" />
      <datalist id="grps2">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <button className="btn" disabled={pending}>추가</button>
      <input name="note" className="input sm:col-span-4" placeholder="설명 (선택, 오늘 화면에 작게 보임)" />
      <div className="self-center"><Msg s={s} /></div>
    </form>
  );
}

/** 한 줄 고치기 */
export function ItemRow({ item, groups }: { item: Item; groups: string[] }) {
  const [s, action, pending] = useActionState<FormState, FormData>(saveItem, undefined);
  const [dirty, setDirty] = useState(false);
  return (
    <form action={(fd) => { setDirty(false); action(fd); }} onChange={() => setDirty(true)}
      className={`grid items-center gap-1.5 border-b border-stone-100 px-3 py-2 sm:grid-cols-[56px_1fr_2fr_130px_60px_auto] ${item.active ? "" : "opacity-50"}`}>
      <input type="hidden" name="id" value={item.id} />
      <input name="num" defaultValue={item.num ?? ""} className="input !py-1 text-right" />
      <input name="title" defaultValue={item.title} className="input !py-1" />
      <div className="flex items-center gap-1">
        <input name="url" defaultValue={item.url} className="input !py-1 text-xs" />
        {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-brand" title="열기">↗</a>}
      </div>
      <input name="grp" list="grps3" defaultValue={item.grp} className="input !py-1 text-xs" placeholder="묶음" />
      <datalist id="grps3">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={item.active} /> 사용</label>
      <div className="flex items-center gap-1.5">
        <button className={dirty ? "btn !px-2 !py-0.5 text-xs" : "btn-ghost !px-2 !py-0.5 text-xs"} disabled={pending}>저장</button>
        {!dirty && s?.ok && <span className="text-xs text-emerald-700">✓</span>}
        {s?.error && <span className="text-xs text-rose-700">{s.error}</span>}
      </div>
      <input name="note" defaultValue={item.note} className="input !py-1 text-xs sm:col-span-4 sm:col-start-2" placeholder="설명 (선택)" />
    </form>
  );
}
