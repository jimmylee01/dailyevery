import { q } from "@/lib/db";
import type { Check, Item } from "@/lib/links";

/** 번호 순 (번호 없으면 뒤로) */
export async function getItems(all = false): Promise<Item[]> {
  return q<Item>(`select id, num, title, url, grp, note, active from items ${all ? "" : "where active"} order by num nulls last, id`);
}

export async function getChecks(from: string, to: string): Promise<Check[]> {
  return q<Check>("select item_id, day::text, checked_at, opened_at, memo from checks where day between $1 and $2", [from, to]);
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const [r] = await q<{ value: string }>("select value from settings where key=$1", [key]);
  return r?.value ?? fallback;
}
