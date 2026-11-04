import tls from "node:tls";
import { q } from "@/lib/db";
import { getItems, getSetting } from "@/lib/data";
import { DEFAULT_LIST, ensureMonth, type Task } from "@/lib/tasks";
import { addDays, dayLabel, isWeekend } from "@/lib/links";
import { todaySeoul } from "@/lib/time";
import { adminEmails } from "@/lib/users";

export function siteUrl(): string {
  const u = process.env.AUTH_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return (u || "https://dailyevery.vercel.app").replace(/\/$/, "");
}

/* ───────── 알림 내용 만들기 ───────── */

type Line = { date: string | null; title: string; note: string; list: string };
export type Digest = { today: string; overdue: Line[]; due: Line[]; soon: Line[]; mine: Line[]; important: Line[]; links: number; days: number };

const asLine = (t: Task): Line => ({ date: t.due, title: t.title, note: t.note, list: t.list_name ?? DEFAULT_LIST });

export async function buildDigest(today = todaySeoul()): Promise<Digest> {
  const days = Number(await getSetting("notify_days", "3")) || 0;
  await ensureMonth(today.slice(0, 7));
  await ensureMonth(addDays(today, days).slice(0, 7));
  const open = await q<Task>(`select t.id, t.title, l.name as list_name, t.due::text, t.my_day::text, t.important, t.note
                              from tasks t left join lists l on l.id=t.list_id where t.done_at is null and not t.hidden order by t.due nulls last, t.id`);
  const until = addDays(today, days);
  const links = !isWeekend(today) ? (await getItems()).length : 0;
  return {
    today, days, links,
    overdue: open.filter((t) => t.due && t.due < today).map(asLine),
    due: open.filter((t) => t.due === today).map(asLine),
    soon: open.filter((t) => t.due && t.due > today && t.due <= until).map(asLine),
    mine: open.filter((t) => t.my_day === today && (!t.due || t.due > until)).map(asLine),
    important: open.filter((t) => t.important && (!t.due || t.due > until) && t.my_day !== today).map(asLine),
  };
}

const md = (d: string | null) => (d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8))}` : "");

export function digestText(g: Digest): string {
  const sec = (h: string, ls: Line[]) => (ls.length ? [`■ ${h} (${ls.length})`, ...ls.map((l) => `- ${l.date ? `[${md(l.date)}] ` : ""}${l.title}${l.note ? ` — ${l.note}` : ""}`), ""] : []);
  return [
    `DailyEvery · ${dayLabel(g.today, true)}`, "",
    ...sec("지난 날짜인데 아직 안 함", g.overdue),
    ...sec("오늘까지", g.due),
    ...sec(`앞으로 ${g.days}일 안`, g.soon),
    ...sec("오늘 할 일", g.mine),
    ...sec("중요", g.important),
    ...(g.links ? [`오늘 확인할 링크 ${g.links}개`, ""] : []),
    `열기: ${siteUrl()}/`,
  ].join("\n");
}

function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!); }

export function digestHtml(g: Digest): string {
  const sec = (h: string, color: string, ls: Line[]) => !ls.length ? "" :
    `<h3 style="margin:18px 0 6px;font-size:15px;color:${color}">${esc(h)} <span style="color:#78716c;font-weight:normal">${ls.length}</span></h3><ul style="margin:0;padding-left:18px">${ls.map((l) =>
      `<li style="margin:3px 0">${l.date ? `<b>${md(l.date)}</b> ` : ""}${esc(l.title)} <span style="color:#a8a29e;font-size:12px">${esc(l.list)}</span>${l.note ? ` <span style="color:#78716c">— ${esc(l.note)}</span>` : ""}</li>`).join("")}</ul>`;
  return `<div style="font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:14px;color:#1c1917;max-width:560px">
