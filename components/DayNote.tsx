"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveDayNote } from "@/lib/actions";
import { hm } from "@/lib/links";
import { Attachments } from "@/components/Attachments";
import type { Att } from "@/lib/task-types";

/** 그날의 메모: 쓰다가 잠깐 멈추면 저장 (직접 저장도 가능) */
export function DayNote({ day, body, updatedAt, title = "📝 오늘의 메모", hint, atts = [] }: { day: string; body: string; updatedAt: string | null; title?: string; hint?: string; atts?: Att[] }) {
  const [v, setV] = useState(body);
  const [saved, setSaved] = useState(body);
  const [at, setAt] = useState(updatedAt);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const save = (text: string) => start(async () => { await saveDayNote(day, text); setSaved(text); setAt(new Date().toISOString()); });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const dirty = v !== saved;
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-stone-500">
          {pending ? "저장 중…" : dirty ? "쓰는 중…" : at ? `${hm(at)} 저장됨` : "할 일 · 있었던 일 · 내일 챙길 것"}
        </span>
        {dirty && <button type="button" className="btn ml-auto !py-0.5 text-xs" onClick={() => save(v)}>저장</button>}
      </div>
      {hint && <p className="mb-2 text-xs text-indigo-700">{hint}</p>}
      <textarea
        value={v}
        rows={Math.min(14, Math.max(4, v.split("\n").length + 1))}
        onChange={(e) => {
          const t = e.target.value;
          setV(t);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => save(t), 1200);
        }}
        onBlur={() => { if (v !== saved) save(v); }}
        className="input leading-relaxed"
        placeholder={"예:\n- 교복 신청 3건 새로 들어옴 → 내일 사이즈 확인\n- 간식 링크 마감 금요일"}
      />
      <div className="mt-2"><Attachments target={{ day }} items={atts} label="사진 · PDF 붙이기" /></div>
    </section>
  );
}
