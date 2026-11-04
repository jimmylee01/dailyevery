import { q } from "@/lib/db";
import { getSetting } from "@/lib/data";
import { siteUrl } from "@/lib/notify";

/** 구글 드라이브: 로그인용 구글 클라이언트(AUTH_GOOGLE_ID)로 drive.file 권한만 따로 받아 둠 */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const FOLDER = "DailyEvery";

const setSetting = (k: string, v: string) =>
  q("insert into settings (key, value) values ($1,$2) on conflict (key) do update set value=excluded.value", [k, v]);

export function googleKeys() {
  return { id: process.env.AUTH_GOOGLE_ID ?? "", secret: process.env.AUTH_GOOGLE_SECRET ?? "" };
}
export const driveRedirect = (origin?: string) => `${process.env.NODE_ENV === "production" ? siteUrl() : origin ?? siteUrl()}/api/gdrive`;

export async function storeDriveToken(t: { access_token: string; expires_in: number; refresh_token?: string }) {
  await setSetting("gdrive_access", t.access_token);
  await setSetting("gdrive_access_exp", String(Date.now() + (t.expires_in - 120) * 1000));
  if (t.refresh_token) await setSetting("gdrive_refresh", t.refresh_token);
}

export async function driveConnected(): Promise<boolean> {
  return !!(await getSetting("gdrive_refresh"));
}

export async function driveToken(): Promise<string> {
  const access = await getSetting("gdrive_access");
  if (access && Number(await getSetting("gdrive_access_exp", "0")) > Date.now()) return access;
  const refresh = await getSetting("gdrive_refresh");
  if (!refresh) throw new Error("구글 드라이브가 아직 연결되지 않았습니다. 설정 · 알림에서 '구글 드라이브 연결'을 눌러 주세요.");
  const { id, secret } = googleKeys();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) {
    throw new Error(`구글 드라이브 연결이 끊어졌습니다. 설정에서 다시 연결해 주세요. (${j.error_description || j.error || r.status})`);
  }
  await storeDriveToken(j);
  return j.access_token;
}

async function api(path: string, init: RequestInit = {}) {
  const token = await driveToken();
  return fetch(path.startsWith("http") ? path : `${API}${path}`, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` } });
}

/** 'DailyEvery' 폴더 (없거나 휴지통이면 새로 만듦) */
export async function folderId(): Promise<string> {
  const saved = await getSetting("gdrive_folder");
  if (saved) {
    const r = await api(`/files/${saved}?fields=id,trashed`);
    if (r.ok && !(await r.json()).trashed) return saved;
  }
  const r = await api("/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER, mimeType: "application/vnd.google-apps.folder" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`드라이브 폴더를 만들지 못했습니다: ${j.error?.message ?? r.status}`);
  await setSetting("gdrive_folder", j.id);
  return j.id;
}

/** 브라우저가 파일을 드라이브로 바로 올릴 수 있는 업로드 주소 (서버를 거치지 않아 큰 파일도 됨) */
export async function uploadSession(name: string, mime: string, size: number, origin: string): Promise<string> {
  const parent = await folderId();
  const r = await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,webViewLink", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": mime || "application/octet-stream",
      "X-Upload-Content-Length": String(size),
      Origin: origin,
    },
    body: JSON.stringify({ name, parents: [parent] }),
  });
  const loc = r.headers.get("location");
  if (!r.ok || !loc) {
    const j = await r.json().catch(() => ({}));
    throw new Error(`업로드를 시작하지 못했습니다: ${j.error?.message ?? r.status}`);
  }
  return loc;
}

export type DriveFile = { id: string; name: string; mimeType: string; size?: string; webViewLink?: string; parents?: string[]; trashed?: boolean; thumbnailLink?: string };

export async function fileMeta(id: string, fields = "id,name,mimeType,size,webViewLink,parents,trashed"): Promise<DriveFile | null> {
  const r = await api(`/files/${encodeURIComponent(id)}?fields=${fields}`);
  return r.ok ? r.json() : null;
}

export async function trashFile(id: string) {
  await api(`/files/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) }).catch(() => undefined);
}

/** 미리보기 이미지 (작게 받아서 전달) */
export async function thumbnail(id: string, size = 800): Promise<Response | null> {
  const m = await fileMeta(id, "thumbnailLink");
  if (!m?.thumbnailLink) return null;
  const r = await api(m.thumbnailLink.replace(/=s\d+$/, `=s${size}`));
  return r.ok ? r : null;
}
