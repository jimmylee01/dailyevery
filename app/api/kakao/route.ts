import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { kakaoKeys, siteUrl, storeKakaoToken } from "@/lib/notify";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

/** /api/kakao → 카카오 로그인(동의)으로 보내고, 돌아오면(?code=) 토큰 저장 */
export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const { id, secret } = kakaoKeys();
  if (!id) redirect("/settings?kakao=" + encodeURIComponent("Vercel에 KAKAO_REST_KEY가 없습니다"));
  const back = `${process.env.NODE_ENV === "production" ? siteUrl() : url.origin}/api/kakao`;
  const code = url.searchParams.get("code");
  const err = url.searchParams.get("error");
  if (err) redirect("/settings?kakao=" + encodeURIComponent(url.searchParams.get("error_description") || err));
  if (!code) {
    const u = new URL("https://kauth.kakao.com/oauth/authorize");
    u.searchParams.set("client_id", id);
    u.searchParams.set("redirect_uri", back);
    u.searchParams.set("response_type", "code");
    u.searchParams.set("scope", "talk_message");
    redirect(u.toString());
  }
  const body = new URLSearchParams({ grant_type: "authorization_code", client_id: id, redirect_uri: back, code });
  if (secret) body.set("client_secret", secret);
  const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body });
  const j = await r.json();
  if (!r.ok || !j.access_token) redirect("/settings?kakao=" + encodeURIComponent(j.error_description || j.error || String(r.status)));
  await storeKakaoToken(j);
  await q("insert into settings (key, value) values ('kakao_on','1') on conflict (key) do update set value='1'");
  redirect("/settings?kakao=ok");
}
