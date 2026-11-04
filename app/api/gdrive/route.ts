import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { q } from "@/lib/db";
import { DRIVE_SCOPE, driveRedirect, googleKeys, storeDriveToken, thumbnail } from "@/lib/gdrive";

export const dynamic = "force-dynamic";

/**
 * /api/gdrive            → 구글 동의 화면으로 (drive.file 권한)
 * /api/gdrive?code=…     → 돌아와서 토큰 저장
 * /api/gdrive?thumb=ID   → 첨부 미리보기 이미지
 */
export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const thumb = url.searchParams.get("thumb");
  if (thumb) {
    const [a] = await q<{ id: number }>("select id from attachments where drive_id=$1 limit 1", [thumb]);
    if (!a) return new Response("not found", { status: 404 });
    const r = await thumbnail(thumb, Number(url.searchParams.get("s")) || 800).catch(() => null);
    if (!r) return new Response("no thumbnail", { status: 404 });
    return new Response(r.body, { headers: { "Content-Type": r.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=3600" } });
  }
  const { id, secret } = googleKeys();
  const back = driveRedirect(url.origin);
  const err = url.searchParams.get("error");
  if (err) redirect("/settings?drive=" + encodeURIComponent(err));
  const code = url.searchParams.get("code");
  if (!code) {
    const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", back);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", DRIVE_SCOPE);
    u.searchParams.set("access_type", "offline");
    u.searchParams.set("prompt", "consent");
    u.searchParams.set("include_granted_scopes", "true");
    redirect(u.toString());
  }
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: id, client_secret: secret, redirect_uri: back, grant_type: "authorization_code" }),
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) redirect("/settings?drive=" + encodeURIComponent(j.error_description || j.error || String(r.status)));
  if (!String(j.scope ?? "").includes("drive.file")) redirect("/settings?drive=" + encodeURIComponent("드라이브 권한 체크를 켜고 다시 연결해 주세요"));
  await storeDriveToken(j);
  redirect("/settings?drive=ok");
}
