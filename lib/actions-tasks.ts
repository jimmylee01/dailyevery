"use server";

import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { ensureMonth, isMonthStr, monthDate } from "@/lib/tasks";
import { COLORS } from "@/lib/task-types";
import { isDate, todaySeoul } from "@/lib/time";
import { sendReminder } from "@/lib/notify";

export type FormState = { error?: string; ok?: string } | undefined;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const dayNum = (v: string) => { const n = Number(v); return v && Number.isInteger(n) && n >= 1 && n <= 31 ? n : null; };
const listOf = (v: string) => (Number(v) > 0 ? Number(v) : null);
const done = () => revalidatePath("/", "layout");

/* ───────── 할 일 ───────── */

/** 빠른 추가: 지금 보고 있는 화면에 맞춰 (오늘 · 중요 · 계획 · 목록 · 그 달) */
export async function addTask(_p: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const title = str(fd, "title").slice(0, 300);
  if (!title) return { error: "할 일을 적으세요." };
  const today = todaySeoul();
  const view = str(fd, "view");
  const list = listOf(str(fd, "list_id"));
  const note = str(fd, "note").slice(0, 2000);
  let due = isDate(str(fd, "due")) ? str(fd, "due") : null;
  let month: string | null = null;
  if (isMonthStr(str(fd, "month"))) {
    month = str(fd, "month");
    const d = dayNum(str(fd, "day"));
    due = d ? monthDate(month, d) : null;
    if (fd.get("repeat") === "on") {
      await q("insert into repeat_tasks (title, list_id, day, note, important, from_month) values ($1,$2,$3,$4,$5,$6)",
        [title, list, d, note, fd.get("important") === "on", month]);
      await ensureMonth(month);
      done();
      return { ok: `'${title}' 매달 반복으로 넣었습니다.` };
    }
  }
  if (view === "planned" && !due) due = today;
  await q("insert into tasks (title, list_id, due, my_day, month, important, note) values ($1,$2,$3,$4,$5,$6,$7)",
    [title, list, due, view === "today" ? today : null, month, view === "important" || fd.get("important") === "on", note]);
  done();
  return { ok: `'${title}' 추가했습니다.` };
}

export async function toggleImportant(id: number) {
  await requireUser();
  await q("update tasks set important = not important where id=$1", [id]);
  done();
}

/** 끝내기 (어떻게 끝냈는지 짧은 메모와 함께) */
export async function completeTask(id: number, memo: string) {
  await requireUser();
  await q("update tasks set done_at = now(), done_note = $2 where id=$1 and done_at is null", [id, memo.trim().slice(0, 1000)]);
  done();
}

export async function reopenTask(id: number) {
  await requireUser();
  await q("update tasks set done_at = null where id=$1", [id]);
  done();
}

export async function saveDoneNote(id: number, memo: string) {
  await requireUser();
  await q("update tasks set done_note = $2 where id=$1", [id, memo.trim().slice(0, 1000)]);
  done();
}

export async function saveTask(_p: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = Number(str(fd, "id"));
  const title = str(fd, "title").slice(0, 300);
  if (!title) return { error: "할 일을 적으세요." };
  const due = isDate(str(fd, "due")) ? str(fd, "due") : null;
  const myDay = fd.get("my_day") === "on" ? todaySeoul() : null;
  const [t] = await q<{ repeat_id: number | null }>(
    `update tasks set title=$2, list_id=$3, due=$4, note=$5, important=$6,
       my_day = case when $7::date is null then null else coalesce(my_day, $7::date) end where id=$1 returning repeat_id`,
    [id, title, listOf(str(fd, "list_id")), due, str(fd, "note").slice(0, 2000), fd.get("important") === "on", myDay]);
  if (t?.repeat_id && fd.get("apply_repeat") === "on") {
    await q("update repeat_tasks set title=$2, list_id=$3, day=$4, note=$5, important=$6 where id=$1",
      [t.repeat_id, title, listOf(str(fd, "list_id")), due ? Number(due.slice(8)) : null, str(fd, "note").slice(0, 2000), fd.get("important") === "on"]);
  }
  done();
  return { ok: "저장했습니다." };
}

/** scope: one = 이것만 지우기, repeat = 매달 반복 그만(아직 안 한 것 지움) */
export async function deleteTask(id: number, scope: "one" | "repeat" = "one") {
  await requireUser();
  const [t] = await q<{ repeat_id: number | null; month: string | null }>("select repeat_id, month from tasks where id=$1", [id]);
  if (!t) return;
  if (!t.repeat_id) await q("delete from tasks where id=$1", [id]);
  else if (scope === "repeat") {
    await q("update repeat_tasks set active=false where id=$1", [t.repeat_id]);
    await q("delete from tasks where repeat_id=$1 and done_at is null", [t.repeat_id]);
  } else {
    // 반복으로 다시 생기지 않게 숨김
    await q("update tasks set hidden=true where id=$1", [id]);
  }
  done();
}

/* ───────── 목록 ───────── */

export async function addList(_p: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const name = str(fd, "name").slice(0, 40);
  if (!name) return { error: "목록 이름을 적으세요." };
  const c = str(fd, "color");
  await q("insert into lists (name, color, sort) values ($1,$2,(select coalesce(max(sort),0)+1 from lists))", [name, c in COLORS ? c : "indigo"]);
  done();
  return { ok: `'${name}' 목록을 만들었습니다.` };
}

export async function saveList(_p: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const name = str(fd, "name").slice(0, 40);
  if (!name) return { error: "목록 이름을 적으세요." };
  const c = str(fd, "color");
  await q("update lists set name=$2, color=$3, sort=$4 where id=$1", [Number(str(fd, "id")), name, c in COLORS ? c : "indigo", Number(str(fd, "sort")) || 0]);
  done();
  return { ok: "저장했습니다." };
}

/** 목록을 지우면 그 안의 할 일은 '작업'으로 옮겨짐 */
export async function deleteList(fd: FormData) {
  await requireUser();
  await q("delete from lists where id=$1", [Number(str(fd, "id"))]);
  done();
}

/* ───────── 알림 설정 ───────── */

const setSetting = (k: string, v: string) =>
  q("insert into settings (key, value) values ($1,$2) on conflict (key) do update set value=excluded.value", [k, v]);

export async function saveNotify(_p: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const email = str(fd, "notify_email");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "이메일 주소를 확인하세요." };
  await setSetting("notify_email", email);
  await setSetting("notify_days", String(Math.max(0, Math.min(14, Number(str(fd, "notify_days")) || 0))));
  await setSetting("email_on", fd.get("email_on") === "on" ? "1" : "0");
  await setSetting("kakao_on", fd.get("kakao_on") === "on" ? "1" : "0");
  revalidatePath("/settings");
  return { ok: "저장했습니다." };
}

export async function sendNow(): Promise<FormState> {
  await requireUser();
  const r = await sendReminder({ force: true });
  if (r.errors.length) return { error: [...r.sent.map((s) => `${s} ✓`), ...r.errors].join(" · ") };
  return r.sent.length ? { ok: `보냈습니다: ${r.sent.join(", ")}` } : { error: "보낼 곳이 꺼져 있습니다. 이메일이나 카카오톡을 켜고 저장하세요." };
}

export async function disconnectKakao() {
  await requireUser();
  await q("delete from settings where key in ('kakao_access','kakao_access_exp','kakao_refresh','kakao_refresh_exp')");
  await setSetting("kakao_on", "0");
  revalidatePath("/settings");
}
