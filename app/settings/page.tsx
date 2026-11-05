import { requireUser } from "@/lib/session";
import { getSetting } from "@/lib/data";
import { getLabels, getLists } from "@/lib/tasks";
import { adminEmails } from "@/lib/users";
import { disconnectKakao } from "@/lib/actions-tasks";
import { NotifyForm } from "@/components/NotifyForms";
import { AddLabelForm, AddListForm, LabelRow, ListRow } from "@/components/ListForms";
import { siteUrl } from "@/lib/notify";
import { todaySeoul } from "@/lib/time";
import { disconnectDrive } from "@/lib/actions-files";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ kakao?: string; drive?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const [email, days, emailOn, kakaoOn, refresh, refreshExp, last, lists] = await Promise.all([
    getSetting("notify_email"), getSetting("notify_days", "3"), getSetting("email_on", "0"), getSetting("kakao_on", "0"),
    getSetting("kakao_refresh"), getSetting("kakao_refresh_exp", "0"), getSetting("last_notify"), getLists(),
  ]);
  const [driveRefresh, driveFolder, labels] = await Promise.all([getSetting("gdrive_refresh"), getSetting("gdrive_folder"), getLabels()]);
  const gmailReady = !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
  const kakaoKey = !!process.env.KAKAO_REST_KEY;
  const cronReady = !!process.env.CRON_SECRET;
  const [lastAt, lastSent, lastErr] = last.split("|");
  const expDays = refreshExp !== "0" ? Math.floor((Number(refreshExp) - new Date(`${todaySeoul()}T00:00:00+09:00`).getTime()) / 86400000) : null;
  const site = siteUrl();
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold">설정</h1>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">🔔 알림 (매일 아침 8시쯤)</h2>
        <p className="text-sm text-stone-600">마감이 지났거나 오늘·며칠 안에 마감인 할 일, ☀ 오늘 할 일, ★ 중요한 일을 모아서 보냅니다. 보낼 게 없는 날은 보내지 않습니다.</p>
        {!cronReady && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"><b>아침 자동 알림이 아직 꺼져 있습니다.</b> Vercel → Settings → Environment Variables에 <code>CRON_SECRET</code>(아무 긴 글자)을 넣고 Redeploy 하세요. (&lsquo;지금 보내 보기&rsquo;는 없어도 됩니다)</p>}
        {!gmailReady && <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"><b>이메일 보낼 계정이 아직 없습니다.</b> 보낼 Gmail에서 2단계 인증 → 앱 비밀번호(16자리) 만들기 → Vercel에 <code>GMAIL_USER</code>(그 Gmail 주소) · <code>GMAIL_APP_PASSWORD</code>(16자리) 넣고 Redeploy.</p>}
        <NotifyForm email={email} defaultEmail={adminEmails()[0] ?? ""} days={days} emailOn={emailOn === "1"} kakaoOn={kakaoOn === "1"} kakaoLinked={!!refresh} />
        {lastAt && <p className="text-xs text-stone-500">마지막 보냄: {new Date(lastAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · {lastSent}{lastErr ? <span className="text-rose-700"> · {lastErr}</span> : null}</p>}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">💬 카카오톡 나에게 보내기</h2>
        {sp.kakao === "ok" && <p className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-800">카카오톡이 연결됐습니다. 위 &lsquo;지금 한 번 보내 보기&rsquo;로 확인하세요.</p>}
        {sp.kakao && sp.kakao !== "ok" && <p className="rounded-md bg-rose-50 p-2 text-sm text-rose-800">연결 실패: {sp.kakao}</p>}
        {refresh ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-emerald-700">연결됨</span>
            {expDays !== null && <span className="text-stone-500">연결 유지 {expDays}일 남음 (매일 알림을 보내면 저절로 늘어납니다)</span>}
            <a href="/api/kakao" className="btn-ghost !py-1 text-sm">다시 연결</a>
            <form action={disconnectKakao}><button className="text-xs text-stone-400 hover:text-rose-700">연결 끊기</button></form>
          </div>
        ) : kakaoKey ? (
          <a href="/api/kakao" className="btn inline-block">카카오톡 연결</a>
        ) : (
          <div className="space-y-1 rounded-md bg-stone-50 p-3 text-sm text-stone-700">
            <p className="font-semibold">처음 한 번만 준비 (카카오 개발자 사이트)</p>
            <ol className="list-decimal space-y-0.5 pl-5">
              <li>developers.kakao.com → 로그인 → 내 애플리케이션 → 애플리케이션 추가 (이름: DailyEvery)</li>
              <li>앱 키의 <b>REST API 키</b> 복사 → Vercel 환경변수 <code>KAKAO_REST_KEY</code></li>
              <li>카카오 로그인 → 활성화 ON, Redirect URI에 <code>{site}/api/kakao</code> 등록</li>
              <li>동의항목 → <b>카카오톡 메시지 전송</b>(talk_message) &lsquo;선택 동의&rsquo;로 설정</li>
              <li>플랫폼 → Web 사이트 도메인에 <code>{site}</code> 등록</li>
              <li>Vercel Redeploy 후 이 화면의 &lsquo;카카오톡 연결&rsquo; 누르기</li>
            </ol>
          </div>
        )}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">📎 구글 드라이브 (사진 · PDF 첨부)</h2>
        <p className="text-sm text-stone-600">할 일 · 끝낸 일 · 날짜 메모에 붙인 파일은 내 구글 드라이브의 &lsquo;DailyEvery&rsquo; 폴더에 저장됩니다. DailyEvery는 그 폴더에 직접 올린 파일만 볼 수 있습니다.</p>
        {sp.drive === "ok" && <p className="rounded-md bg-emerald-50 p-2 text-sm text-emerald-800">구글 드라이브가 연결됐습니다. 이제 파일을 붙일 수 있습니다.</p>}
        {sp.drive && sp.drive !== "ok" && <p className="rounded-md bg-rose-50 p-2 text-sm text-rose-800">연결 실패: {sp.drive}</p>}
        {driveRefresh ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-emerald-700">연결됨</span>
            {driveFolder && <a href={`https://drive.google.com/drive/folders/${driveFolder}`} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">드라이브 폴더 열기 ↗</a>}
            <a href="/api/gdrive" className="btn-ghost !py-1 text-sm">다시 연결</a>
            <form action={disconnectDrive}><button className="text-xs text-stone-400 hover:text-rose-700">연결 끊기</button></form>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1 rounded-md bg-stone-50 p-3 text-sm text-stone-700">
              <p className="font-semibold">처음 한 번만 준비 (Google Cloud 콘솔 · DailyEvery 프로젝트)</p>
              <ol className="list-decimal space-y-0.5 pl-5">
                <li>API 및 서비스 → 라이브러리 → <b>Google Drive API</b> → 사용</li>
                <li>사용자 인증 정보 → OAuth 클라이언트 → 승인된 리디렉션 URI에 <code>{site}/api/gdrive</code> 추가 → 저장</li>
                <li>OAuth 동의 화면(Google 인증 플랫폼) → 데이터 액세스 → 범위 추가 → <code>.../auth/drive.file</code> 체크 → 저장</li>
                <li>대상(게시 상태) → <b>앱 게시</b> (테스트 상태로 두면 7일마다 연결이 끊깁니다)</li>
              </ol>
            </div>
            <a href="/api/gdrive" className="btn inline-block">구글 드라이브 연결</a>
          </div>
        )}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">📂 목록</h2>
        <p className="text-sm text-stone-600">&lsquo;작업&rsquo;은 기본 목록입니다. 목록을 지우면 안의 할 일은 &lsquo;작업&rsquo;으로 옮겨집니다. 순서 숫자가 작을수록 위에 나옵니다.</p>
        {lists.map((l) => <ListRow key={l.id} l={l} />)}
        <div className="max-w-xs rounded-md bg-stone-100 p-1"><AddListForm /></div>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-semibold"># 라벨</h2>
        <p className="text-sm text-stone-600">할 일 하나에 라벨을 여러 개 붙일 수 있습니다 (예: 학부모 안내 · 서류 · 급함). 라벨을 지우면 할 일은 그대로 두고 라벨만 빠집니다.</p>
        {labels.map((l) => <LabelRow key={l.id} l={l} />)}
        <div className="max-w-xs rounded-md bg-stone-100 p-1"><AddLabelForm /></div>
      </section>
    </div>
  );
}
