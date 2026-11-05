"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { addTask, completeTask, createLabel, deleteTask, reopenTask, saveDoneNote, saveTask, toggleImportant } from "@/lib/actions-tasks";
import { color, DEFAULT_LIST, type Label, type List, type Task } from "@/lib/task-types";
import { dayLabel, hm } from "@/lib/links";
import { Attachments } from "@/components/Attachments";

type S = { error?: string; ok?: string } | undefined;
const Msg = ({ s }: { s?: S }) =>
  s?.error ? <span className="text-sm text-rose-700">{s.error}</span> : s?.ok ? <span className="text-sm text-emerald-700">{s.ok}</span> : null;

const Star = ({ on }: { on: boolean }) => (
  <svg viewBox="0 0 24 24" className={`h-5 w-5 ${on ? "fill-rose-700 text-rose-700" : "fill-none text-stone-400"}`} stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinejoin="round" d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
  </svg>
);

/* ───────── 라벨 ───────── */

export function LabelChips({ labels, small = false }: { labels: Label[]; small?: boolean }) {
  if (!labels.length) return null;
  return (
    <>
      {labels.map((l) => {
        const c = color(l.color);
        return (
          <span key={l.id} className={`inline-flex items-center gap-1 rounded-full px-1.5 ${small ? "text-[10px]" : "text-[11px]"} font-medium ${c.bg} ${c.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />{l.name}
          </span>
        );
      })}
    </>
  );
}

/** 라벨 고르기 (눌러서 켜고 끄기) + 바로 새 라벨 만들기 */
export function LabelPicker({ all, initial = [] }: { all: Label[]; initial?: number[] }) {
  const [list, setList] = useState(all);
  const [on, setOn] = useState<number[]>(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const make = () => start(async () => {
    const r = await createLabel(name);
    if ("error" in r) { setErr(r.error); return; }
    setList((x) => (x.some((y) => y.id === r.id) ? x : [...x, r]));
    setOn((x) => [...new Set([...x, r.id])]);
    setName(""); setAdding(false); setErr("");
  });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-stone-500">라벨</span>
      <input type="hidden" name="labels_on" value="1" />
      {on.map((id) => <input key={id} type="hidden" name="label" value={id} />)}
      {list.map((l) => {
        const c = color(l.color); const sel = on.includes(l.id);
        return (
          <button key={l.id} type="button" onClick={() => setOn((x) => (sel ? x.filter((y) => y !== l.id) : [...x, l.id]))}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${sel ? `${c.bg} ${c.text} border-current font-semibold` : "border-stone-200 bg-white text-stone-500 hover:border-stone-400"}`}>
            <span className={`h-2 w-2 rounded-full ${c.dot}`} />{l.name}{sel && " ✓"}
          </button>
        );
      })}
      {adding ? (
        <span className="inline-flex items-center gap-1">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="새 라벨 이름"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); make(); } if (e.key === "Escape") setAdding(false); }}
            className="input !w-32 !py-0.5 text-xs" />
          <button type="button" onClick={make} disabled={pending} className="text-xs text-brand">만들기</button>
          {err && <span className="text-xs text-rose-700">{err}</span>}
        </span>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="rounded-full border border-dashed border-stone-300 px-2 py-0.5 text-xs text-stone-500 hover:border-brand hover:text-brand">＋ 새 라벨</button>
      )}
    </div>
  );
}

/* ───────── 빠른 추가 ───────── */

export function AddTask({ view, listId, labelId, month, lists, labels = [], placeholder = "할 일 추가" }: { view: string; listId?: number; labelId?: number; month?: string; lists: List[]; labels?: Label[]; placeholder?: string }) {
  const [s, action, pending] = useActionState(addTask, undefined);
  const [more, setMore] = useState(!!month);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={async (fd) => { await action(fd); ref.current?.reset(); ref.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus(); }}
      className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm">
      <input type="hidden" name="view" value={view} />
      {month && <input type="hidden" name="month" value={month} />}
      <div className="flex items-center gap-2">
        <span className="text-xl leading-none text-brand">＋</span>
        <input name="title" className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-brand/70" placeholder={placeholder} autoComplete="off" />
        {!month && <button type="button" className="text-xs text-stone-500 hover:text-brand" onClick={() => setMore(!more)}>{more ? "간단히" : "날짜 · 목록 · 라벨"}</button>}
        <button className="btn !py-1 text-sm" disabled={pending}>추가</button>
      </div>
      {more && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-2 text-sm">
          {month ? (
            <label className="flex items-center gap-1">날짜 <input name="day" type="number" min={1} max={31} className="input !w-16 !py-0.5 text-right" placeholder="일" />일</label>
          ) : (
            <label className="flex items-center gap-1">마감 <input name="due" type="date" className="input !w-auto !py-0.5" /></label>
          )}
          <select name="list_id" defaultValue={listId ?? ""} className="input !w-auto !py-0.5">
            <option value="">{DEFAULT_LIST}</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <label className="flex items-center gap-1"><input type="checkbox" name="important" defaultChecked={view === "important"} /> 중요</label>
          {month && <label className="flex items-center gap-1"><input type="checkbox" name="repeat" /> 매달 반복</label>}
          <input name="note" className="input min-w-40 flex-1 !py-0.5" placeholder="메모 (선택)" />
          <div className="basis-full"><LabelPicker all={labels} initial={labelId ? [labelId] : []} /></div>
        </div>
      )}
      {!more && labelId && <input type="hidden" name="label" value={labelId} />}
      {!more && listId && <input type="hidden" name="list_id" value={listId} />}
      {s && <div className="mt-1"><Msg s={s} /></div>}
    </form>
  );
}

