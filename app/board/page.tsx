import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getChecks, getItems, getSetting } from "@/lib/data";
import { addDays, dayLabel, hm, isWeekend } from "@/lib/links";
import { todaySeoul } from "@/lib/time";
import { saveSetting } from "@/lib/actions";

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireUser();
  const today = todaySeoul();
  const n = [7, 14, 30].includes(Number((await searchParams).days)) ? Number((await searchParams).days) : 14;
  const weekends = (await getSetting("board_weekends", "off")) === "on";
  const days: string[] = [];
  for (let d = today; days.length < n; d = addDays(d, -1)) if (weekends || !isWeekend(d) || d === today) days.push(d);
  days.reverse();
  const [items, checks] = await Promise.all([getItems(), getChecks(days[0], today)]);
  const by = new Map(checks.map((c) => [`${c.item_id}|${c.day}`, c]));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold">기록표</h1>
        <span className="text-sm text-stone-500">최근 {n}일{weekends ? "" : " (주말 빼고)"}</span>
        <div className="ml-auto flex items-center gap-1.5 text-sm">
          {[7, 14, 30].map((x) => (
            <Link key={x} href={`/board?days=${x}`} className={`rounded-md border px-2.5 py-0.5 ${x === n ? "border-brand bg-brand text-white" : "border-stone-300 bg-white"}`}>{x}일</Link>
          ))}
          <form action={saveSetting} className="ml-2">
            <input type="hidden" name="key" value="board_weekends" />
            <input type="hidden" name="value" value={weekends ? "off" : "on"} />
            <button className="btn-ghost !py-0.5 text-xs">{weekends ? "주말 빼기" : "주말도 보기"}</button>
          </form>
        </div>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="th sticky left-0 z-10 min-w-48">링크</th>
              {days.map((d) => {
                const done = items.filter((i) => by.get(`${i.id}|${d}`)?.checked_at).length;
                const full = items.length > 0 && done === items.length;
                return (
                  <th key={d} className={`th text-center ${d === today ? "!bg-blue-50" : ""}`}>
                    <Link href={`/?day=${d}`} className="hover:underline">{dayLabel(d)}</Link>
                    <div className={`text-[10px] font-normal ${full ? "text-emerald-700" : "text-stone-500"}`}>{done}/{items.length}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="hover:bg-stone-50">
                <td className="td sticky left-0 z-10 bg-white">
                  <span className="mr-1 text-xs text-stone-400">{i.num}</span>
                  {i.url ? <a href={i.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{i.title}</a> : i.title}
                </td>
                {days.map((d) => {
                  const c = by.get(`${i.id}|${d}`);
                  const title = [c?.checked_at && `${hm(c.checked_at)} 확인`, c?.opened_at && `${hm(c.opened_at)} 열어 봄`, c?.memo && `메모: ${c.memo}`].filter(Boolean).join("\n");
                  return (
                    <td key={d} title={title} className={`td text-center text-xs tabular-nums ${d === today ? "bg-blue-50/50" : ""}`}>
                      {c?.checked_at ? <span className="rounded bg-emerald-100 px-1 font-semibold text-emerald-800">{hm(c.checked_at)}</span>
                        : c?.opened_at ? <span className="text-amber-600">열어 봄</span>
                        : d < today ? <span className="text-rose-300">·</span> : ""}
                      {c?.memo && <span className="ml-0.5">📝</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-stone-500">초록 시각 = 그날 확인한 시각, &lsquo;열어 봄&rsquo; = 링크만 열고 체크는 안 함, 빨간 점 = 그날 확인 안 함. 칸에 마우스를 올리면 메모가 보이고, 날짜를 누르면 그날 목록으로 갑니다.</p>
    </div>
  );
}
