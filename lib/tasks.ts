import { q } from "@/lib/db";
import { todaySeoul } from "@/lib/time";

import { COLORS, color, DEFAULT_LIST, type Att, type Label, type List, type Task, type View } from "@/lib/task-types";
export { COLORS, color, DEFAULT_LIST };
export type { Att, Label, List, Task, View };

const pad = (n: number) => String(n).padStart(2, "0");
export const isMonthStr = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
export function lastDay(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export const monthDate = (month: string, day: number) => `${month}-${pad(Math.min(day, lastDay(month)))}`;

/** 매달 반복 할 일을 그 달에 채워 넣기 (이미 있으면 그대로) */
export async function ensureMonth(month: string) {
  await q(
    `insert into tasks (title, list_id, due, month, note, important, repeat_id)
     select r.title, r.list_id,
            case when r.day is null then null else make_date(split_part($1,'-',1)::int, split_part($1,'-',2)::int,
              least(r.day, extract(day from (date_trunc('month', ($1 || '-01')::date) + interval '1 month - 1 day'))::int)) end,
            $1, r.note, r.important, r.id
     from repeat_tasks r
     where r.active and r.from_month <= $1
       and not exists (select 1 from tasks t where t.repeat_id = r.id and t.month = $1)
     on conflict do nothing`,
    [month]);
}

const SELECT = `select t.id, t.title, t.list_id, l.name as list_name, l.color as list_color, t.due::text, t.start_day::text, t.my_day::text, t.month,
  t.important, t.note, t.done_at, t.done_note, t.repeat_id,
  (select coalesce(json_agg(json_build_object('id', a.id, 'drive_id', a.drive_id, 'name', a.name, 'mime', a.mime, 'link', a.link) order by a.id), '[]'::json)
     from attachments a where a.task_id = t.id) as atts,
  (select coalesce(json_agg(json_build_object('id', lb.id, 'name', lb.name, 'color', lb.color) order by lb.sort, lb.id), '[]'::json)
     from task_labels tl join labels lb on lb.id = tl.label_id where tl.task_id = t.id) as labels
  from tasks t left join lists l on l.id = t.list_id`;

export async function getLists(): Promise<List[]> {
  return q<List>(`select l.id, l.name, l.color, l.sort, (select count(*)::int from tasks t where t.list_id = l.id and t.done_at is null and not t.hidden) as open
                  from lists l order by l.sort, l.id`);
}

export async function getCounts(today = todaySeoul()) {
  await ensureMonth(today.slice(0, 7));
  const [r] = await q<{ today: number; important: number; planned: number; inbox: number; overdue: number }>(
    `select count(*) filter (where my_day = $1 or due <= $1 or start_day <= $1)::int as today,
            count(*) filter (where important)::int as important,
            count(*) filter (where due is not null)::int as planned,
            count(*) filter (where list_id is null)::int as inbox,
            count(*) filter (where due < $1)::int as overdue
     from tasks where done_at is null and not hidden`, [today]);
  return r;
}

export async function getLabels(): Promise<Label[]> {
  return q<Label>(`select lb.id, lb.name, lb.color, lb.sort,
    (select count(*)::int from task_labels tl join tasks t on t.id = tl.task_id where tl.label_id = lb.id and t.done_at is null and not t.hidden) as open
    from labels lb order by lb.sort, lb.id`);
}

/** 라벨 붙은 끝낸 일 */
export async function getLabelDone(labelId: number): Promise<Task[]> {
  return q<Task>(`${SELECT} where t.done_at is not null and not t.hidden and exists (select 1 from task_labels tl where tl.task_id = t.id and tl.label_id = $1)
                  order by t.done_at desc limit 200`, [labelId]);
}

export async function getTasks(view: View, opts: { listId?: number; labelId?: number; today?: string } = {}): Promise<Task[]> {
  const today = opts.today ?? todaySeoul();
  const open = "t.done_at is null and not t.hidden";
  switch (view) {
    case "today":
      return q<Task>(`${SELECT} where ${open} and (t.my_day = $1 or t.due <= $1 or t.start_day <= $1) order by t.due nulls last, t.important desc, t.id`, [today]);
    case "important":
      return q<Task>(`${SELECT} where ${open} and t.important order by t.due nulls last, t.id`);
    case "planned":
      return q<Task>(`${SELECT} where ${open} and t.due is not null order by t.due, t.id`);
    case "inbox":
      return q<Task>(`${SELECT} where ${open} and t.list_id is null order by t.important desc, t.due nulls last, t.id`);
    case "list":
      return q<Task>(`${SELECT} where ${open} and t.list_id = $1 order by t.important desc, t.due nulls last, t.id`, [opts.listId ?? 0]);
    case "label":
      return q<Task>(`${SELECT} where ${open} and exists (select 1 from task_labels tl where tl.task_id = t.id and tl.label_id = $1)
                      order by t.due nulls last, t.important desc, t.id`, [opts.labelId ?? 0]);
    case "done":
      return q<Task>(`${SELECT} where t.done_at is not null and not t.hidden order by t.done_at desc limit 300`);
  }
}

/** 오늘 끝낸 일 (서울 기준) */
export async function getDoneOn(day: string): Promise<Task[]> {
  return q<Task>(`${SELECT} where not t.hidden and (t.done_at at time zone 'Asia/Seoul')::date = $1 order by t.done_at desc`, [day]);
}

/** 그 달 할 일: 마감일이 그 달이거나 그 달 할 일로 넣은 것 */
export async function getMonthTasks(month: string): Promise<Task[]> {
  await ensureMonth(month);
  return q<Task>(`${SELECT} where not t.hidden and (t.month = $1 or to_char(t.due, 'YYYY-MM') = $1
                    or (t.start_day is not null and to_char(t.start_day, 'YYYY-MM') <= $1 and to_char(t.due, 'YYYY-MM') >= $1))
                  order by t.done_at is not null, t.due nulls last, t.id`, [month]);
}

/** 그 달에 끝낸 일 날짜별 개수 */
export async function getDoneByDay(from: string, to: string): Promise<Map<string, number>> {
  const rows = await q<{ day: string; n: number }>(
    `select ((done_at at time zone 'Asia/Seoul')::date)::text as day, count(*)::int as n from tasks
     where not hidden and done_at is not null and (done_at at time zone 'Asia/Seoul')::date between $1 and $2 group by 1`, [from, to]);
  return new Map(rows.map((r) => [r.day, r.n]));
}

/** 그날 메모에 붙인 파일 */
export async function getDayAtts(day: string): Promise<Att[]> {
  return q<Att>("select id, drive_id, name, mime, link from attachments where day = $1 order by id", [day]);
}
export async function getDayAttCounts(from: string, to: string): Promise<Map<string, number>> {
  const rows = await q<{ day: string; n: number }>("select day::text, count(*)::int as n from attachments where day between $1 and $2 group by 1", [from, to]);
  return new Map(rows.map((r) => [r.day, r.n]));
}
