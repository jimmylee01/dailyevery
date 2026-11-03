"use server";

import { revalidatePath } from "next/cache";
import { q, tx } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isDate, todaySeoul } from "@/lib/time";
import { parseLinks } from "@/lib/links";

export type FormState = { error?: string; ok?: string } | undefined;
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const dayOf = (fd: FormData) => (isDate(str(fd, "day")) ? str(fd, "day") : todaySeoul());
const cleanUrl = (u: string) => {
  const t = u.replace(/\s+/g, "");
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

/* ───────── 오늘 체크 ───────── */

/** 확인 ↔ 취소 */
export async function toggleCheck(itemId: number, day: string) {
  await requireUser();
  const d = isDate(day) ? day : todaySeoul();
  await q(
    `insert into checks (item_id, day, checked_at) values ($1,$2,now())
     on conflict (item_id, day) do update set checked_at = case when checks.checked_at is null then now() else null end`,
    [itemId, d]);
  revalidatePath("/", "layout");
}

/** 링크를 열면 '열어 봄' 시각 기록 (처음 연 시각만) */
export async function markOpened(itemId: number, day: string) {
  await requireUser();
  const d = isDate(day) ? day : todaySeoul();
  await q(
    `insert into checks (item_id, day, opened_at) values ($1,$2,now())
     on conflict (item_id, day) do update set opened_at = coalesce(checks.opened_at, now())`, [itemId, d]);
  revalidatePath("/", "layout");
}

export async function saveMemo(itemId: number, day: string, memo: string) {
  await requireUser();
  const d = isDate(day) ? day : todaySeoul();
  await q(
    `insert into checks (item_id, day, memo) values ($1,$2,$3)
     on conflict (item_id, day) do update set memo = excluded.memo`, [itemId, d, memo.trim().slice(0, 500) || null]);
  revalidatePath("/", "layout");
}

/** 남은 것 모두 확인 */
export async function checkAll(fd: FormData) {
  await requireUser();
  const d = dayOf(fd);
  await q(
    `insert into checks (item_id, day, checked_at) select id, $1, now() from items where active
     on conflict (item_id, day) do update set checked_at = coalesce(checks.checked_at, now())`, [d]);
  revalidatePath("/", "layout");
}

/** 그날의 메모 (비우면 지움) */
export async function saveDayNote(day: string, body: string) {
  await requireUser();
  const d = isDate(day) ? day : todaySeoul();
  const t = body.replace(/\r/g, "").trim().slice(0, 20000);
  if (t) await q("insert into day_notes (day, body, updated_at) values ($1,$2,now()) on conflict (day) do update set body=excluded.body, updated_at=now()", [d, t]);
  else await q("delete from day_notes where day=$1", [d]);
  revalidatePath("/", "layout");
}

/* ───────── 링크 관리 ───────── */

export async function addItem(_p: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const title = str(fd, "title");
  if (!title) return { error: "이름을 넣으세요." };
  const num = Number(str(fd, "num")) || null;
  await q(
    "insert into items (num, title, url, grp, note) values (coalesce($1,(select coalesce(max(num),0)+1 from items)),$2,$3,$4,$5)",
    [num, title, cleanUrl(str(fd, "url")), str(fd, "grp"), str(fd, "note")]);
  revalidatePath("/", "layout");
  return { ok: `${title} 추가했습니다.` };
}

export async function saveItem(_p: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const id = Number(str(fd, "id"));
  if (!str(fd, "title")) return { error: "이름을 넣으세요." };
  await q("update items set num=$2, title=$3, url=$4, grp=$5, note=$6, active=$7 where id=$1",
    [id, Number(str(fd, "num")) || null, str(fd, "title"), cleanUrl(str(fd, "url")), str(fd, "grp"), str(fd, "note"), fd.get("active") === "on"]);
  revalidatePath("/", "layout");
  return { ok: "저장했습니다." };
}

export async function deleteItem(fd: FormData) {
  await requireUser();
  await q("delete from items where id=$1", [Number(str(fd, "id"))]);
  revalidatePath("/", "layout");
}

export type ImportState = { error?: string; ok?: string; preview?: { num: number | null; title: string; url: string; dup: boolean }[] } | undefined;

/** 목록 붙여넣기: 미리보기 → 넣기 (같은 주소는 건너뜀) */
export async function importLinks(_p: ImportState, fd: FormData): Promise<ImportState> {
  await requireUser();
  const parsed = parseLinks(String(fd.get("text") ?? ""));
  if (!parsed.length) return { error: "목록을 찾지 못했습니다. '14. 입학설명회' 다음 줄에 링크가 오도록 붙여넣으세요." };
  const have = new Set((await q<{ url: string }>("select url from items")).map((r) => r.url));
  const rows = parsed.map((p) => ({ ...p, url: cleanUrl(p.url), dup: !!p.url && have.has(cleanUrl(p.url)) }));
  if (str(fd, "mode") !== "apply") return { preview: rows, ok: `${rows.length}개를 찾았습니다${rows.some((r) => r.dup) ? ` (이미 있는 ${rows.filter((r) => r.dup).length}개는 건너뜀)` : ""}. 확인 후 '넣기'를 누르세요.` };
  const grp = str(fd, "grp");
  let n = 0;
  await tx(async (c) => {
    for (const r of rows) {
      if (r.dup) continue;
      await c.query(
        "insert into items (num, title, url, grp) values (coalesce($1,(select coalesce(max(num),0)+1 from items)),$2,$3,$4)",
        [r.num, r.title, r.url, grp]);
      n++;
    }
  });
  revalidatePath("/", "layout");
  return { ok: `${n}개를 넣었습니다.` };
}

/* ───────── 설정 ───────── */

export async function saveSetting(fd: FormData) {
  await requireUser();
  const key = str(fd, "key");
  if (!/^[a-z_]+$/.test(key)) return;
  await q("insert into settings (key, value) values ($1,$2) on conflict (key) do update set value=excluded.value", [key, str(fd, "value")]);
  revalidatePath("/", "layout");
}
