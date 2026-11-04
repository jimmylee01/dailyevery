"use client";

import { useRef, useState, useTransition } from "react";
import { deleteAttachment, finishUpload, startUpload, type Target } from "@/lib/actions-files";
import type { Att } from "@/lib/task-types";

const isImg = (m: string) => m.startsWith("image/");
const icon = (m: string) => (m === "application/pdf" ? "📄" : isImg(m) ? "🖼" : m.includes("sheet") || m.includes("excel") ? "📊" : m.includes("presentation") ? "📽" : "📎");

function putFile(url: string, file: File, onProgress: (p: number) => void): Promise<{ id: string }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => { if (x.status >= 200 && x.status < 300) { try { resolve(JSON.parse(x.responseText)); } catch { reject(new Error("드라이브 응답을 읽지 못했습니다")); } } else reject(new Error(`드라이브 업로드 실패 (${x.status})`)); };
    x.onerror = () => reject(new Error("드라이브 업로드 실패 (네트워크)"));
    x.send(file);
  });
}

function Thumb({ a, onDelete }: { a: Att; onDelete: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="group relative w-28 shrink-0 overflow-hidden rounded-md border border-stone-200 bg-white">
      <a href={a.link} target="_blank" rel="noopener noreferrer" title={`${a.name} — 드라이브에서 열기`} className="block">
        {!broken && (isImg(a.mime) || a.mime === "application/pdf") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/gdrive?thumb=${encodeURIComponent(a.drive_id)}&s=400`} alt={a.name} loading="lazy" onError={() => setBroken(true)} className="h-20 w-full bg-stone-50 object-cover" />
        ) : (
          <div className="flex h-20 items-center justify-center bg-stone-50 text-3xl">{icon(a.mime)}</div>
        )}
        <div className="truncate px-1.5 py-1 text-[11px] text-stone-700">{a.name}</div>
      </a>
      <button type="button" onClick={onDelete} title="첨부 빼기"
        className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex">×</button>
    </div>
  );
}

/** 파일 붙이기: 누르거나 끌어다 놓기 · 이미지는 붙여넣기(Ctrl+V)도 됨 */
export function Attachments({ target, items, label = "파일 붙이기", compact = false }: { target: Target; items: Att[]; label?: string; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ name: string; p: number }[]>([]);
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const [gone, setGone] = useState<number[]>([]);
  const [, start] = useTransition();

  const upload = async (files: File[]) => {
    setErr("");
    for (const f of files) {
      setBusy((b) => [...b, { name: f.name, p: 0 }]);
      try {
        const s = await startUpload(f.name, f.type, f.size);
        if (!s.url) throw new Error(s.error ?? "업로드 실패");
        const res = await putFile(s.url, f, (p) => setBusy((b) => b.map((x) => (x.name === f.name ? { ...x, p } : x))));
        const r = await finishUpload(res.id, target);
        if (r.error) throw new Error(r.error);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setBusy((b) => b.filter((x) => x.name !== f.name));
      }
    }
  };

  const shown = items.filter((a) => !gone.includes(a.id));
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) upload([...e.dataTransfer.files]); }}
      onPaste={(e) => { const fs = [...e.clipboardData.files]; if (fs.length) { e.preventDefault(); upload(fs); } }}
      className={`rounded-md ${over ? "bg-indigo-50 ring-2 ring-indigo-300" : ""}`}
    >
      {shown.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-2">
          {shown.map((a) => (
            <Thumb key={a.id} a={a} onDelete={() => { if (confirm(`'${a.name}' 첨부를 뺄까요? (드라이브에서는 휴지통으로 갑니다)`)) { setGone((g) => [...g, a.id]); start(() => deleteAttachment(a.id)); } }} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" onClick={() => input.current?.click()} className={`rounded border border-dashed border-stone-300 bg-white px-2 py-1 text-stone-600 hover:border-brand hover:text-brand ${compact ? "!py-0.5" : ""}`}>
          📎 {label}
        </button>
        {!compact && <span className="text-stone-400">이미지 · PDF 등 · 끌어다 놓기 / 이미지 붙여넣기도 됩니다 · 구글 드라이브 &lsquo;DailyEvery&rsquo; 폴더에 저장</span>}
        {busy.map((b) => <span key={b.name} className="text-indigo-700">⬆ {b.name} {b.p}%</span>)}
        {err && <span className="text-rose-700">{err}</span>}
      </div>
      <input ref={input} type="file" multiple hidden accept="image/*,application/pdf,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt"
        onChange={(e) => { const fs = [...(e.target.files ?? [])]; e.target.value = ""; if (fs.length) upload(fs); }} />
    </div>
  );
}