<div style="font-size:18px;font-weight:700;color:#3730a3">✓ DailyEvery</div>
<div style="color:#57534e;margin-top:2px">${esc(dayLabel(g.today, true))}</div>
${sec("지난 날짜인데 아직 안 함", "#be123c", g.overdue)}
${sec("오늘까지", "#b45309", g.due)}
${sec(`앞으로 ${g.days}일 안`, "#0369a1", g.soon)}
${sec("오늘 할 일", "#3730a3", g.mine)}
${sec("중요 ★", "#9f1239", g.important)}
${g.links ? `<p style="margin-top:18px">오늘 확인할 링크 <b>${g.links}</b>개</p>` : ""}
<p style="margin-top:20px"><a href="${siteUrl()}/" style="background:#3730a3;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">DailyEvery 열기</a></p>
</div>`;
}

/** 카카오톡 '나에게 보내기'는 200자까지 */
export function digestShort(g: Digest): string {
  const parts: string[] = [`DailyEvery ${md(g.today)}`];
  const add = (h: string, ls: Line[]) => { if (ls.length) parts.push(`${h}: ${ls.map((l) => `${l.date && h !== "오늘" ? md(l.date) + " " : ""}${l.title}`).join(", ")}`); };
  add("밀림", g.overdue); add("오늘", g.due); add(`${g.days}일 안`, g.soon); add("중요", g.important);
  if (g.links) parts.push(`링크 ${g.links}개 확인`);
  const t = parts.join("\n");
  return t.length > 195 ? t.slice(0, 192) + "…" : t;
}

/* ───────── Gmail 보내기 (앱 비밀번호, SMTP 465) ───────── */

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const wrap = (s: string) => s.replace(/.{1,76}/g, "$&\r\n");

export async function sendGmail(to: string, subject: string, text: string, html: string) {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) throw new Error("메일 계정이 아직 연결되지 않았습니다 (Vercel에 GMAIL_USER · GMAIL_APP_PASSWORD 필요)");
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const sock = tls.connect({ host, port: Number(process.env.SMTP_PORT) || 465, servername: host });
  sock.setTimeout(20000, () => sock.destroy(new Error("메일 서버 응답이 없습니다")));
  let buf = "";
  const waiting: ((l: string) => void)[] = [];
  const ready: string[] = [];
  let failed: Error | null = null;
  sock.on("data", (d) => {
    buf += d.toString("utf8");
    let i;
    while ((i = buf.indexOf("\r\n")) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (/^\d{3}-/.test(line)) continue; // 여러 줄 응답의 중간 줄
      const w = waiting.shift(); if (w) w(line); else ready.push(line);
    }
  });
  sock.on("error", (e) => { failed = e; waiting.splice(0).forEach((w) => w(`999 ${e.message}`)); });
  const reply = () => new Promise<string>((res) => { if (failed) return res(`999 ${(failed as Error).message}`); const r = ready.shift(); if (r !== undefined) res(r); else waiting.push(res); });
  const expect = async (code: string, cmd?: string) => {
    if (cmd !== undefined) sock.write(cmd + "\r\n");
    const r = await reply();
    if (!r.startsWith(code)) throw new Error(/^535/.test(r) ? "Gmail 로그인 실패 — GMAIL_USER와 앱 비밀번호(16자리)를 확인하세요" : `메일 보내기 실패: ${r}`);
  };
  try {
    await expect("220");
    await expect("250", "EHLO dailyevery");
    await expect("334", "AUTH LOGIN");
    await expect("334", b64(user));
    await expect("235", b64(pass));
    await expect("250", `MAIL FROM:<${user}>`);
    await expect("250", `RCPT TO:<${to}>`);
    await expect("354", "DATA");
    const boundary = `b${Date.now().toString(36)}`;
    const msg = [
      `From: =?UTF-8?B?${b64("DailyEvery")}?= <${user}>`,
      `To: <${to}>`,
      `Subject: =?UTF-8?B?${b64(subject)}?=`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@dailyevery>`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap(b64(text)),
      `--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", wrap(b64(html)),
      `--${boundary}--`, "",
    ].join("\r\n");
    sock.write(msg + "\r\n.\r\n");
    await expect("250");
    sock.write("QUIT\r\n");
  } finally {
    sock.end();
  }
}

/* ───────── 카카오톡 나에게 보내기 ───────── */

const setSetting = (k: string, v: string) =>
  q("insert into settings (key, value) values ($1,$2) on conflict (key) do update set value=excluded.value", [k, v]);

export function kakaoKeys() {
  return { id: process.env.KAKAO_REST_KEY?.trim() ?? "", secret: process.env.KAKAO_CLIENT_SECRET?.trim() ?? "" };
}

/** 받은 토큰 저장 (새 refresh_token이 오면 그것도) */
export async function storeKakaoToken(t: { access_token: string; expires_in: number; refresh_token?: string; refresh_token_expires_in?: number }) {
  await setSetting("kakao_access", t.access_token);
  await setSetting("kakao_access_exp", String(Date.now() + (t.expires_in - 120) * 1000));
  if (t.refresh_token) {
    await setSetting("kakao_refresh", t.refresh_token);
    if (t.refresh_token_expires_in) await setSetting("kakao_refresh_exp", String(Date.now() + t.refresh_token_expires_in * 1000));
  }
}

async function kakaoAccess(): Promise<string> {
  const access = await getSetting("kakao_access");
  if (access && Number(await getSetting("kakao_access_exp", "0")) > Date.now()) return access;
  const refresh = await getSetting("kakao_refresh");
  if (!refresh) throw new Error("카카오톡이 아직 연결되지 않았습니다 (알림 설정에서 '카카오톡 연결')");
  const { id, secret } = kakaoKeys();
  if (!id) throw new Error("Vercel에 KAKAO_REST_KEY가 없습니다");
  const body = new URLSearchParams({ grant_type: "refresh_token", client_id: id, refresh_token: refresh });
  if (secret) body.set("client_secret", secret);
  const r = await fetch("https://kauth.kakao.com/oauth/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" }, body });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error(`카카오 연결이 끊어졌습니다 — 알림 설정에서 다시 연결하세요 (${j.error_description || j.error || r.status})`);
  await storeKakaoToken(j);
  return j.access_token;
}

export async function sendKakaoMemo(text: string) {
  const token = await kakaoAccess();
  const url = `${siteUrl()}/`;
  const template = { object_type: "text", text, link: { web_url: url, mobile_web_url: url }, button_title: "열기" };
  const r = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(`카카오톡 보내기 실패: ${j.msg || r.status}${j.code === -402 ? " — 동의항목 '카카오톡 메시지 전송'을 켜고 다시 연결하세요" : ""}`);
  }
}

/* ───────── 보내기 ───────── */

export async function sendReminder({ force = false } = {}): Promise<{ sent: string[]; errors: string[]; skipped?: string }> {
  const g = await buildDigest();
  const has = g.overdue.length + g.due.length + g.soon.length > 0;
  if (!force && !has && !g.mine.length) return { sent: [], errors: [], skipped: "보낼 내용 없음" };
  const sent: string[] = [], errors: string[] = [];
  if ((await getSetting("email_on", "0")) === "1") {
    const to = (await getSetting("notify_email")) || adminEmails()[0] || "";
    const n = g.overdue.length + g.due.length;
    const subject = `[DailyEvery] ${dayLabel(g.today)} ${n ? `마감 ${n}개` : g.soon.length ? `곧 마감 ${g.soon.length}개` : `오늘 할 일 ${g.mine.length}개`}`;
    try { if (!to) throw new Error("받을 이메일이 없습니다"); await sendGmail(to, subject, digestText(g), digestHtml(g)); sent.push(`이메일(${to})`); }
    catch (e) { errors.push(`이메일: ${(e as Error).message}`); }
  }
  if ((await getSetting("kakao_on", "0")) === "1") {
    try { await sendKakaoMemo(digestShort(g)); sent.push("카카오톡"); }
    catch (e) { errors.push(`카카오톡: ${(e as Error).message}`); }
  }
  await setSetting("last_notify", `${new Date().toISOString()}|${sent.join(", ") || "-"}|${errors.join(" / ")}`);
  return { sent, errors };
}
