"use client";

import { useActionState } from "react";
import { saveNotify, sendNow } from "@/lib/actions-tasks";

type S = { error?: string; ok?: string } | undefined;
const Msg = ({ s }: { s?: S }) =>
  s?.error ? <span className="text-sm text-rose-700">{s.error}</span> : s?.ok ? <span className="text-sm text-emerald-700">{s.ok}</span> : null;

export function NotifyForm({ email, defaultEmail, days, emailOn, kakaoOn, kakaoLinked }: { email: string; defaultEmail: string; days: string; emailOn: boolean; kakaoOn: boolean; kakaoLinked: boolean }) {
  const [s, action, pending] = useActionState(saveNotify, undefined);
  const [t, test, testing] = useActionState(async () => sendNow(), undefined as S);
  return (
    <div className="space-y-3">
      <form action={action} className="space-y-3">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="email_on" defaultChecked={emailOn} /> <b>이메일</b>로 받기</label>
        <div className="ml-6"><label className="label">받을 이메일 (비우면 {defaultEmail || "로그인 계정"})</label><input name="notify_email" defaultValue={email} className="input max-w-sm" placeholder={defaultEmail} /></div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="kakao_on" defaultChecked={kakaoOn} disabled={!kakaoLinked} /> <b>카카오톡 나에게 보내기</b>로 받기 {!kakaoLinked && <span className="text-xs text-stone-500">(아래에서 먼저 연결)</span>}</label>
        {kakaoOn && !kakaoLinked && <input type="hidden" name="kakao_on" value="on" />}
        <div className="flex items-center gap-2 text-sm">마감 <input name="notify_days" type="number" min={0} max={14} defaultValue={days} className="input !w-16 !py-1 text-right" />일 전부터 알려 주기</div>
        <div className="flex items-center gap-2"><button className="btn" disabled={pending}>저장</button><Msg s={s} /></div>
      </form>
      <form action={test} className="flex items-center gap-2 border-t border-stone-100 pt-3">
        <button className="btn-ghost" disabled={testing}>{testing ? "보내는 중…" : "지금 한 번 보내 보기"}</button>
        <Msg s={t} />
      </form>
    </div>
  );
}
