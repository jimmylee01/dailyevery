import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getDayNotes } from "@/lib/data";
import { getDayAttCounts, getDoneByDay, getLabels, getLists, getMonthTasks } from "@/lib/tasks";
import { addDays, dayLabel } from "@/lib/links";
import { todaySeoul } from "@/lib/time";
import { AddTask, TaskRow, DoneRow } from "@/components/Tasks";
import { MonthGrid, type CalItem } from "@/components/MonthGrid";

const pad = (n: number) => String(n).padStart(2, "0");
function monthOf(v: string | undefined, today: string): { y: number; m: number } {
  const r = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  if (r && Number(r[2]) >= 1 && Number(r[2]) <= 12) return { y: Number(r[1]), m: Number(r[2]) };
  return { y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) };
}
const shift = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1 + d, 1)); return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`; };

export default async function MonthPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireUser();
  const today = todaySeoul();
  const { y, m } = monthOf((await searchParams).m, today);
  const month = `${y}-${pad(m)}`;
  const first = `${month}-01`;
  const last = addDays(`${shift(y, m, 1)}-01`, -1);
  const [tasks, doneBy, notes, lists, attBy, labels] = await Promise.all([getMonthTasks(month), getDoneByDay(first, last), getDayNotes(first, last), getLists(), getDayAttCounts(first, last), getLabels()]);
  const noteBy = new Map(notes.map((n) => [n.day, n.body]));
  const item = (t: (typeof tasks)[number]): CalItem => ({ id: t.id, title: t.title, from: t.start_day ?? t.due!, to: t.due!, done: !!t.done_at, color: t.labels[0]?.color ?? t.list_color });
  const spans = tasks.filter((t) => t.start_day && t.due).map(item);
  const dues = tasks.filter((t) => !t.start_day && t.due).map(item);
  const lead = new Date(`${first}T00:00:00Z`).getUTCDay();
  const days: (string | null)[] = [...Array(lead).fill(null)];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  while (days.length % 7) days.push(null);
  const open = tasks.filter((t) => !t.done_at);
  const doneM = tasks.filter((t) => t.done_at);
  const doneTotal = [...doneBy.values()].reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/month?m=${shift(y, m, -1)}`} className="btn-ghost !px-2">◀</Link>
        <h1 className="text-xl font-semibold">{y}년 {m}월</h1>
        <Link href={`/month?m=${shift(y, m, 1)}`} className="btn-ghost !px-2">▶</Link>
        {month !== today.slice(0, 7) && <Link href="/month" className="btn-ghost text-sm">이번 달</Link>}
        <div className="ml-auto flex gap-4 text-sm">
          <span>이달 할 일 <b>{tasks.length}</b> · 남음 <b className={open.length ? "text-rose-700" : ""}>{open.length}</b></span>
          <span>끝낸 일 <b className="text-emerald-700">{doneTotal}</b>개</span>
          <span>메모 <b>{notes.length}</b>개</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-xs font-semibold text-stone-600">
          {["일", "월", "화", "수", "목", "금", "토"].map((w, i) => <div key={w} className={`py-1.5 ${i === 0 ? "text-rose-600" : i === 6 ? "text-sky-700" : ""}`}>{w}</div>)}
        </div>
        <MonthGrid days={days} today={today} spans={spans} dues={dues} lists={lists} labels={labels}
          doneBy={Object.fromEntries(doneBy)} notes={Object.fromEntries(noteBy)} atts={Object.fromEntries(attBy)} />
      </div>
      <p className="text-xs text-stone-500"><b>여러 날을 끌어서(드래그) 고르면 그 기간 할 일을 넣을 수 있습니다.</b> 할 일 앞 동그라미를 누르면 끝냄 / 되돌림. 작은 칸 = 그날 마감인 할 일 (빨강: 지남, 노랑: 남음, 회색: 끝남) · 막대 = 기간 할 일 · ✓숫자 = 그날 끝낸 일 · 날짜를 누르면 그날 할 일 · 끝낸 일 · 메모로 갑니다. 앞으로 올 날짜에 메모를 적어 두면 그날 아침 알림으로 보내 드립니다.</p>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{m}월에 챙길 것 <span className="text-sm font-normal text-stone-500">매달 하는 일은 &lsquo;매달 반복&rsquo;을 체크하면 다음 달에도 자동으로 들어갑니다</span></h2>
        <AddTask view="month" month={month} lists={lists} labels={labels} placeholder={`${m}월에 챙길 것 (예: 아파트 게시판 광고 비용 청구)`} />
        <div className="space-y-1.5">
          {open.map((t) => <TaskRow key={t.id} t={t} today={today} lists={lists} labels={labels} />)}
          {open.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 p-5 text-center text-sm text-stone-400">{m}월에 남은 일이 없습니다.</p>}
        </div>
        {doneM.length > 0 && (
          <details className="space-y-1.5">
            <summary className="cursor-pointer text-sm text-emerald-700">{m}월 할 일 중 끝낸 것 {doneM.length}개</summary>
            <div className="mt-1.5 space-y-1.5">{doneM.map((t) => <DoneRow key={t.id} t={t} showDate />)}</div>
          </details>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">{m}월 메모 모아 보기</h2>
        {notes.length === 0 && <p className="card p-6 text-center text-sm text-stone-400">이번 달 메모가 없습니다. 오늘 화면의 &lsquo;오늘의 메모&rsquo;에 적으면 여기에 모입니다.</p>}
        {[...notes].reverse().map((n) => (
          <div key={n.day} className="card p-3">
            <div className="mb-1 flex items-center gap-2 text-sm">
              <Link href={`/?day=${n.day}`} className="font-semibold text-brand hover:underline">{dayLabel(n.day, true)}</Link>
              {!!doneBy.get(n.day) && <span className="text-xs text-emerald-700">✓ {doneBy.get(n.day)}개 끝냄</span>}
            </div>
            <div className="whitespace-pre-line text-sm leading-relaxed text-stone-800">{n.body}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
