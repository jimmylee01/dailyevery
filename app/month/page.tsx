import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getChecks, getDayNotes, getItems } from "@/lib/data";
import { addDays, dayLabel, isWeekend } from "@/lib/links";
import { todaySeoul } from "@/lib/time";

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
  const first = `${y}-${pad(m)}-01`;
  const last = addDays(`${shift(y, m, 1)}-01`, -1);
  const [items, checks, notes] = await Promise.all([getItems(), getChecks(first, last), getDayNotes(first, last)]);
  const total = items.length;
  const doneBy = new Map<string, number>();
  for (const c of checks) if (c.checked_at && items.some((i) => i.id === c.item_id)) doneBy.set(c.day, (doneBy.get(c.day) ?? 0) + 1);
  const noteBy = new Map(notes.map((n) => [n.day, n.body]));
  // 달력: 일요일 시작
  const lead = new Date(`${first}T00:00:00Z`).getUTCDay();
  const days: (string | null)[] = [...Array(lead).fill(null)];
  for (let d = first; d <= last; d = addDays(d, 1)) days.push(d);
  while (days.length % 7) days.push(null);
  // 이번 달 요약 (오늘까지, 평일 기준)
  const past = days.filter((d): d is string => !!d && d <= today && !isWeekend(d));
  const full = past.filter((d) => total > 0 && (doneBy.get(d) ?? 0) >= total).length;
  const rate = past.length && total ? Math.round((past.reduce((a, d) => a + Math.min(total, doneBy.get(d) ?? 0), 0) / (past.length * total)) * 100) : 0;
  const color = (d: string) => {
    if (d > today || !total) return "";
    const n = doneBy.get(d) ?? 0;
    if (n >= total) return "bg-emerald-100";
    if (n > 0) return "bg-amber-50";
    return isWeekend(d) ? "" : "bg-rose-50";
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/month?m=${shift(y, m, -1)}`} className="btn-ghost !px-2">◀</Link>
        <h1 className="text-xl font-semibold">{y}년 {m}월</h1>
        <Link href={`/month?m=${shift(y, m, 1)}`} className="btn-ghost !px-2">▶</Link>
        {`${y}-${pad(m)}` !== today.slice(0, 7) && <Link href="/month" className="btn-ghost text-sm">이번 달</Link>}
        <div className="ml-auto flex gap-4 text-sm">
          <span>평일 <b>{past.length}</b>일 중 모두 확인 <b className="text-emerald-700">{full}</b>일</span>
          <span>확인율 <b className="text-emerald-700">{rate}%</b></span>
          <span>메모 <b>{notes.length}</b>개</span>
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-xs font-semibold text-stone-600">
          {["일", "월", "화", "수", "목", "금", "토"].map((w, i) => <div key={w} className={`py-1.5 ${i === 0 ? "text-rose-600" : i === 6 ? "text-sky-700" : ""}`}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, k) => d ? (
            <Link key={d} href={d <= today ? `/?day=${d}` : "#"} className={`min-h-24 border-b border-r border-stone-100 p-1.5 text-left hover:ring-2 hover:ring-inset hover:ring-brand ${color(d)} ${d === today ? "ring-2 ring-inset ring-brand" : ""}`}>
              <div className="flex items-baseline gap-1">
                <span className={`text-sm font-semibold ${k % 7 === 0 ? "text-rose-600" : k % 7 === 6 ? "text-sky-700" : ""}`}>{Number(d.slice(8))}</span>
                {d <= today && total > 0 && <span className="ml-auto text-[11px] tabular-nums text-stone-600">{doneBy.get(d) ?? 0}/{total}</span>}
              </div>
              {noteBy.get(d) && <div className="mt-1 line-clamp-3 whitespace-pre-line text-[11px] leading-snug text-stone-700">📝 {noteBy.get(d)}</div>}
            </Link>
          ) : <div key={`e${k}`} className="min-h-24 border-b border-r border-stone-100 bg-stone-50/50" />)}
        </div>
      </div>
      <p className="text-xs text-stone-500">초록 = 모두 확인, 노랑 = 일부 확인, 빨강 = 확인 안 함(평일). 날짜를 누르면 그날 목록과 메모로 갑니다.</p>
      <section className="space-y-2">
        <h2 className="text-base font-semibold">{m}월 메모 모아 보기</h2>
        {notes.length === 0 && <p className="card p-6 text-center text-sm text-stone-400">이번 달 메모가 없습니다. 오늘 화면의 &lsquo;오늘의 메모&rsquo;에 적으면 여기에 모입니다.</p>}
        {[...notes].reverse().map((n) => (
          <div key={n.day} className="card p-3">
            <div className="mb-1 flex items-center gap-2 text-sm">
              <Link href={`/?day=${n.day}`} className="font-semibold text-brand hover:underline">{dayLabel(n.day, true)}</Link>
              {total > 0 && <span className="text-xs text-stone-500">{doneBy.get(n.day) ?? 0}/{total} 확인</span>}
            </div>
            <div className="whitespace-pre-line text-sm leading-relaxed text-stone-800">{n.body}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
