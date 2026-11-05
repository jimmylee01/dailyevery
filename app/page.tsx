import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getChecks, getDayNote, getItems } from "@/lib/data";
import { getCounts, getDayAtts, getDoneOn, getLabelDone, getLabels, getLists, getTasks, color, DEFAULT_LIST, type Task, type View } from "@/lib/tasks";
import { addDays, dayLabel } from "@/lib/links";
import { isDate, todaySeoul } from "@/lib/time";
import { Sidebar } from "@/components/Sidebar";
import { AddTask, DoneList, DoneRow, TaskRow } from "@/components/Tasks";
import { DayNote } from "@/components/DayNote";
import { LinkPanel } from "@/components/LinkPanel";

const VIEWS: Record<string, { title: string; icon: string; cls: string }> = {
  today: { title: "오늘 할 일", icon: "☀", cls: "text-indigo-700" },
  important: { title: "중요", icon: "★", cls: "text-rose-700" },
  planned: { title: "계획된 일정", icon: "📅", cls: "text-sky-800" },
  inbox: { title: DEFAULT_LIST, icon: "🏠", cls: "text-indigo-700" },
  done: { title: "끝난 일", icon: "✓", cls: "text-emerald-700" },
};

export default async function Home({ searchParams }: { searchParams: Promise<{ v?: string; id?: string; day?: string }> }) {
  await requireUser();
  const today = todaySeoul();
  const sp = await searchParams;
  const v = (sp.v && (sp.v in VIEWS || sp.v === "list" || sp.v === "label") ? sp.v : "today") as View;
  const [counts, lists, labels] = await Promise.all([getCounts(today), getLists(), getLabels()]);
  const list = v === "list" ? lists.find((l) => l.id === Number(sp.id)) : undefined;
  const label = v === "label" ? labels.find((l) => l.id === Number(sp.id)) : undefined;
  if ((v === "list" && !list) || (v === "label" && !label)) notFound();
  const active = list ? `list${list.id}` : label ? `label${label.id}` : v;
  const head = list ? { title: list.name, icon: "●", cls: color(list.color).text } : label ? { title: label.name, icon: "#", cls: color(label.color).text } : VIEWS[v];

  const side = <Sidebar active={active} counts={counts} lists={lists} labels={labels} />;
  const title = (extra?: React.ReactNode) => (
    <div className="flex flex-wrap items-center gap-2">
      <h1 className={`text-2xl font-bold ${head.cls}`}><span className="mr-1.5">{head.icon}</span>{head.title}</h1>
      {extra}
    </div>
  );

  /* ── 오늘 할 일 (+ 오른쪽 링크) ── */
  if (v === "today") {
    const day = isDate(sp.day) ? sp.day : today;
    const future = day > today;
    const isToday = day === today;
    const [tasks, doneOn, note, items, checks, dayAtts] = await Promise.all([
      isToday ? getTasks("today", { today }) : future ? getTasks("planned", { today }).then((ts) => ts.filter((t) => t.due === day)) : Promise.resolve([] as Task[]),
      getDoneOn(day), getDayNote(day), getItems(), getChecks(day, day), getDayAtts(day),
    ]);
    const opened = Object.fromEntries(checks.filter((c) => c.opened_at).map((c) => [c.item_id, c.opened_at!]));
    const late = isToday ? tasks.filter((t) => t.due && t.due < today) : [];
    const rest = tasks.filter((t) => !(t.due && t.due < today));
    return (
      <div className="grid gap-5 lg:grid-cols-[210px_1fr_270px]">
        {side}
        <div className="min-w-0 space-y-4">
          {title(
            <span className="flex items-center gap-1 text-sm text-stone-500">
              <Link href={`/?day=${addDays(day, -1)}`} className="btn-ghost !px-1.5 !py-0">◀</Link>
              {dayLabel(day, true)}
              <Link href={`/?day=${addDays(day, 1)}`} className="btn-ghost !px-1.5 !py-0">▶</Link>
              {!isToday && <Link href="/" className="btn-ghost !py-0 text-xs">오늘로</Link>}
            </span>,
          )}
          {isToday && <AddTask view="today" lists={lists} labels={labels} placeholder="오늘 할 일 추가" />}
          {late.length > 0 && (
            <section className="space-y-1.5">
              <h2 className="text-xs font-semibold text-rose-700">마감 지남 {late.length}</h2>
              {late.map((t) => <TaskRow key={t.id} t={t} today={today} lists={lists} labels={labels} showMyDay={false} />)}
            </section>
          )}
          {future && (
            <section className="space-y-1.5">
              <h2 className="text-xs font-semibold text-sky-800">이날 마감인 할 일 {tasks.length}</h2>
              {tasks.map((t) => <TaskRow key={t.id} t={t} today={today} lists={lists} labels={labels} />)}
              {tasks.length === 0 && <p className="text-xs text-stone-400">없음 · 할 일을 열어 마감일을 이날로 정하면 여기 나옵니다.</p>}
            </section>
          )}
          {isToday && (
            <section className="space-y-1.5">
              {late.length > 0 && <h2 className="text-xs font-semibold text-stone-600">오늘</h2>}
              {rest.map((t) => <TaskRow key={t.id} t={t} today={today} lists={lists} labels={labels} showMyDay={false} />)}
              {tasks.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-400">오늘 할 일이 없습니다. 위에 적거나, 다른 목록의 할 일을 열어 &lsquo;☀ 오늘 할 일에 넣기&rsquo;를 체크하세요.</p>}
            </section>
          )}
          {doneOn.length > 0 && (
            <section className="space-y-1.5">
              <h2 className="text-xs font-semibold text-emerald-700">{isToday ? "오늘" : dayLabel(day)} 끝낸 일 {doneOn.length}</h2>
              {doneOn.map((t) => <DoneRow key={t.id} t={t} />)}
            </section>
          )}
          <DayNote key={`note-${day}`} day={day} body={note?.body ?? ""} updatedAt={note?.updated_at ?? null} atts={dayAtts}
            title={isToday ? "📝 오늘의 메모" : future ? `📝 ${dayLabel(day)} 메모` : `📝 ${dayLabel(day)} 메모`}
            hint={future ? `여기 적은 메모는 ${dayLabel(day)} 아침 8시쯤 카카오톡 · 이메일로 보내 드립니다 (설정 · 알림에서 켠 곳으로).` : undefined} />
        </div>
        <LinkPanel key={day} items={items} opened={opened} day={day} />
      </div>
    );
  }

  /* ── 끝난 일 ── */
  if (v === "done") {
    const tasks = await getTasks("done");
    return (
      <div className="grid gap-5 lg:grid-cols-[210px_1fr]">
        {side}
        <div className="min-w-0 space-y-4">
          {title(<span className="text-sm text-stone-500">최근 300개 · ✓를 누르면 다시 할 일로 되돌립니다</span>)}
          <DoneList tasks={tasks} />
        </div>
      </div>
    );
  }

  /* ── 중요 · 계획된 일정 · 작업 · 목록 ── */
  const tasks = await getTasks(v, { listId: list?.id, labelId: label?.id, today });
  const labelDone = label ? await getLabelDone(label.id) : [];
  let groups: [string, Task[], string][] = [["", tasks, ""]];
  if (v === "planned") {
    const tmr = addDays(today, 1), week = addDays(today, 6);
    groups = ([
      ["지남", tasks.filter((t) => t.due! < today), "text-rose-700"],
      ["오늘", tasks.filter((t) => t.due === today), "text-amber-700"],
      ["내일", tasks.filter((t) => t.due === tmr), "text-stone-700"],
      ["이번 주", tasks.filter((t) => t.due! > tmr && t.due! <= week), "text-stone-700"],
      ["나중에", tasks.filter((t) => t.due! > week), "text-stone-700"],
    ] as [string, Task[], string][]).filter(([, ts]) => ts.length);
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[210px_1fr]">
      {side}
      <div className="min-w-0 space-y-4">
        {title(<span className="text-sm text-stone-500">{tasks.length}개 남음</span>)}
        <AddTask key={active} view={v} listId={list?.id} labelId={label?.id} lists={lists} labels={labels} placeholder={v === "planned" ? "할 일 추가 (마감: 오늘, 바꾸려면 '날짜 · 목록')" : "할 일 추가"} />
        {groups.map(([g, ts, cls]) => (
          <section key={g || "_"} className="space-y-1.5">
            {g && <h2 className={`text-xs font-semibold ${cls}`}>{g} {ts.length}</h2>}
            {ts.map((t) => <TaskRow key={t.id} t={t} today={today} lists={lists} labels={labels} showList={v !== "list" && v !== "inbox"} />)}
          </section>
        ))}
        {tasks.length === 0 && <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-400">남은 할 일이 없습니다.</p>}
        {labelDone.length > 0 && (
          <section className="space-y-1.5 pt-2">
            <h2 className="text-xs font-semibold text-emerald-700">이 라벨로 끝낸 일 {labelDone.length}</h2>
            {labelDone.map((t) => <DoneRow key={t.id} t={t} showDate />)}
          </section>
        )}
      </div>
    </div>
  );
}