/* ───────── 한 줄 ───────── */

function dueLabel(due: string, today: string) {
  if (due === today) return { t: "오늘", cls: "text-amber-700 font-semibold" };
  if (due < today) return { t: `${dayLabel(due)} · 지남`, cls: "text-rose-700 font-semibold" };
  return { t: dayLabel(due), cls: "text-stone-500" };
}

export function TaskRow({ t, today, lists, labels = [], showList = true, showMyDay = true }: { t: Task; today: string; lists: List[]; labels?: Label[]; showList?: boolean; showMyDay?: boolean }) {
  const [mode, setMode] = useState<"" | "done" | "edit">("");
  const [pending, start] = useTransition();
  const [imp, setImp] = useState(t.important);
  const [gone, setGone] = useState(false);
  const memoRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (mode === "done") memoRef.current?.focus(); }, [mode]);
  if (gone) return null;
  const c = color(t.list_color);
  const due = t.due ? dueLabel(t.due, today) : null;
  const finish = () => { const m = memoRef.current?.value ?? ""; setGone(true); start(() => completeTask(t.id, m)); };
  return (
    <div className={`rounded-lg border bg-white shadow-sm transition ${mode ? "border-brand/40" : "border-stone-200"} ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button type="button" title="끝내기" onClick={() => setMode(mode === "done" ? "" : "done")}
          className={`group flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${mode === "done" ? "border-emerald-600 bg-emerald-600 text-white" : "border-stone-400 hover:border-emerald-600"}`}>
          <span className={`text-[11px] leading-none ${mode === "done" ? "" : "text-transparent group-hover:text-emerald-600"}`}>✓</span>
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setMode(mode === "edit" ? "" : "edit")}>
          <div className="truncate text-[15px] text-stone-900">{t.title}</div>
          <div className="flex flex-wrap items-center gap-x-2 text-xs">
            <LabelChips labels={t.labels} />
            {showList && <span className={c.text}>{t.list_name ?? DEFAULT_LIST}</span>}
            {showMyDay && t.my_day === today && <span className="text-indigo-600">☀ 오늘 할 일</span>}
            {due && <span className={due.cls}>📅 {due.t}</span>}
            {t.repeat_id && <span className="text-stone-500">🔁 매달</span>}
            {t.note && <span className="truncate text-stone-500">📝 {t.note.split("\n")[0]}</span>}
            {t.atts.length > 0 && <span className="text-stone-500">📎 {t.atts.length}</span>}
          </div>
        </button>
        <button type="button" title={imp ? "중요 해제" : "중요"} onClick={() => { setImp(!imp); start(() => toggleImportant(t.id)); }} className="shrink-0 p-1">
          <Star on={imp} />
        </button>
      </div>
      {mode === "done" && (
        <div className="flex flex-wrap items-center gap-2 border-t border-emerald-100 bg-emerald-50/60 px-3 py-2">
          <span className="text-sm font-semibold text-emerald-800">끝! 어떻게 끝냈나요?</span>
          <input ref={memoRef} className="input min-w-48 flex-1 !py-1 text-sm" placeholder="예: 카톡으로 전달, 그룹웨어 기안 올림 (안 써도 됨)"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); finish(); } if (e.key === "Escape") setMode(""); }} />
          <button type="button" className="btn !bg-emerald-700 !py-1 text-sm" onClick={finish}>완료</button>
          <button type="button" className="btn-ghost !py-1 text-sm" onClick={() => setMode("")}>취소</button>
        </div>
      )}
      {mode === "edit" && <Editor t={t} lists={lists} labels={labels} today={today} imp={imp} onClose={() => setMode("")} onGone={() => setGone(true)} />}
    </div>
  );
}

function Editor({ t, lists, labels, today, imp, onClose, onGone }: { t: Task; lists: List[]; labels: Label[]; today: string; imp: boolean; onClose: () => void; onGone: () => void }) {
  const [s, action, pending] = useActionState(async (p: S, fd: FormData) => { const r = await saveTask(p, fd); if (r?.ok) onClose(); return r; }, undefined);
  const [, start] = useTransition();
  return (
    <form action={action} className="space-y-2 border-t border-stone-100 bg-stone-50/60 px-3 py-3 text-sm">
      <input type="hidden" name="id" value={t.id} />
      <input name="title" defaultValue={t.title} className="input font-medium" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">목록
          <select name="list_id" defaultValue={t.list_id ?? ""} className="input !w-auto !py-0.5">
            <option value="">{DEFAULT_LIST}</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1">마감 <input type="date" name="due" defaultValue={t.due ?? ""} className="input !w-auto !py-0.5" /></label>
        <label className="flex items-center gap-1"><input type="checkbox" name="important" defaultChecked={imp} /> 중요</label>
        <label className="flex items-center gap-1"><input type="checkbox" name="my_day" defaultChecked={t.my_day === today} /> ☀ 오늘 할 일에 넣기</label>
        {t.repeat_id && <label className="flex items-center gap-1"><input type="checkbox" name="apply_repeat" /> 다음 달부터도 이렇게 (날짜는 &lsquo;일&rsquo;만)</label>}
      </div>
      <LabelPicker all={labels} initial={t.labels.map((l) => l.id)} />
      <textarea name="note" defaultValue={t.note} rows={Math.max(2, t.note.split("\n").length)} className="input" placeholder="메모" />
      <Attachments target={{ taskId: t.id }} items={t.atts} />
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn !py-1" disabled={pending}>저장</button>
        <button type="button" className="btn-ghost !py-1" onClick={onClose}>닫기</button>
        <Msg s={s} />
        <span className="ml-auto flex gap-3 text-xs">
          {t.repeat_id ? (
            <>
              <button type="button" className="text-stone-500 hover:text-rose-700" onClick={() => { if (confirm("이번 달 것만 지울까요? (다음 달에는 다시 나옵니다)")) { onGone(); start(() => deleteTask(t.id, "one")); } }}>이번 것만 지우기</button>
              <button type="button" className="text-stone-500 hover:text-rose-700" onClick={() => { if (confirm("매달 반복을 그만둘까요? 아직 안 한 것도 지워집니다.")) { onGone(); start(() => deleteTask(t.id, "repeat")); } }}>매달 반복 그만</button>
            </>
          ) : (
            <button type="button" className="text-stone-500 hover:text-rose-700" onClick={() => { if (confirm(`'${t.title}'을(를) 지울까요?`)) { onGone(); start(() => deleteTask(t.id)); } }}>지우기</button>
          )}
        </span>
      </div>
    </form>
  );
}

/* ───────── 끝난 일 ───────── */

const seoulDay = (ts: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(ts));

function DoneMemo({ id, memo }: { id: number; memo: string }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(memo);
  const [, start] = useTransition();
  const save = () => { setEdit(false); if (v !== memo) start(() => saveDoneNote(id, v)); };
  if (edit) return (
    <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) save(); if (e.key === "Escape") { setV(memo); setEdit(false); } }}
      className="input mt-1 !py-0.5 text-sm" placeholder="어떻게 끝냈는지" />
  );
  return v
    ? <button type="button" onClick={() => setEdit(true)} className="mt-0.5 block text-left text-sm text-emerald-800 hover:underline">💬 {v}</button>
    : <button type="button" onClick={() => setEdit(true)} className="mt-0.5 block text-xs text-stone-400 hover:text-brand">+ 어떻게 끝냈는지 메모</button>;
}

export function DoneRow({ t, showDate = false }: { t: Task; showDate?: boolean }) {
  const [, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;
  const c = color(t.list_color);
  return (
    <div className="flex items-start gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 shadow-sm">
      <button type="button" title="되돌리기 (다시 할 일로)" onClick={() => { if (confirm(`'${t.title}'을(를) 다시 할 일로 되돌릴까요?`)) { setGone(true); start(() => reopenTask(t.id)); } }}
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] text-white hover:bg-stone-400">✓</button>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] text-stone-500 line-through decoration-stone-300">{t.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 text-xs">
          <LabelChips labels={t.labels} />
          <span className={c.text}>{t.list_name ?? DEFAULT_LIST}</span>
          <span className="font-medium text-emerald-700">{showDate ? `${dayLabel(seoulDay(t.done_at!))} ` : ""}{hm(t.done_at)} 끝냄</span>
          {t.due && <span className="text-stone-400">마감 {dayLabel(t.due)}</span>}
        </div>
        {t.note && <div className="mt-1 whitespace-pre-line rounded bg-stone-50 px-2 py-1 text-sm text-stone-600">📝 {t.note}</div>}
        <DoneMemo id={t.id} memo={t.done_note} />
        <div className="mt-1.5"><Attachments target={{ taskId: t.id }} items={t.atts} label="결과 사진 · 파일" compact /></div>
      </div>
    </div>
  );
}

export function DoneList({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <p className="py-10 text-center text-sm text-stone-400">아직 끝낸 일이 없습니다.</p>;
  const days = [...new Set(tasks.map((t) => seoulDay(t.done_at!)))];
  return (
    <div className="space-y-5">
      {days.map((d) => {
        const ts = tasks.filter((t) => seoulDay(t.done_at!) === d);
        return (
          <section key={d} className="space-y-1.5">
            <h3 className="text-sm font-semibold text-stone-600">{dayLabel(d, true)} <span className="font-normal text-stone-400">{ts.length}개</span></h3>
            {ts.map((t) => <DoneRow key={t.id} t={t} />)}
          </section>
        );
      })}
    </div>
  );
}
