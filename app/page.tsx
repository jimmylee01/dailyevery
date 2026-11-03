import Link from "next/link";
import { requireUser } from "@/lib/session";
import { getChecks, getItems } from "@/lib/data";
import { addDays, dayLabel } from "@/lib/links";
import { isDate, todaySeoul } from "@/lib/time";
import { checkAll } from "@/lib/actions";
import { TodayList } from "@/components/TodayList";
import { ConfirmButton } from "@/components/ConfirmButton";

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  await requireUser();
  const today = todaySeoul();
  const sp = await searchParams;
  const day = isDate(sp.day) && sp.day <= today ? sp.day : today;
  const [items, checks] = await Promise.all([getItems(), getChecks(day, day)]);
  const by = new Map(checks.map((c) => [c.item_id, c]));
  const done = items.filter((i) => by.get(i.id)?.checked_at).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/?day=${addDays(day, -1)}`} className="btn-ghost !px-2">◀</Link>
        <h1 className="text-xl font-semibold">{dayLabel(day, true)}</h1>
        {day < today && <Link href={`/?day=${addDays(day, 1)}`} className="btn-ghost !px-2">▶</Link>}
        {day !== today && <Link href="/" className="btn-ghost text-sm">오늘로</Link>}
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm"><b className="text-lg tabular-nums text-emerald-700">{done}</b> / {items.length} 확인</div>
            <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} /></div>
          </div>
          {done < items.length && items.length > 0 && (
            <form action={checkAll}>
              <input type="hidden" name="day" value={day} />
              <ConfirmButton message={`남은 ${items.length - done}개를 모두 확인으로 표시할까요?`} className="btn-ghost text-sm">남은 것 모두 확인</ConfirmButton>
            </form>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-stone-500">
          아직 링크가 없습니다. <Link href="/links" className="font-medium text-brand hover:underline">링크 관리</Link>에서 목록을 붙여넣어 한 번에 넣으세요.
        </div>
      ) : (
        <TodayList key={day} day={day} rows={items.map((item) => ({ item, check: by.get(item.id) ?? null }))} />
      )}
      <p className="text-xs text-stone-500">이름을 누르면 새 탭으로 열리고 &lsquo;열어 봄&rsquo; 시각이 남습니다. 동그라미를 누르면 확인 시각이 기록됩니다 (다시 누르면 취소). 지난 날짜도 ◀로 가서 고칠 수 있습니다.</p>
    </div>
  );
}
