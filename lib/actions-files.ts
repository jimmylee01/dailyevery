"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { q } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { isDate } from "@/lib/time";
import { siteUrl } from "@/lib/notify";
import { fileMeta, folderId, trashFile, uploadSession } from "@/lib/gdrive";

export type Target = { taskId?: number; day?: string };
const MAX = 200 * 1024 * 1024;

/** 1단계: 드라이브 업로드 주소 받기 */
export async function startUpload(name: string, mime: string, size: number): Promise<{ url?: string; error?: string }> {
  await requireUser();
  if (!name || size <= 0) return { error: "빈 파일입니다." };
  if (size > MAX) return { error: `${name}: 200MB보다 큰 파일은 올릴 수 없습니다.` };
  const h = await headers();
  const o = h.get("origin") ?? "";
  const origin = /^http:\/\/localhost(:\d+)?$/.test(o) ? o : siteUrl();
  try {
    return { url: await uploadSession(name.slice(0, 200), mime, size, origin) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/** 2단계: 올라간 파일을 할 일 · 날짜에 붙이기 */
export async function finishUpload(driveId: string, target: Target): Promise<{ error?: string }> {
  await requireUser();
  const [m, folder] = await Promise.all([fileMeta(driveId), folderId()]);
  if (!m || !m.parents?.includes(folder)) return { error: "올린 파일을 드라이브에서 찾지 못했습니다." };
  const taskId = Number(target.taskId) > 0 ? Number(target.taskId) : null;
  const day = !taskId && isDate(target.day) ? target.day : null;
  if (!taskId && !day) return { error: "붙일 곳이 없습니다." };
  await q("insert into attachments (drive_id, name, mime, size, link, task_id, day) values ($1,$2,$3,$4,$5,$6,$7)",
    [m.id, m.name, m.mimeType, m.size ? Number(m.size) : null, m.webViewLink ?? `https://drive.google.com/file/d/${m.id}/view`, taskId, day]);
  revalidatePath("/", "layout");
  return {};
}

/** 첨부 빼기 (드라이브에서는 휴지통으로) */
export async function deleteAttachment(id: number) {
  await requireUser();
  const [a] = await q<{ drive_id: string }>("delete from attachments where id=$1 returning drive_id", [id]);
  if (a) await trashFile(a.drive_id);
  revalidatePath("/", "layout");
}

export async function disconnectDrive() {
  await requireUser();
  await q("delete from settings where key in ('gdrive_access','gdrive_access_exp','gdrive_refresh')");
  revalidatePath("/settings");
}
