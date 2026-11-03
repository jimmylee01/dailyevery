/** 링크 종류 · 붙여넣기 읽기 · 날짜 (화면 · 서버 함께) */

export type Item = { id: number; num: number | null; title: string; url: string; grp: string; note: string; active: boolean };
export type Check = { item_id: number; day: string; checked_at: string | null; opened_at: string | null; memo: string | null };

/** 링크 종류: 구글 시트 · 설문지 · 문서 · 드라이브 · 기타 */
export function linkKind(url: string): { icon: string; label: string; cls: string } {
  if (/docs\.google\.com\/spreadsheets/.test(url)) return { icon: "▦", label: "시트", cls: "bg-emerald-50 text-emerald-700" };
  if (/docs\.google\.com\/forms|forms\.gle/.test(url)) return { icon: "☰", label: "설문지", cls: "bg-violet-50 text-violet-700" };
  if (/docs\.google\.com\/document/.test(url)) return { icon: "¶", label: "문서", cls: "bg-sky-50 text-sky-700" };
  if (/docs\.google\.com\/presentation/.test(url)) return { icon: "▭", label: "슬라이드", cls: "bg-amber-50 text-amber-700" };
  if (/drive\.google\.com/.test(url)) return { icon: "▲", label: "드라이브", cls: "bg-yellow-50 text-yellow-700" };
  if (!url) return { icon: "·", label: "링크 없음", cls: "bg-stone-100 text-stone-500" };
  return { icon: "↗", label: "링크", cls: "bg-stone-100 text-stone-600" };
}

export type Parsed = { num: number | null; title: string; url: string };

/**
 * 메모장 · 노션 · 카톡에 적어 둔 목록 붙여넣기:
 *   14. 입학설명회
 *   https://docs.google.com/...   (여러 줄로 끊겨 있어도 이어 붙임)
 * 또는 한 줄에 '제목 https://…'
 */
export function parseLinks(text: string): Parsed[] {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim());
  const out: Parsed[] = [];
  let cur: Parsed | null = null, collecting = false;
  const push = () => { if (cur && (cur.title || cur.url)) out.push(cur); cur = null; collecting = false; };
  for (const line of lines) {
    if (!line) { if (cur?.url) push(); collecting = false; continue; }
    const head = /^(\d{1,3})\s*[.)]\s*(.*)$/.exec(line);
    const urlAt = line.search(/https?:\/\//);
    if (head) {
      push();
      const rest = head[2];
      const u = rest.search(/https?:\/\//);
      cur = { num: Number(head[1]), title: (u >= 0 ? rest.slice(0, u) : rest).trim(), url: u >= 0 ? rest.slice(u).replace(/\s+/g, "") : "" };
      collecting = !!cur.url;
      continue;
    }
    if (urlAt === 0 || (collecting && cur?.url && !/\s/.test(line))) {
      if (!cur) cur = { num: null, title: "", url: "" };
      if (urlAt === 0 && cur.url) { push(); cur = { num: null, title: "", url: "" }; }
      cur.url += line.replace(/\s+/g, "");
      collecting = true;
      continue;
    }
    if (urlAt > 0) {
      push();
      out.push({ num: null, title: line.slice(0, urlAt).replace(/[-:|·]\s*$/, "").trim(), url: line.slice(urlAt).replace(/\s+/g, "") });
      continue;
    }
    // 번호 없는 제목 줄
    push();
    cur = { num: null, title: line, url: "" };
  }
  push();
  return out.map((p) => ({ ...p, title: p.title || p.url.replace(/^https?:\/\//, "").slice(0, 40) }));
}

const DAY = ["일", "월", "화", "수", "목", "금", "토"];
export function dayLabel(d: string, long = false): string {
  const [y, m, dd] = d.split("-").map(Number);
  const w = DAY[new Date(Date.UTC(y, m - 1, dd)).getUTCDay()];
  return long ? `${y}년 ${m}월 ${dd}일 (${w})` : `${m}/${dd}(${w})`;
}
export function addDays(d: string, n: number): string {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10);
}
export const isWeekend = (d: string) => { const [y, m, dd] = d.split("-").map(Number); const w = new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); return w === 0 || w === 6; };
/** 서울 시각 'HH:MM' */
export function hm(ts: string | Date | null | undefined): string {
  if (!ts) return "";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));
}
